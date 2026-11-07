"use client";

import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;
let currentToken: string | null = null;

export function getSocket(token: string): Socket {
  // Reuse if same token and socket exists (connected OR still connecting).
  // Checking only `socket.connected` caused a second socket to be created
  // during the handshake window — leading to two connect events in one tab
  // and the old socket (which had joined the college room) being discarded.
  if (socket && currentToken === token) {
    return socket;
  }

  // Token changed — tear down old socket cleanly
  if (socket) {
    socket.disconnect();
    socket = null;
  }

  currentToken = token;

  const origin =
    typeof window !== "undefined"
      ? `${window.location.protocol}//${window.location.host}`
      : "http://localhost:3000";

  socket = io(origin, {
    path:              "/socket.io",
    auth:              { token },
    transports:        ["polling"],
    upgrade:           false,
    withCredentials:   true,
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
