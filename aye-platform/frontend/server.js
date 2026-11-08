// Minimal custom Next.js server.
// Replaces the old Socket.IO proxy server since we now connect directly
// to Supabase Realtime from the browser (no WS proxy needed).

const { createServer } = require("http");
const { parse }        = require("url");
const next             = require("next");

const dev  = process.env.NODE_ENV !== "production";
// Catalyst AppSail injects X_ZOHO_CATALYST_LISTEN_PORT, fallback to PORT, then 3000
const port = parseInt(process.env.X_ZOHO_CATALYST_LISTEN_PORT ?? process.env.PORT ?? "3000", 10);

const app    = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });

  server.listen(port, () => {
    console.log(`\n▲ Next.js frontend ready on http://localhost:${port}\n`);
  });
});