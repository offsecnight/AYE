"use client";

import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;
let currentToken: string | null = null;

export function getSocket(token: string): Socket {
  // Reuse if already connected with same token
  if (socket && currentToken === token && socket.connected) {
    return socket;
  }

  // Disconnect old socket if token changed
  if (socket) {
    socket.disconnect();
    socket = null;
  }

  currentToken = token;

  // ALWAYS connect to the same origin as the frontend (same host + port).
  // next.config.js rewrites /socket.io/* → backend:4000 server-side.
  // This works through ANY tunnel: serveo, ngrok, Tailscale, custom domain.
  // The browser never needs to know about port 4000.
  const origin =
    typeof window !== "undefined"
      ? `${window.location.protocol}//${window.location.host}`
      : "http://localhost:3000";

  socket = io(origin, {
    path:       "/socket.io",
    auth:       { token },
    transports: ["websocket", "polling"],
    reconnection:        true,
    reconnectionDelay:   1500,
    reconnectionAttempts: 15,
    timeout:    10000,
  });

  socket.on("connect", () =>
    console.log("[AYE Socket] connected →", origin)
  );
  socket.on("connect_error", (err) =>
    console.warn("[AYE Socket] error:", err.message)
  );
  socket.on("disconnect", (reason) =>
    console.log("[AYE Socket] disconnected:", reason)
  );

  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
    currentToken = null;
  }
}
