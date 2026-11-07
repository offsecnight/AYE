/** @type {import('next').NextConfig} */
const nextConfig = {
  // Bake the AppSail backend URL into the client bundle at build time.
  // The browser connects to it directly for WebSocket (true real-time) —
  // the Next.js rewrite proxy is HTTP-only and can't tunnel WS upgrades.
  env: {
    NEXT_PUBLIC_SOCKET_URL: "https://aye-backend-50047496537.development.catalystappsail.in",
  },

  images: {
    remotePatterns: [
      { protocol: "http",  hostname: "localhost" },
      { protocol: "https", hostname: "**" },
    ],
  },

  // ── Proxy /socket.io/* → backend :4000 ────────────────────
  // This means the browser only needs port 3000 (the frontend port).
  // WebSocket upgrades on /socket.io are transparently forwarded to
  // the backend, so it works through any tunnel (serveo, ngrok, Tailscale).
  async rewrites() {
    const backendUrl = process.env.BACKEND_URL ?? "http://localhost:4000";
    return [
      {
        source:      "/socket.io/:path*",
        destination: `${backendUrl}/socket.io/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
