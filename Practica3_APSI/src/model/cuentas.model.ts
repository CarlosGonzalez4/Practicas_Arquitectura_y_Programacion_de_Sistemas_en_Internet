import { ObjectId } from 'mongodb';

export type Cuenta = {
    _id?: ObjectId;
    iban: string;
    clienteId: ObjectId;
    tipo: "corriente" | "ahorro";
    saldo: number;
    descubiertoMax: number;
    estado: "activa" | "bloqueada" | "cerrada";
    creadaEn: Date;
}