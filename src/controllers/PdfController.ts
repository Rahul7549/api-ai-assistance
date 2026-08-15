import { Request, Response, NextFunction } from "express";
import { generatePdf } from "../services/PdfService";
import path from "path";
import fs from "fs";

const PDF_DIR = path.join(__dirname, "../../generated/pdfs");

export const generate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { content, title } = req.body;
    if (!content) {
      res.status(400).json({ success: false, message: "Content is required" });
      return;
    }

    const result = await generatePdf(content, title || "Document");
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

export const download = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const fileName = req.params.fileName as string;

    // Prevent directory traversal
    const safe = path.basename(fileName);
    const filePath = path.join(PDF_DIR, safe);

    if (!fs.existsSync(filePath)) {
      res.status(404).json({ success: false, message: "File not found" });
      return;
    }

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${safe}"`);
    fs.createReadStream(filePath).pipe(res);
  } catch (err) {
    next(err);
  }
};
