import { Router } from "express";
import { crearTransferencia } from "../controllers/transferencias.controllers.js";
const router = Router();
router.post("/", crearTransferencia);
export default router;