import { createServer } from "http";
import app from "./app";
import { envConfig } from "./config/env";

const PORT = Number(envConfig.port) || 5000;

const server = createServer(app);

server.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
