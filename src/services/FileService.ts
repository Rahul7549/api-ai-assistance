import path from "path";
import fs from "fs";
import * as fileRepo from "../repositories/FileRepository";
import { NotFoundError, UnauthorizedError } from "../utils/errors";

interface MulterFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  filename: string;
}

const UPLOAD_DIR = path.join(__dirname, "../../generated/uploads");
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

export { UPLOAD_DIR };

const TEXT_EXTRACTORS: Record<string, (filePath: string) => Promise<string>> = {
  "application/pdf": async (filePath) => {
    const pdfParse = require("pdf-parse");
    const buffer = fs.readFileSync(filePath);
    const result = await pdfParse(buffer);
    return result.text;
  },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": async (filePath) => {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value;
  },
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": async (filePath) => {
    const { parseOffice } = await import("officeparser");
    return parseOffice(filePath) as unknown as string;
  },
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": async (filePath) => {
    const { parseOffice } = await import("officeparser");
    return parseOffice(filePath) as unknown as string;
  },
};

export async function extractText(filePath: string, mimeType: string): Promise<string | null> {
  const extractor = TEXT_EXTRACTORS[mimeType];
  if (!extractor) return null;
  try {
    const text = await extractor(filePath);
    return text?.trim() || null;
  } catch (err) {
    console.error(`[FileService] text extraction failed for ${filePath}:`, err);
    return null;
  }
}

export async function upload(
  userId: string,
  conversationId: string | undefined,
  file: MulterFile
) {
  const filePath = path.join(UPLOAD_DIR, file.filename);
  const extracted = await extractText(filePath, file.mimetype);

  return fileRepo.create({
    userId,
    conversationId,
    fileName: file.filename,
    originalName: file.originalname,
    mimeType: file.mimetype,
    size: file.size,
    extractedText: extracted ?? undefined,
  });
}

export async function getFile(fileId: string, userId: string) {
  const file = await fileRepo.findById(fileId);
  if (!file) throw new NotFoundError("File not found");
  if (file.userId !== userId) throw new UnauthorizedError("Access denied");
  return file;
}

export async function getFilesByConversation(conversationId: string) {
  return fileRepo.findByConversationId(conversationId);
}
