import { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";
import jwt from "jsonwebtoken";
import { streamChat } from "../services/ChatService";
import { detectPdfIntent, generatePdf } from "../services/PdfService";
import { detectImageIntent, generateImage } from "../services/ImageService";
import * as messageRepo from "../repositories/MessageRepository";
import * as conversationRepo from "../repositories/ConversationRepository";
import * as fileRepo from "../repositories/FileRepository";
import { indexDocument, retrieveContext } from "../services/RagService";
import {
  detectSearchIntent,
  extractSearchQuery,
  search as webSearch,
  formatSearchResults,
  isSearchAvailable,
} from "../services/WebSearchService";
import fs from "fs";
import path from "path";
import { UPLOAD_DIR } from "../services/FileService";
import { AuthPayload } from "../middleware/authenticate";

export const initSocket = (httpServer: HttpServer) => {
  const io = new Server(httpServer, {
    cors: { origin: "*", methods: ["GET", "POST"] },
  });


  // JWT authentication middleware for Socket.IO
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error("Authentication required"));

    try {
      const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET as string) as AuthPayload;
      socket.data.user = payload;
      next();
    } catch {
      next(new Error("Invalid token"));
    }
  });

  io.on("connection", (socket: Socket) => {
    const userId = socket.data.user.userid;
    socket.join(`user:${userId}`);

    let currentAbort: AbortController | null = null;

    socket.on("warm_model", () => {
      socket.emit("model_ready");
    });

    socket.on("user_message", async (data: { conversationId: string; content: string; mode?: string; fileIds?: string[] }) => {
      const { conversationId, content, mode, fileIds } = data;
      if (!conversationId || !content) return;

      if (!fileIds?.length && detectImageIntent(content)) {
        try {
          await messageRepo.create({ conversationId, role: "USER", content });

          socket.emit("ai_token", { token: "Generating image for you..." });

          const result = await generateImage(content);
          const markdownImg = `![Generated Image](${result.url})`;

          await messageRepo.create({ conversationId, role: "ASSISTANT", content: markdownImg });

          const history = await messageRepo.findByConversationId(conversationId, 2);
          if (history.length <= 2) {
            const title = content.length > 50 ? content.slice(0, 50) + "..." : content;
            await conversationRepo.updateTitle(conversationId, title);
          }

          socket.emit("ai_image", { url: result.url, conversationId });
          socket.emit("ai_done", { conversationId });
        } catch (err: any) {
          console.error("[image] generation failed:", err);
          socket.emit("ai_error", { message: err.message || "Image generation failed" });
        }
        return;
      }

      let contextPrefix: string | undefined;
      let imageParts: Array<{ inlineData: { data: string; mimeType: string } }> | undefined;

      if (fileIds?.length) {
        const files = await Promise.all(fileIds.map((id) => fileRepo.findById(id)));
        const validFiles = files.filter(Boolean) as NonNullable<typeof files[number]>[];

        const ownedFiles = validFiles.filter((f) => f.userId === userId);

        for (const f of ownedFiles) {
          if (!f.conversationId) {
            await fileRepo.updateConversationId(f.id, conversationId);
          }
        }

        const imageFiles = ownedFiles.filter((f) => f.mimeType.startsWith("image/"));
        const docFiles = ownedFiles.filter((f) => !f.mimeType.startsWith("image/"));

        if (imageFiles.length) {
          imageParts = imageFiles.map((f) => {
            const filePath = path.join(UPLOAD_DIR, f.fileName);
            const data = fs.readFileSync(filePath).toString("base64");
            return { inlineData: { data, mimeType: f.mimeType } };
          });
        }

        if (docFiles.length) {
          const docTexts = docFiles
            .filter((f) => f.extractedText)
            .map((f) => `### ${f.originalName}\n${f.extractedText}`)
            .join("\n\n---\n\n");

          if (docTexts) {
            contextPrefix = `## Attached Document Content\n\n${docTexts}\n\nUse the document content above to answer the user's question when relevant.`;
          }
        }

        for (const f of docFiles) {
          if (f.extractedText) {
            try {
              await indexDocument(f.id);
              socket.emit("indexing_complete", { fileId: f.id, fileName: f.originalName });
            } catch (err) {
              console.error(`[RAG] indexing failed for ${f.originalName}:`, err);
            }
          }
        }
      }

      let sourceFiles: string[] | undefined;
      if (!contextPrefix) {
        const ragResult = await retrieveContext(conversationId, content);
        if (ragResult) {
          contextPrefix = ragResult.contextPrefix;
          sourceFiles = ragResult.sourceFiles;
        }
      }

      // Web search — only if no RAG context was found and not voice mode
      if (!contextPrefix && mode !== "voice" && detectSearchIntent(content) && isSearchAvailable()) {
        socket.emit("ai_searching");
        const searchQuery = extractSearchQuery(content);
        const searchResults = await webSearch(searchQuery);
        const searchContext = formatSearchResults(searchResults);
        if (searchContext) {
          contextPrefix = searchContext;
        }
      }

      currentAbort = new AbortController();

      let tokenBuf: string[] = [];
      let flushTimer: ReturnType<typeof setTimeout> | null = null;
      const BATCH_MS = 80;

      const flushTokens = () => {
        if (tokenBuf.length) {
          socket.emit("ai_token", { token: tokenBuf.join("") });
          tokenBuf = [];
        }
        flushTimer = null;
      };

      const wantsPdf = detectPdfIntent(content);

      await streamChat(
        userId,
        conversationId,
        content,
        (token) => {
          tokenBuf.push(token);
          if (!flushTimer) {
            flushTimer = setTimeout(flushTokens, BATCH_MS);
          }
        },
        (fullResponse) => {
          if (flushTimer) clearTimeout(flushTimer);
          flushTokens();
          socket.emit("ai_done", { conversationId, content: fullResponse, sourceFiles });

          if (wantsPdf && fullResponse.trim().length > 20) {
            generatePdf(fullResponse, content)
              .then((pdf) => socket.emit("pdf_ready", pdf))
              .catch((err) => console.error("[pdf] generation failed:", err));
          }
        },
        (error) => {
          if (flushTimer) clearTimeout(flushTimer);
          flushTokens();
          socket.emit("ai_error", { message: error });
        },
        currentAbort.signal,
        mode,
        contextPrefix,
        imageParts
      );

      currentAbort = null;
    });

    socket.on("cancel_stream", () => {
      if (currentAbort) {
        currentAbort.abort();
        currentAbort = null;
      }
    });

    socket.on("disconnect", () => {
      if (currentAbort) {
        currentAbort.abort();
        currentAbort = null;
      }
      socket.leave(`user:${userId}`);
    });
  });

  return io;
};
