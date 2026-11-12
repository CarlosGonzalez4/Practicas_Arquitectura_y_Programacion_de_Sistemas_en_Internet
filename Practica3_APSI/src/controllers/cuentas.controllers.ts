import type { Request, Response } from "express";
import { type Collection, ObjectId } from "mongodb";
import type { Cuenta } from "../model/cuentas.model.js";
import type { ClienteT } from "../model/clientes.model.js";
import type { Movimiento } from "../model/movimientos.model.js";
import { generarIBAN } from "../utils/iban.js";

let cuentas: Collection<Cuenta>; let clientes: Collection<ClienteT>; let movimientos: Collection<Movimiento>;
export const configCuentasCollections = (c: Collection<Cuenta>, cl: Collection<ClienteT>, m: Collection<Movimiento>) => {
    cuentas = c;
    clientes = cl;
    movimientos = m;
};

export const createCuenta = (
    req: Request,
    res: Response
) => {
    const { clienteId, tipo } = req.body;
    
    if (typeof clienteId !== "string" || !ObjectId.isValid(clienteId)){
        res.status(400).json({
            error: "clienteId no es válido"
        });
        return;
    }
    
    if (tipo !== "corriente" && tipo !== "ahorro"){
        res.status(400).json({
            error: "El tipo debe ser corriente o ahorro"
        });
        return;
    }
    
    const id = new ObjectId(clienteId);
    clientes.findOne({ _id: id }).then(cliente => {
        if (!cliente){
            res.status(404).json({
                error: "Cliente no encontrado"
            });
            return;
        }
        return cuentas.countDocuments({ clienteId: id, estado: { $ne: "cerrada" } }).then(total => {
            if (total >= 3){
                res.status(409).json({
                    error: "El cliente no puede tener más de 3 cuentas no cerradas"
                });
                return;
            }
            const nueva: Cuenta = {
                iban: generarIBAN(),
                clienteId: id,
                tipo,
                saldo: 0,
                descubiertoMax: tipo === "corriente" ? 50000 : 0, estado: "activa",
                creadaEn: new Date()
            };
            cuentas.insertOne(nueva).then(result => res.status(201).json({
                _id: result.insertedId.toString(),
                ...nueva
            })).catch((error: { code?: number }) => {
                if (error.code === 11000) {
                    nueva.iban = generarIBAN();
                    cuentas.insertOne(nueva).then(result => res.status(201).json({
                        _id: result.insertedId.toString(),
                        ...nueva
                    })).catch(() => res.status(500).json({
                        error: "No se pudo generar un IBAN único"
                    }));
                    return;
                }
                res.status(500).json({
                    error: "Error al crear la cuenta"
                });
            });
        });
    }).catch(() => res.status(500).json({
        error: "Error al crear la cuenta"
    }));
};

export const getCuentas = (
    req: Request,
    res: Response
) => {
    const pagina = Number(req.query.pagina ?? 1);
    const limite = Number(req.query.limite ?? 10);
    
    if (!Number.isInteger(pagina) || !Number.isInteger(limite) || pagina < 1 || limite < 1 || limite > 100){
        res.status(400).json({
            error: "Paginación no válida"
        });
        return;
    }
    const filtro: Record<string, unknown> = {};
    
    if (req.query.clienteId){
        if (typeof req.query.clienteId !== "string" || !ObjectId.isValid(req.query.clienteId)){
            res.status(400).json({
                error: "clienteId no válido"
            });
            return;
        } filtro.clienteId = new ObjectId(req.query.clienteId);
    }
    
    if (req.query.tipo){
        if (!["corriente", "ahorro"].includes(String(req.query.tipo))){
            res.status(400).json({
                error: "Tipo no válido"
            });
            return;
        } filtro.tipo = req.query.tipo;
    }

    if (req.query.estado){
        if (!["activa", "bloqueada", "cerrada"].includes(String(req.query.estado))){
            res.status(400).json({
                error: "Estado no válido"
            });
            return;
        } filtro.estado = req.query.estado;
    }
    cuentas.find(filtro).skip((pagina - 1) * limite).limit(limite).toArray().then(datos => cuentas.countDocuments(filtro).then(total => res.status(200).json({
        datos: datos.map(c => ({ ...c, _id: c._id?.toString(), clienteId: c.clienteId.toString()})),
        pagina,
        limite,
        totalElementos: total,
        totalPaginas: Math.ceil(total / limite)
    }))).catch(() => res.status(500).json({
            error: "Error al obtener las cuentas"
        }));
};

export const getCuenta = (
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
    cuentas.findOne({ _id: new ObjectId(idParam) }).then(cuenta => {
        if (!cuenta){
            res.status(404).json({
                error: "Cuenta no encontrada"
            });
            return;
        }
        return clientes.findOne({ _id: cuenta.clienteId }).then(cliente => res.status(200).json({...cuenta, _id: cuenta._id?.toString(), clienteId: cuenta.clienteId.toString(), titular: cliente ? { nombre: cliente.nombre, email: cliente.email } : null }));
    }).catch(() => res.status(500).json({ error: "Error al obtener la cuenta" }));
};
type EstadoCuenta = Cuenta["estado"];


export const updateEstadoCuenta = (
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
    const estado = req.body.estado;
    
    if (!["activa", "bloqueada", "cerrada"].includes(estado)){
        res.status(400).json({
            error: "Estado inexistente"
        });
        return;
    }

    const id = new ObjectId(idParam);
    cuentas.findOne({ _id: id }).then(cuenta => {
        
        if (!cuenta) { res.status(404).json({
            error: "Cuenta no encontrada"
        });
        return;
    }
        const permitidas: Record<EstadoCuenta, EstadoCuenta[]> = {
            activa: ["bloqueada", "cerrada"],
            bloqueada: ["activa", "cerrada"],
            cerrada: []
        };

        if (cuenta.estado === estado){
            res.status(200).json({
                mensaje:"La cuenta ya tiene ese estado"
            });
            return;
        }

        if (!permitidas[cuenta.estado].includes(estado))
            { res.status(409).json({
                error: `No se puede cambiar de ${cuenta.estado} a ${estado}`
            });
            return;
        }

        if (estado === "cerrada" && cuenta.saldo !== 0){
            res.status(409).json({
                error: `No se puede cerrar una cuenta con saldo distinto de 0 (saldo actual: ${cuenta.saldo})`
            });
            return;
        }
        return cuentas.updateOne({
            _id: id,
            estado: cuenta.estado },
            { $set: { estado } }).then(() => res.status(200).json({
                ...cuenta, estado, _id: id.toString()
            }));
    }).catch(() => res.status(500).json({
        error: "Error al cambiar el estado de la cuenta"
    }));
};

export const getMovimientosCuenta = (
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
    const pagina = Number(req.query.pagina ?? 1);
    const limite = Number(req.query.limite ?? 20);
    
    if (!Number.isInteger(pagina) || !Number.isInteger(limite) || pagina < 1 || limite < 1 || limite > 100){
        res.status(400).json({
            error: "Paginación no válida"
        });
        return;
    }

    cuentas.findOne({ _id: new ObjectId(idParam) }).then(cuenta => {
        
        if (!cuenta){
            res.status(404).json({
                error: "Cuenta no encontrada"
            });
            return;
        }

        const filtro: Record<string, unknown> = {
            cuentaId: cuenta._id
        };

        if (req.query.tipo) filtro.tipo = {
            $in: String(req.query.tipo).split(",")
        };

        if (req.query.categoria) filtro.categoria = req.query.categoria;
        const fecha: Record<string, Date> = {};

        if (req.query.desde) {
            const d = new Date(String(req.query.desde));
            if (Number.isNaN(d.getTime())){
                res.status(400).json({
                    error: "Fecha desde no válida"
                });
                return;
            } fecha.$gte = d;
        }

        if (req.query.hasta) {
            const h = new Date(String(req.query.hasta)); 
            if (Number.isNaN(h.getTime())){
                res.status(400).json({
                    error: "Fecha hasta no válida"
                });
                return;
            } 
            h.setHours(23, 59, 59, 999);
            fecha.$lte = h;
        }

        if (Object.keys(fecha).length) filtro.fecha = fecha;
        const orden = req.query.orden === "fecha" ? 1 : -1;
        movimientos.find(filtro).sort({
            fecha: orden
        }).skip((pagina - 1) * limite).limit(limite).toArray().then(datos => movimientos.countDocuments(filtro).then(total => res.status(200).json({
            datos: datos.map(m => ({ ...m, _id: m._id?.toString(), cuentaId: m.cuentaId.toString(), transferenciaId: m.transferenciaId?.toString()})),
            pagina,
            limite,
            totalElementos: total,
            totalPaginas: Math.ceil(total / limite)
        })));
        return;
    }).catch(() => res.status(500).json({
        error: "Error al obtener los movimientos"
    }));
};
