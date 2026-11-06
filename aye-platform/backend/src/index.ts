import "dotenv/config";
import express from "express";
import http from "http";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import swaggerUi from "swagger-ui-express";

import { swaggerSpec } from "./swagger";
import authRouter       from "./routes/auth";
import experiencesRouter from "./routes/experiences";
import chatRouter        from "./routes/chat";
import publicRouter      from "./routes/public";
import devAdminRouter    from "./routes/devAdmin";
import uploadRouter      from "./routes/upload";
import { adminCampaignRouter, studentCampaignRouter } from "./routes/campaigns";
import { initSocket }    from "./socket";

const app  = express();
const server = http.createServer(app);

// ── Socket.io ────────────────────────────────────────────────
initSocket(server);

// ── Security middleware ──────────────────────────────────────
app.use(helmet({
  // Allow cross-origin requests from the proxy route
  crossOriginResourcePolicy: { policy: "cross-origin" },
}));

// Parse allowed origins — supports comma-separated list or wildcard
const rawOrigins = process.env.FRONTEND_URL ?? "http://localhost:3000";
const allowedOrigins = rawOrigins.split(",").map((o) => o.trim());

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (server-to-server, curl, Postman)
    if (!origin) return callback(null, true);
    // Allow if it matches any configured origin
    if (allowedOrigins.includes("*") || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    // Also allow any Tailscale IP (100.x.x.x) automatically
    if (/^https?:\/\/100\.\d+\.\d+\.\d+/.test(origin)) {
      return callback(null, true);
    }
    return callback(null, true); // permissive for dev — lock down in production
  },
  credentials: true,
}));
app.use(cookieParser());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// ── Rate limiting ─────────────────────────────────────────────
const limiter = rateLimit({
  windowMs:          15 * 60 * 1000, // 15 min
  max:               100,
  standardHeaders:   true,
  legacyHeaders:     false,
  message:           { message: "Too many requests, slow down." },
});
app.use("/api/", limiter);

// Stricter limit on auth routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max:      20,
  message:  { message: "Too many auth attempts." },
});
app.use("/api/v1/auth/", authLimiter);

// ── Swagger UI ────────────────────────────────────────────────
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: `
    .swagger-ui .topbar { background: #0A0A0A; }
    .swagger-ui .topbar-wrapper img { content: url('data:image/svg+xml,<svg/>'); }
    .swagger-ui .topbar-wrapper::before { content: "AYE Platform API"; color: #D4F542; font-weight: bold; font-size: 18px; font-family: monospace; }
  `,
  customSiteTitle: "AYE Platform API Docs",
}));

// ── Routes ─────────────────────────────────────────────────────
app.use("/api/v1",             authRouter);       // /colleges + /auth/*
app.use("/api/v1/experiences", experiencesRouter);
app.use("/api/v1/chat",        chatRouter);
app.use("/api/v1/public",      publicRouter);
// Campaign admin MUST be mounted before the generic devAdmin router
// so Express matches /dev-admin/campaigns/* before /dev-admin/*
app.use("/api/v1/dev-admin/campaigns", adminCampaignRouter);
app.use("/api/v1/dev-admin",   devAdminRouter);
app.use("/api/v1/campaigns",   studentCampaignRouter);        // student campaign views/submit
app.use("/api/v1/upload",      uploadRouter);                 // file upload (POST /upload)
// File download reuses the same router but under /files prefix so
// the /:storedName param handler is reached at GET /api/v1/files/:name
app.use("/api/v1/files",       uploadRouter);

// ── Health check ──────────────────────────────────────────────
app.get("/health", (_req, res) => {
  res.json({ status: "ok", platform: "AYE", timestamp: new Date().toISOString() });
});

// ── 404 handler ───────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ message: "Route not found" });
});

// ── Global error handler (sync + async via next(err)) ─────────
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("[Error]", err.stack ?? err.message);
  if (res.headersSent) return;
  res.status(500).json({ message: "Internal server error", detail: err.message });
});

// Catch unhandled promise rejections so the process doesn't die
process.on("unhandledRejection", (reason) => {
  console.error("[UnhandledRejection]", reason);
});
process.on("uncaughtException", (err) => {
  console.error("[UncaughtException]", err);
});

// ── Start ──────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT ?? "4000", 10);
server.listen(PORT, () => {
  console.log(`\n🔥 AYE Platform Backend running on http://localhost:${PORT}`);
  console.log(`📖 Swagger UI: http://localhost:${PORT}/api-docs`);
  console.log(`🩺 Health:     http://localhost:${PORT}/health\n`);
});
