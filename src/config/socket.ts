import { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";
import jwt from "jsonwebtoken";
import { streamChat, warmModel } from "../services/ChatService";
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

    socket.on("warm_model", async () => {
      await warmModel().catch(() => {});
      socket.emit("model_ready");
    });

    socket.on("user_message", async (data: { conversationId: string; content: string; mode?: string }) => {
      const { conversationId, content, mode } = data;
      if (!conversationId || !content) return;

      currentAbort = new AbortController();

      await streamChat(
        userId,
        conversationId,
        content,
        (token) => socket.emit("ai_token", { token }),
        (fullResponse) => socket.emit("ai_done", { conversationId, content: fullResponse }),
        (error) => socket.emit("ai_error", { message: error }),
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
