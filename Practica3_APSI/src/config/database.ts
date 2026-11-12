import { Db, MongoClient } from 'mongodb';

let client: MongoClient;

export const connectMongo = (): Promise<Db> => {
    const uri = process.env.MONGODB_URI;
    const dbName = process.env.DB_NAME || "APSI_2026";
    if (!uri) return Promise.reject(new Error("No se ha configurado MONGODB_URI"));
    client = new MongoClient(uri);
    return client.connect().then(() => {
        console.log("Conectado a Mongo");
        return client.db(dbName);
    }).catch((error) => {
        console.log("Error al conectar con Mongo");
        throw error;
    });
};

export const getMongoClient = (): MongoClient => client;