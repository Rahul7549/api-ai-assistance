import dotenv from "dotenv";
dotenv.config();

import { createServer } from "http";
import app from "./app";
import { initSocket } from "./config/socket";

const PORT = process.env.PORT || 3001;

const httpServer = createServer(app);
initSocket(httpServer);

httpServer.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
