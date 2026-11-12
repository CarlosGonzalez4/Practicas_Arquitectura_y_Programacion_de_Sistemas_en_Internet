import { Router } from "express";
import { createCliente, getClientes, getCliente, updateCliente } from "../controllers/clientes.controllers.js";
const router = Router();
router.post("/", createCliente);
router.get("/", getClientes);
router.get("/:id", getCliente);
router.patch("/:id", updateCliente);
export default router;