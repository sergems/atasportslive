import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import jwt from "jsonwebtoken";
import app from "./app";
import { logger } from "./lib/logger";
import { wsClients, wsStreamClients } from "./lib/notify";
import { startBonusCron } from "./lib/bonusCron";
import { startGameCron } from "./lib/gameCron";
import { startCommentCron } from "./lib/commentCron";
import { startReportCron } from "./lib/reportCron";

const JWT_SECRET = (process.env.SESSION_SECRET || process.env.JWT_SECRET) as string;
if (!JWT_SECRET) {
  throw new Error("SESSION_SECRET environment variable is required but was not set.");
}

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
  const token = url.searchParams.get("token");
  const streamId = parseInt(url.searchParams.get("streamId") || "0");

  // Verify the JWT token and extract userId — never trust a raw userId from the client.
  let userId = 0;
  if (token) {
    try {
      const payload = jwt.verify(token, JWT_SECRET) as { userId: number };
      userId = payload.userId || 0;
    } catch {
      logger.warn("WebSocket connection rejected: invalid token");
      ws.close(1008, "Invalid token");
      return;
    }
  }

  if (userId > 0) {
    wsClients.set(userId, ws);
    logger.info({ userId }, "WebSocket client connected");
  }

  if (streamId > 0) {
    if (!wsStreamClients.has(streamId)) wsStreamClients.set(streamId, new Set());
    wsStreamClients.get(streamId)!.add(ws);
    logger.info({ streamId }, "Client joined stream room");
  }

  ws.on("close", () => {
    if (userId > 0) {
      wsClients.delete(userId);
      logger.info({ userId }, "WebSocket client disconnected");
    }
    if (streamId > 0) {
      wsStreamClients.get(streamId)?.delete(ws);
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
  startBonusCron();
  startGameCron();
  startCommentCron();
  startReportCron();
});
