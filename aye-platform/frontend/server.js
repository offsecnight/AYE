// Custom Next.js server that proxies WebSocket (socket.io) to the backend.
// Run with: node server.js (or via package.json "start"/"dev" scripts)
// next.config.js rewrites handle HTTP API calls; this handles WS upgrades.

const { createServer } = require("http");
const { parse }        = require("url");
const next             = require("next");
const { createProxyMiddleware } = require("http-proxy-middleware");

const dev  = process.env.NODE_ENV !== "production";
const port = parseInt(process.env.PORT ?? "3000", 10);
const backendUrl = process.env.BACKEND_URL ?? "http://localhost:4000";

const app    = next({ dev });
const handle = app.getRequestHandler();

// Proxy for socket.io — handles both HTTP polling and WS upgrades.
//
// KEY FIX: Strip "Sec-WebSocket-Extensions" before forwarding the upgrade.
// Without this, both the browser and the backend negotiate permessage-deflate
// independently, and the proxy ends up double-decompressing frames which sets
// the reserved bits and causes "One or more reserved bits are on" errors.
const socketProxy = createProxyMiddleware({
  target:       backendUrl,
  changeOrigin: true,
  ws:           true,
  on: {
    // Strip compression extension header before the WS handshake reaches backend
    proxyReqWs: (proxyReq) => {
      proxyReq.removeHeader("sec-websocket-extensions");
    },
  },
});

app.prepare().then(() => {
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);

    // Route socket.io HTTP polling requests through the proxy
    if (parsedUrl.pathname?.startsWith("/socket.io")) {
      return socketProxy(req, res);
    }

    // Everything else → Next.js
    handle(req, res, parsedUrl);
  });

  // Proxy WebSocket upgrade requests (the actual WS handshake)
  server.on("upgrade", (req, socket, head) => {
    if (req.url?.startsWith("/socket.io")) {
      socketProxy.upgrade(req, socket, head);
    }
  });

  server.listen(port, () => {
    console.log(`\n▲ Next.js frontend ready on http://localhost:${port}`);
    console.log(`  WebSocket proxy: /socket.io → ${backendUrl}\n`);
  });
});
