import type { Request, Response } from "express";
import { type Collection, ObjectId } from "mongodb";
import type { ClienteT } from "../model/clientes.model.js";

let clientesCollection: Collection<ClienteT>;

export const configClientesCollection = (collection: Collection<ClienteT>) => {
    clientesCollection = collection;
};

export const createCliente = (
    req:Request, 
    res:Response
) => {

    const nombre = req.body.nombre;
    const email = req.body.email?.toLowerCase().trim();
    const dni = req.body.dni?.toUpperCase().trim();

    if (!nombre || !email || !dni) {
        res.status(400).json({
            error: "Nombre, email y DNI son obligatorios"
        });
        return;
    }

    // Comprobar formato del email
    const emailValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!emailValido) {
        res.status(400).json({
            error: "El formato del email no es válido"
        });
        return;
    }

    // Comprobar formato del DNI
    const dniValido = /^[0-9]{8}[A-Z]$/.test(dni);
    if (!dniValido) {
        res.status(400).json({
            error: "El DNI debe tener 8 números y una letra"
        });
        return;
    }

    const nuevoCliente: ClienteT = {
        nombre: nombre.trim(),
        email: email,
        dni: dni,
        creadoEn: new Date()
    };

    clientesCollection.insertOne(nuevoCliente).then((result) => {
        res.status(201).json({
            _id: result.insertedId.toString(),
            ...nuevoCliente
        });
    }).catch((error) => {
        if (error.code === 11000) {
            res.status(409).json({
                error: "El email o DNI ya están registrados"
            });
            return;
        }
        console.log(error);

        res.status(500).json({
            error: "Error al crear el cliente"
        });
    });
};



export const getCliente = (
    req: Request,
    res: Response
) => {
    clientesCollection.find().toArray().then((clientes)=>{
        res.json(clientes)
    }).catch(()=>{
        res.status(500).json({
            message: "Error en la llamada"
        })
    })
};



export const getClientes = (req: Request, res: Response) => {

    const pagina = Number(req.query.pagina) || 1;
    const limite = Number(req.query.limite) || 10;
    if (pagina < 1 || limite < 1 || limite > 100 || !Number.isInteger(pagina) || !Number.isInteger(limite)) {
        res.status(400).json({
            error: "Paginación no válida"
        });
        return;
    }

    const saltar = (pagina - 1) * limite;
    clientesCollection.find().skip(saltar).limit(limite).toArray().then((clientes) => {
        clientesCollection.countDocuments().then((total) => {
            const datos = clientes.map((cliente) => ({
                ...cliente,
                _id: cliente._id?.toString()
            }));

            res.status(200).json({
                datos: datos,
                pagina: pagina,
                limite: limite,
                totalElementos: total,
                totalPaginas: Math.ceil(total / limite)
            });
        });
    }).catch((error) => {
        res.status(500).json({
            error: "Error al obtener los clientes"
        });
    });
}



export const updateCliente = (req: Request, res: Response) => {
    const idParam = req.params.id;
    if (typeof idParam !== "string" || !ObjectId.isValid(idParam)){
        res.status(400).json({
            error: "El identificador no es válido" 
        }); 
        return; 
    }
    const cambios: { nombre?: string; email?: string } = {};

    if (req.body.nombre !== undefined){
        if (typeof req.body.nombre !== "string" || !req.body.nombre.trim()){
            res.status(400).json({ 
                error: "Nombre no válido"
            }); 
            return; 
        }cambios.nombre = req.body.nombre.trim(); }
    
    if (req.body.email !== undefined){
        if (typeof req.body.email !== "string"){
            res.status(400).json({
                error: "Email no válido"
            });
            return;
        } const email = req.body.email.trim().toLowerCase(); 
        
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){
            res.status(400).json({
                error: "Email no válido"
            }); 
            return;
        } cambios.email = email;
    }
    if (Object.keys(cambios).length === 0){
        res.status(400).json({
            error: "Debes indicar nombre o email para modificar"
        });
        return;
    }

    clientesCollection.updateOne({ _id: new ObjectId(idParam)}, { $set: cambios }).then((result) => {
        if (result.matchedCount === 0){
            res.status(404).json({
                error: "Cliente no encontrado"
            });
            return;
        }
        return clientesCollection.findOne({
            _id: new ObjectId(idParam)
        }).then(cliente => res.status(200).json({
            ...cliente, _id: cliente?._id.toString()
        }));
    }).catch((error: { code?: number }) => {
        if (error.code === 11000){
            res.status(409).json({
                error: "El email ya está registrado"
            });
            return;
        }res.status(500).json({
            error: "Error al modificar el cliente"
        });
    });
};
