import { Server as HttpServer } from "http";
import { Server as SocketServer, Socket } from "socket.io";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";
import { JWTPayload } from "../types";

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET ?? "change-me";

export function initSocket(httpServer: HttpServer): SocketServer {
  const io = new SocketServer(httpServer, {
    cors: {
      origin: (origin, callback) => {
        // Accept any origin for Socket.io — the JWT auth is the real gate
        callback(null, true);
      },
      credentials: true,
    },
  });

  // ── Auth middleware ─────────────────────────────────────────
  io.use((socket, next) => {
    const token: string | undefined =
      (socket.handshake.auth?.token as string | undefined) ??
      socket.handshake.headers?.authorization?.split(" ")[1];

    if (!token) return next(new Error("Authentication required"));

    try {
      const payload = jwt.verify(token, JWT_SECRET) as JWTPayload;
      socket.data.user = payload;
      next();
    } catch {
      next(new Error("Invalid token"));
    }
  });

  // ── Connection handler ──────────────────────────────────────
  io.on("connection", (socket: Socket) => {
    const user: JWTPayload = socket.data.user;
    console.log(`[Socket] ${user.ghost_handle} connected`);

    // Auto-join college room (silo enforcement)
    socket.join(`college:${user.college_id}`);

    // ── Join a specific chat room ───────────────────────────
    socket.on("room:join", async (roomId: string) => {
      // Verify room belongs to user's college
      const room = await prisma.chatRoom.findUnique({ where: { room_id: roomId } });
      if (!room) return;
      if (room.college_id !== user.college_id && user.role !== "DEV_SUPER_ADMIN") return;

      socket.join(`room:${roomId}`);
      socket.emit("room:joined", { room_id: roomId, name: room.name });

      // Broadcast updated online count to room
      const count = (await io.in(`room:${roomId}`).fetchSockets()).length;
      io.to(`room:${roomId}`).emit("room:online", { room_id: roomId, count });
    });

    socket.on("room:leave", async (roomId: string) => {
      socket.leave(`room:${roomId}`);
      // Broadcast updated count after leaving
      const count = (await io.in(`room:${roomId}`).fetchSockets()).length;
      io.to(`room:${roomId}`).emit("room:online", { room_id: roomId, count });
    });

    // ── Send a chat message ─────────────────────────────────
    socket.on("message:send", async (payload: {
      room_id:       string;
      content:       string;
      send_as_ghost: boolean;
      media_url?:    string;
    }) => {
      if (!payload.content?.trim()) return;

      // Verify room access
      const room = await prisma.chatRoom.findUnique({ where: { room_id: payload.room_id } });
      if (!room || (room.college_id !== user.college_id && user.role !== "DEV_SUPER_ADMIN")) return;

      // Verify user is not banned
      const dbUser = await prisma.user.findUnique({ where: { user_id: user.user_id } });
      if (!dbUser || dbUser.account_status === "BANNED_TROLL") return;

      const msg = await prisma.chatMessage.create({
        data: {
          room_id:       payload.room_id,
          sender_id:     user.user_id,
          send_as_ghost: payload.send_as_ghost,
          content:       payload.content.trim().slice(0, 2000),
          media_url:     payload.media_url ?? null,
        },
      });

      const outgoing = {
        msg_id:        msg.msg_id,
        room_id:       msg.room_id,
        content:       msg.content,
        send_as_ghost: msg.send_as_ghost,
        sender_handle: payload.send_as_ghost ? "Verified Campus Ghost" : user.ghost_handle,
        media_url:     msg.media_url,
        created_at:    msg.created_at,
      };

      // Broadcast to everyone in the room (within the college silo)
      io.to(`room:${payload.room_id}`).emit("message:new", outgoing);
    });

    // ── Live AYE count update (broadcast to college) ────────
    socket.on("aye:update", (data: { post_id: string; aye_count: number }) => {
      socket.to(`college:${user.college_id}`).emit("aye:update", data);
    });

    // ── Disconnect ───────────────────────────────────────────
    socket.on("disconnect", () => {
      console.log(`[Socket] ${user.ghost_handle} disconnected`);
    });
  });

  return io;
}
