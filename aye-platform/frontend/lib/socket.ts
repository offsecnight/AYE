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

  // Always connect via the Next.js same-origin proxy (/socket.io/* rewrite).
  // AppSail drops WebSocket upgrades, so polling is the only working transport.
  // We compensate with a very short polling interval (500ms) so messages feel
  // near-instant even without a persistent WS connection.
  const origin =
    typeof window !== "undefined"
      ? `${window.location.protocol}//${window.location.host}`
      : "http://localhost:3000";

  socket = io(origin, {
    path:                  "/socket.io",
    auth:                  { token },
    transports:            ["polling"],
    upgrade:               false,
    withCredentials:       true,
    reconnection:          true,
    reconnectionDelay:     100,
    reconnectionDelayMax:  3000,
    reconnectionAttempts:  20,
    timeout:               8000,
  });

  socket.on("connect", () =>
    console.log("[AYE Socket] connected →", origin, "| transport: polling | id:", socket?.id)
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
