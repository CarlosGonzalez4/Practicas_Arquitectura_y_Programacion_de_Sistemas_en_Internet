import type { Request, Response } from "express";
import { type Collection, ObjectId } from "mongodb";
import type { Cuenta } from "../model/cuentas.model.js";
import type { Movimiento } from "../model/movimientos.model.js";
import { validarIBAN } from "../utils/iban.js";

let cuentas: Collection<Cuenta>; let movimientos: Collection<Movimiento>;
export const configTransferenciasCollections = (c: Collection<Cuenta>, m: Collection<Movimiento>) => {
    cuentas = c;
    movimientos = m; 
};

export const crearTransferencia = (
    req: Request,
    res: Response
) => {
    const { ibanOrigen, ibanDestino, importe, concepto } = req.body;
    const categoria = typeof req.body.categoria === "string" && req.body.categoria.trim() ? req.body.categoria.trim() : "otros";
    
    if (typeof ibanOrigen !== "string" || !validarIBAN(ibanOrigen)){
        res.status(400).json({
            error: "El IBAN de origen no es válido"
        });
        return;
    }
    
    if (typeof ibanDestino !== "string" || !validarIBAN(ibanDestino)){
        res.status(400).json({
            error: "El IBAN de destino no es válido"
        });
        return;
    }
    
    if (ibanOrigen === ibanDestino){
        res.status(400).json({
            error: "Las cuentas de origen y destino deben ser distintas"
        });
        return;
    }
    
    if (typeof importe !== "number" || !Number.isSafeInteger(importe) || importe <= 0 || typeof concepto !== "string" || !concepto.trim()){
        res.status(400).json({
            error: "Importe entero mayor que 0 y concepto son obligatorios"
        });
        return;
    }
    
    cuentas.findOne({ iban: ibanOrigen }).then(origen => {
        if (!origen){
            res.status(404).json({
                error: "La cuenta de origen no existe"
            });
            return;
        }
        return cuentas.findOne({ iban: ibanDestino }).then(destino => {
            
            if (!destino){
                res.status(404).json({
                    error: "La cuenta de destino no existe"
                });
                return; 
            }
            if (origen.estado !== "activa"){
                res.status(409).json({
                    error: "La cuenta de origen debe estar activa"
                });
                return;
            }
            if (destino.estado === "cerrada"){
                res.status(409).json({
                    error: "La cuenta de destino está cerrada"
                });
                return;
            }
            const comision = origen.clienteId.equals(destino.clienteId) ? 0 : Math.max(100, Math.ceil(importe * 0.005));
            const total = importe + comision; const disponible = origen.saldo + origen.descubiertoMax;
            
            if (origen.saldo - total < -origen.descubiertoMax){
                res.status(409).json({
                    error: `Saldo insuficiente: disponible ${disponible} céntimos (incluido descubierto), solicitado ${total}`
                });
                return;
            }

            const inicio = new Date();
            inicio.setHours(0, 0, 0, 0);
            const fin = new Date(inicio);
            fin.setDate(fin.getDate() + 1);
            return movimientos.aggregate<{ total: number }>([{ $match: { cuentaId: origen._id, tipo: { $in: ["retirada", "transferencia_emitida", "comision"] }, fecha: { $gte: inicio, $lt: fin } } }, { $group: { _id: null, total: { $sum: { $abs: "$importe" } } } }]).toArray().then(resultado => {
                const gastado = resultado[0]?.total ?? 0;
                
                if (gastado + total > 100000){
                    res.status(409).json({
                        error: `Límite diario superado: gastado ${gastado} céntimos, solicitado ${total}`
                    });
                    return; 
                }
                
                const sessionClient = (cuentas as unknown as { s?: unknown }).s;
                void sessionClient;

                // Actualizaciones condicionales: evita aplicar dos veces una transferencia concurrente.
                return cuentas.updateOne({
                    _id: origen._id, 
                    estado: "activa",
                    saldo: origen.saldo }, { $inc: { saldo: -total } }).then(r1 => {
                    if (!r1.modifiedCount){ 
                        res.status(409).json({
                            error: "No se pudo actualizar la cuenta de origen; inténtalo de nuevo"
                        });
                        return;
                    }
                    return cuentas.updateOne({
                        _id: destino._id, estado: { $ne: "cerrada" },
                        saldo: destino.saldo },
                        { $inc: { saldo: importe } }).then(r2 => {
                            if (!r2.modifiedCount){
                                return cuentas.updateOne({
                                    _id: origen._id,
                                    saldo: origen.saldo - total },
                                    { $inc: { saldo: total } }).then(() => res.status(409).json({
                                        error: "No se pudo actualizar la cuenta de destino"
                                    }));
                                }

                        const transferenciaId = new ObjectId();
                        const fecha = new Date();
                        const nuevos: Movimiento[] = [
                            { cuentaId: origen._id!,
                                tipo: "transferencia_emitida",
                                importe: -importe,
                                saldoResultante: origen.saldo - importe,
                                concepto: concepto.trim(),
                                categoria, transferenciaId,
                                fecha
                            },
                            { cuentaId: destino._id!,
                                tipo: "transferencia_recibida",
                                importe,
                                saldoResultante: destino.saldo + importe,
                                concepto: concepto.trim(),
                                categoria,
                                transferenciaId,
                                fecha
                            }
                        ];

                        if (comision > 0) nuevos.push({ cuentaId: origen._id!, tipo: "comision", importe: -comision, saldoResultante: origen.saldo - total, concepto: "Comisión por transferencia", categoria: "comisiones", transferenciaId, fecha });
                        return movimientos.insertMany(nuevos).then(() => res.status(201).json({
                            transferenciaId: transferenciaId.toString(),
                            importe,
                            comision,
                            saldoOrigen: origen.saldo - total,
                            saldoDestino: destino.saldo + importe
                        }));
                    });
                });
            });
        });
    }).catch(() => res.status(500).json({
        error: "Error al realizar la transferencia"
    }));
};
