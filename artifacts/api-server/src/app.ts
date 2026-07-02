import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import path from "path";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (curl, server-to-server, same-origin via proxy)
    if (!origin) return callback(null, true);
    const allowed = [
      /^https?:\/\/localhost(:\d+)?$/,
      /\.replit\.dev$/,
      /\.repl\.co$/,
      /^https?:\/\/(www\.)?atasportslive\.com\/?$/,
      /^https?:\/\/(www\.)?hatasportslive\.com\/?$/,
      /^https?:\/\/45\.79\.219\.243(:\d+)?\/?$/,
    ];
    if (allowed.some((r) => r.test(origin))) return callback(null, true);
    callback(new Error(`CORS: origin not allowed — ${origin}`));
  },
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

app.use("/api", router);

// Global error handler — Express 5 forwards rejected promises from async
// route handlers here automatically. Log the error then respond, instead of
// letting it fail silently or crash the process.
app.use((err: unknown, req: Request, res: Response, _next: NextFunction): void => {
  req.log?.error({ err }, "Unhandled route error") ?? logger.error({ err }, "Unhandled route error");
  if (res.headersSent) return;
  res.status(500).json({ error: "Internal server error" });
});

export default app;
