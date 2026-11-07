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

  // Always connect to the same origin as the frontend (Slate URL in prod,
  // localhost:3000 in dev). Next.js rewrites proxy /socket.io/* → backend.
  // This avoids cross-origin CORS issues AND sticky-session failures caused
  // by AppSail's multi-instance load balancer.
  const origin =
    typeof window !== "undefined"
      ? `${window.location.protocol}//${window.location.host}`
      : "http://localhost:3000";

  // Always use polling — AppSail's reverse proxy drops WebSocket upgrade
  // requests, and Slate's rewrite proxy is HTTP-only (no WS tunnel).
  socket = io(origin, {
    path:              "/socket.io",
    auth:              { token },
    transports:        ["polling"],
    upgrade:           false,
    withCredentials:   true,   // send zalb_ sticky-session cookie back to AppSail
    reconnection:        true,
    reconnectionDelay:   3000,
    reconnectionAttempts: 20,
    timeout:    8000,
  });

  socket.on("connect", () =>
    console.log("[AYE Socket] connected →", origin, "| id:", socket?.id)
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
