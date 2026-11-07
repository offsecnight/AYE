"use client";

import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;
let currentToken: string | null = null;

export function getSocket(token: string): Socket {
  if (socket && currentToken === token) {
    return socket;
  }

  if (socket) {
    socket.disconnect();
    socket = null;
  }

  currentToken = token;

  // If NEXT_PUBLIC_SOCKET_URL is set (cloud/AppSail deploy), the browser
  // connects directly to the backend — no Next.js proxy in the way, so
  // WebSocket upgrade works and we get true zero-latency real-time.
  //
  // In local dev (no env var), fall back to same-origin proxy via Next.js
  // server.js which tunnels WebSocket through the custom server.
  const directUrl = process.env.NEXT_PUBLIC_SOCKET_URL;

  const origin =
    directUrl ??
    (typeof window !== "undefined"
      ? `${window.location.protocol}//${window.location.host}`
      : "http://localhost:3000");

  // When connecting directly to backend, prefer WebSocket first and fall
  // back to polling only if WS is unavailable.
  // When going through the Next.js proxy (local dev), use polling only
  // because the rewrite proxy doesn't tunnel WS upgrades.
  const transports: ["websocket", "polling"] | ["polling"] = directUrl
    ? ["websocket", "polling"]
    : ["polling"];

  socket = io(origin, {
    path:                  "/socket.io",
    auth:                  { token },
    transports,
    upgrade:               false,   // don't auto-upgrade — we set the right transport upfront
    withCredentials:       true,
    reconnection:          true,
    reconnectionDelay:     100,
    reconnectionDelayMax:  3000,
    reconnectionAttempts:  20,
    timeout:               8000,
  });

  socket.on("connect", () =>
    console.log("[AYE Socket] connected →", origin, "| transport:", socket?.io?.engine?.transport?.name, "| id:", socket?.id)
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
