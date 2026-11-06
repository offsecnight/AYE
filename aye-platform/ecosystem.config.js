/**
 * PM2 Ecosystem Config — AYE Platform
 *
 * Usage:
 *   pm2 start ecosystem.config.js          — start both servers
 *   pm2 stop ecosystem.config.js           — stop both
 *   pm2 restart ecosystem.config.js        — restart both
 *   pm2 reload ecosystem.config.js         — zero-downtime reload
 *   pm2 logs                               — tail all logs
 *   pm2 monit                              — live dashboard
 *   pm2 save && pm2 startup                — auto-start on reboot
 *
 * First time setup:
 *   1. cd aye-platform/backend  && npm run build
 *   2. cd aye-platform/frontend && npm run build
 *   3. cd aye-platform          && pm2 start ecosystem.config.js
 */

module.exports = {
  apps: [
    // ── BACKEND ────────────────────────────────────────────────
    {
      name: "aye-backend",
      script: "dist/index.js",
      cwd: "./backend",

      // Keep alive — restart on crash
      autorestart: true,
      watch: false,           // don't watch in prod (use pm2 reload instead)
      max_memory_restart: "512M",

      // Environment
      env: {
        NODE_ENV: "production",
        PORT: 4000,
      },

      // Logs
      out_file: "./logs/backend-out.log",
      error_file: "./logs/backend-err.log",
      merge_logs: true,
      log_date_format: "YYYY-MM-DD HH:mm:ss",
    },

    // ── FRONTEND ───────────────────────────────────────────────
    {
      name: "aye-frontend",
      // Custom server: Next.js + Socket.io on same port 3000
      // WebSocket works through any tunnel (serveo, ngrok, Tailscale)
      script: "server.js",
      cwd: "./frontend",

      autorestart: true,
      watch: false,
      max_memory_restart: "512M",

      env: {
        NODE_ENV:    "production",
        PORT:        3000,
        BACKEND_URL: "http://localhost:4000",
        JWT_SECRET:  "aye-platform-dev-secret-change-in-production-2024",
      },

      out_file:        "./logs/frontend-out.log",
      error_file:      "./logs/frontend-err.log",
      merge_logs:      true,
      log_date_format: "YYYY-MM-DD HH:mm:ss",
    },
  ],
};
