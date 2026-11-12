// Convierte las letras del IBAN en números (A=10 ... Z=35).
const convertirLetras = (texto: string): string => {
    return texto.replace(/[A-Z]/g, (letra) => (letra.charCodeAt(0) - 55).toString());
};

// Calcula el módulo 97 por bloques para no superar el límite de Number.
const modulo97 = (numero: string): number => {
    let resto = 0;
    for (let i = 0; i < numero.length; i += 1) {
        resto = (resto * 10 + Number(numero[i])) % 97;
    }
    return resto;
};

export const validarIBAN = (iban: string): boolean => {
    if (!/^ES\d{22}$/.test(iban)) return false;
    const reorganizado = iban.slice(4) + iban.slice(0, 4);
    return modulo97(convertirLetras(reorganizado)) === 1;
};

export const generarIBAN = (): string => {
    let bban = "";
    for (let i = 0; i < 20; i += 1) bban += Math.floor(Math.random() * 10).toString();
    const numero = convertirLetras(bban + "ES00");
    const control = (98 - modulo97(numero)).toString().padStart(2, "0");
    return "ES" + control + bban;
};