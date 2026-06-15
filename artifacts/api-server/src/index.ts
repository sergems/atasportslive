import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import app from "./app";
import { logger } from "./lib/logger";
import { wsClients } from "./lib/notify";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error("PORT environment variable is required but was not provided.");
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const httpServer = createServer(app);

const wss = new WebSocketServer({ server: httpServer, path: "/ws" });

wss.on("connection", (ws: WebSocket, req) => {
  const url = new URL(req.url || "/", `http://localhost`);
  const userId = parseInt(url.searchParams.get("userId") || "0");

  if (userId > 0) {
    wsClients.set(userId, ws);
    logger.info({ userId }, "WebSocket client connected");
  }

  ws.on("close", () => {
    if (userId > 0) {
      wsClients.delete(userId);
      logger.info({ userId }, "WebSocket client disconnected");
    }
  });

  ws.on("error", (err) => {
    logger.error({ err, userId }, "WebSocket error");
  });

  ws.send(JSON.stringify({ type: "connected", message: "WebSocket connected to ATA Platform" }));
});

httpServer.listen(port, (err?: Error) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }
  logger.info({ port }, "ATA Platform server listening");
});
