import 'dotenv/config';
import express from "express";
import { connectMongo } from './config/database.js';
import { configClientesCollection } from './controllers/clientes.controllers.js';
import { configCuentasCollections } from './controllers/cuentas.controllers.js';
import { configMovimientosCollections } from './controllers/movimientos.controllers.js';
import { configTransferenciasCollections } from './controllers/transferencias.controllers.js';
import clientesRoutes from './routes/clientes.routes.js';
import cuentasRoutes from './routes/cuentas.routes.js';
import transferenciasRoutes from './routes/transferencias.routes.js';
import type { ClienteT } from './model/clientes.model.js';
import type { Cuenta } from './model/cuentas.model.js';
import type { Movimiento } from './model/movimientos.model.js';

const app = express();
app.use(express.json());
const PORT = Number(process.env.PORT) || 3000;

connectMongo().then((db) => {
    const clientes = db.collection<ClienteT>("clientes");
    const cuentas = db.collection<Cuenta>("cuentas");
    const movimientos = db.collection<Movimiento>("movimientos");

    return Promise.all([
        clientes.createIndex({ email: 1 }, { unique: true }),
        clientes.createIndex({ dni: 1 }, { unique: true }),
        cuentas.createIndex({ iban: 1 }, { unique: true })
    ]).then(() => {
        configClientesCollection(clientes);
        configCuentasCollections(cuentas, clientes, movimientos);
        configMovimientosCollections(cuentas, movimientos);
        configTransferenciasCollections(cuentas, movimientos);

        app.get('/', (_req, res) => res.status(200).json({ mensaje: "API del Banco funcionando correctamente" }));
        app.use('/clientes', clientesRoutes);
        app.use('/cuentas', cuentasRoutes);
        app.use('/transferencias', transferenciasRoutes);
        app.use((_req, res) => res.status(404).json({ error: "Ruta no encontrada" }));
        app.listen(PORT, () => console.log(`Servidor escuchando en el puerto ${PORT}`));
    });
}).catch((error) => console.log("No se ha podido iniciar el servidor:", error));