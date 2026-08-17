import { Request, Response, NextFunction } from "express";
import path from "path";
import fs from "fs";
import * as fileService from "../services/FileService";
import { UPLOAD_DIR } from "../services/FileService";

export const upload = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const file = req.file;
    if (!file) {
      res.status(400).json({ success: false, message: "No file provided" });
      return;
    }

    const userId = req.user!.userid;
    const conversationId = req.body.conversationId || undefined;

    const record = await fileService.upload(userId, conversationId, file);

    res.status(201).json({
      success: true,
      data: {
        id: record.id,
        fileName: record.fileName,
        originalName: record.originalName,
        mimeType: record.mimeType,
        size: record.size,
        url: `/api/files/${record.id}/download`,
      },
    });
  } catch (err) {
    next(err);
  }
};

export const download = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userid;
    const record = await fileService.getFile(req.params.id as string, userId);

    const filePath = path.join(UPLOAD_DIR, record.fileName);
    if (!fs.existsSync(filePath)) {
      res.status(404).json({ success: false, message: "File not found on disk" });
      return;
    }

    res.setHeader("Content-Type", record.mimeType);
    res.setHeader("Content-Disposition", `inline; filename="${record.originalName}"`);
    fs.createReadStream(filePath).pipe(res);
  } catch (err) {
    next(err);
  }
};
