# Práctica 3 – API REST de un Banco

API REST desarrollada en TypeScript con Node.js, Express y MongoDB para gestionar clientes, cuentas bancarias, movimientos y transferencias.

## 1. Tecnologías utilizadas

- Node.js
- TypeScript
- Express
- MongoDB
- MongoDB Node.js Driver
- Dotenv

## 2. Requisitos previos

Para ejecutar el proyecto es necesario tener instalado:

- Node.js y npm.
- MongoDB (local o MongoDB Atlas).
- Git (para clonar el repositorio).


## 3. Configuración de MongoDB

### Opción A: MongoDB Atlas

1. Acceder a MongoDB Atlas.
2. Crear una cuenta e iniciar sesión.
3. Crear un proyecto y un clúster de MongoDB.
4. Crear un usuario de base de datos con contraseña.
5. Configurar el acceso de red para permitir la conexión desde la dirección IP del equipo.
6. Obtener la cadena de conexión desde la opción Connect → Drivers.
7. Copiar la cadena de conexión para utilizarla en el archivo `.env`.

La base de datos se llama `APSI_2026` y se utiliza la colección de clientes, cuentas y movimientos.

### Opción B: MongoDB local

También se puede utilizar una instalación local de MongoDB.

En Ubuntu, si MongoDB está instalado como servicio, se puede iniciar con:

```bash
sudo systemctl start mongod
```

Para comprobar su estado:

```bash
sudo systemctl status mongod
```

En este caso, la URI de conexión será:

```text
mongodb://localhost:27017
```

## 4. Configuración del archivo .env

En la raíz del proyecto existe un archivo `.env.example` que sirve como plantilla.

Crear el archivo `.env`:

```bash
cp .env.example .env
```

Editar el archivo:

```bash
nano .env
```

Configurar las siguientes variables:

```env
MONGODB_URI=mongodb+srv://USUARIO:CONTRASEÑA@CLUSTER.mongodb.net/
DB_NAME=APSI_2026
PORT=3000
```

Si se utiliza MongoDB local, sustituir `MONGODB_URI` por:

```env
MONGODB_URI=mongodb://localhost:27017
```

Guardar los cambios.

## 5. Instalación de dependencias

Una vez dentro de la carpeta del proyecto, ejecutar:

```bash
npm install
```

Este comando instala todas las dependencias necesarias definidas en `package.json`.

## 6. Arrancar el servidor

Para ejecutar el servidor en modo desarrollo:

```bash
npm run dev
```

Si la conexión con MongoDB se realiza correctamente, aparecerán los mensajes:

```text
Conectado a Mongo
Servidor escuchando en el puerto 3000
```

La API estará disponible en:

```text
http://localhost:3000
```

Para comprobar que funciona, acceder a:

```text
http://localhost:3000/
```

La respuesta será:

```json
{
  "mensaje": "API del Banco funcionando correctamente"
}
```

## 7. Compilar y ejecutar en producción

Para compilar el código TypeScript:

```bash
npm run build
```

Este comando genera los archivos JavaScript dentro de la carpeta `dist`.

Para ejecutar el servidor compilado:

```bash
npm start
```


