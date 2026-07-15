import { Router } from "express";
import { authenticate } from "../middleware/authenticate";
import * as pdfController from "../controllers/PdfController";

const router = Router();
router.use(authenticate);

router.post("/generate", pdfController.generate);
router.get("/download/:fileName", pdfController.download);

export default router;
