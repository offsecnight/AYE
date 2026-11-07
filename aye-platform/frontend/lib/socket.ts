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

  // If NEXT_PUBLIC_SOCKET_URL is set (Slate/cloud deploy), connect directly
  // to the AppSail backend — Slate has no Node.js process to proxy WebSockets.
  // In local dev with server.js running, leave it unset to use same-origin proxy.
  const origin =
    process.env.NEXT_PUBLIC_SOCKET_URL ||
    (typeof window !== "undefined"
      ? `${window.location.protocol}//${window.location.host}`
      : "http://localhost:3000");

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
