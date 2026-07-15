import { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";
import jwt from "jsonwebtoken";
import { streamChat, warmModel } from "../services/ChatService";
import { detectPdfIntent, generatePdf } from "../services/PdfService";
import { AuthPayload } from "../middleware/authenticate";

export const initSocket = (httpServer: HttpServer) => {
  const io = new Server(httpServer, {
    cors: { origin: "*", methods: ["GET", "POST"] },
  });

  // Fix 5: Pre-warm model on server boot + keepalive every 4 min
  warmModel().catch(() => {});
  setInterval(() => warmModel().catch(() => {}), 4 * 60 * 1000);

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

    socket.on("warm_model", async () => {
      await warmModel().catch(() => {});
      socket.emit("model_ready");
    });

    socket.on("user_message", async (data: { conversationId: string; content: string; mode?: string }) => {
      const { conversationId, content, mode } = data;
      if (!conversationId || !content) return;

      currentAbort = new AbortController();

      // Fix 4: Token batching — collect tokens for 80ms then flush
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
          socket.emit("ai_done", { conversationId, content: fullResponse });

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
        mode
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
