import type { Request, Response } from "express";
import { type Collection, ObjectId } from "mongodb";
import type { Cuenta } from "../model/cuentas.model.js";
import type { Movimiento } from "../model/movimientos.model.js";

let cuentas: Collection<Cuenta>; let movimientos: Collection<Movimiento>;
export const configMovimientosCollections = (c: Collection<Cuenta>, m: Collection<Movimiento>) => {
    cuentas = c;
    movimientos = m;
};

const importeValido = (n: unknown): n is number => typeof n === "number" && Number.isSafeInteger(n) && n > 0;

export const ingresarDinero = (
    req: Request,
    res: Response
) => {
    const idParam = req.params.id;
    
    if (typeof idParam !== "string" || !ObjectId.isValid(idParam)) {
        res.status(400).json({
            error: "El identificador no es válido"
        });
        return;
    }
    const { importe, concepto } = req.body;
    const categoria = typeof req.body.categoria === "string" && req.body.categoria.trim() ? req.body.categoria.trim() : "otros";
    
    if (!importeValido(importe) || typeof concepto !== "string" || !concepto.trim()) { res.status(400).json({ error: "Importe entero mayor que 0 y concepto son obligatorios" }); return; }
    const id = new ObjectId(idParam);
    cuentas.findOne({ _id: id }).then(cuenta => {
        if (!cuenta) {res.status(404).json({
            error: "Cuenta no encontrada" });
            return;
        }
        if (cuenta.estado === "cerrada") {
            res.status(409).json({
                error: "La cuenta está cerrada"
            });
            return;
        }
        const saldo = cuenta.saldo + importe;
        return cuentas.updateOne({
            _id: id,
            estado: { $ne: "cerrada" },
            saldo: cuenta.saldo },
            { $set: { saldo }
        }).then(result => {
            if (!result.modifiedCount) {
                res.status(409).json({
                    error: "La cuenta ha cambiado. Inténtalo de nuevo"
                });
                return;
            }
            const movimiento: Movimiento = {
                cuentaId: id,
                tipo: "ingreso",
                importe,
                saldoResultante: saldo,
                concepto: concepto.trim(),
                categoria,
                fecha: new Date()
            };
            return movimientos.insertOne(movimiento).then(r => res.status(201).json({
                _id: r.insertedId.toString(),
                ...movimiento,
                cuentaId: id.toString()
            }));
        });
    }).catch(() => res.status(500).json({
        error: "Error al realizar el ingreso"
    }));
};

export const retirarDinero = (
    req: Request,
    res: Response
) => {
    const idParam = req.params.id;
    if (typeof idParam !== "string" || !ObjectId.isValid(idParam)){
        res.status(400).json({
            error: "El identificador no es válido"
        });
        return;
    }
    const { importe, concepto } = req.body;
    const categoria = typeof req.body.categoria === "string" && req.body.categoria.trim() ? req.body.categoria.trim() : "otros";
    
    if (!importeValido(importe) || typeof concepto !== "string" || !concepto.trim()){
        res.status(400).json({
            error: "Importe entero mayor que 0 y concepto son obligatorios"
        });
        return;
    }
    const id = new ObjectId(idParam);
    const inicio = new Date();
    inicio.setHours(0, 0, 0, 0);
    const fin = new Date(inicio);
    fin.setDate(fin.getDate() + 1);

    cuentas.findOne({ _id: id }).then(cuenta => {
        if (!cuenta) {
            res.status(404).json({
                error: "Cuenta no encontrada"
            });
            return;
        }
        if (cuenta.estado !== "activa") {
            res.status(409).json({
                error: `No se pueden realizar retiradas con la cuenta ${cuenta.estado}`
            });
            return;
        }
        return movimientos.aggregate<{ total: number }>([{ $match: {
            cuentaId: id,
            tipo: "retirada",
            fecha: { $gte: inicio, $lt: fin }
        }},
        { $group: {
            _id: null,
            total: { $sum: { $abs: "$importe" } }
        }}]).toArray().then(resultado => {
            const retirado = resultado[0]?.total ?? 0;

            if (retirado + importe > 100000) {
                res.status(409).json({
                    error: `Límite diario superado: retirado ${retirado} céntimos, solicitado ${importe}`
                });
                return;
            }
            const disponible = cuenta.saldo + cuenta.descubiertoMax;
            const saldo = cuenta.saldo - importe;

            if (saldo < -cuenta.descubiertoMax) {
                res.status(409).json({
                    error: `Saldo insuficiente: disponible ${disponible} céntimos (incluido descubierto), solicitado ${importe}`
                });
                return;
            }
            return cuentas.updateOne({
                _id: id,
                estado: "activa",
                saldo: cuenta.saldo
            }, { $set: { saldo } }).then(result => {
                if (!result.modifiedCount) {
                    res.status(409).json({
                        error: "La cuenta ha cambiado. Inténtalo de nuevo"
                    });
                    return;
                }
                const movimiento: Movimiento = {
                    cuentaId: id,
                    tipo: "retirada",
                    importe: -importe,
                    saldoResultante: saldo,
                    concepto: concepto.trim(),
                    categoria,
                    fecha: new Date()
                };
                return movimientos.insertOne(movimiento).then(r => 
                    res.status(201).json({
                        _id: r.insertedId.toString(),
                        ...movimiento,
                        cuentaId: id.toString()
                }));
            });
        });
    }).catch(() => res.status(500).json({
        error: "Error al realizar la retirada"
    }));
};  
