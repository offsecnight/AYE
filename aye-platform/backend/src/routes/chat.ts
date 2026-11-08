import { asyncHandler } from "../utils/asyncHandler";
import { Router, Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { requireAuth, requireActive } from "../middleware/auth";
import { collegeSiloGuard } from "../middleware/collegeSilo";
import { realtimeClientConfig } from "../services/supabase";

const router = Router();
const prisma = new PrismaClient();

router.use(requireAuth, requireActive, collegeSiloGuard);

// ── GET /api/v1/chat/realtime-token ────────────────────────────────
/**
 * Returns the Supabase URL + anon key so the browser can open a
 * Realtime connection for postgres_changes (chat) + broadcast (AYE).
 */
router.get("/realtime-token", asyncHandler(async (_req: Request, res: Response): Promise<void> => {
  res.json(realtimeClientConfig());
}));

// ── GET /api/v1/chat/rooms ────────────────────────────────────────
router.get("/rooms", asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const rooms = await prisma.chatRoom.findMany({
    where: { college_id: req.user!.college_id },
    orderBy: { created_at: "asc" },
  });
  res.json({ rooms });
}));

// ── POST /api/v1/chat/rooms/:roomId/messages ────────────────────────
// Persist message via Prisma → Supabase Realtime picks up the INSERT
// automatically via postgres_changes subscription on the frontend.
router.post("/rooms/:roomId/messages", asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const room = await prisma.chatRoom.findUnique({ where: { room_id: req.params.roomId } });
  if (!room) { res.status(404).json({ message: "Room not found" }); return; }
  if (room.college_id !== req.user!.college_id && req.user!.role !== "DEV_SUPER_ADMIN") {
    res.status(403).json({ message: "Access denied" }); return;
  }

  const { content, send_as_ghost = false, media_url = null } = req.body as {
    content: string; send_as_ghost?: boolean; media_url?: string | null;
  };
  if (!content?.trim()) { res.status(400).json({ message: "content required" }); return; }

  const msg = await prisma.chatMessage.create({
    data: {
      room_id:       req.params.roomId,
      sender_id:     req.user!.user_id,
      send_as_ghost: !!send_as_ghost,
      content:       content.trim().slice(0, 2000),
      media_url:     media_url ?? null,
    },
  });

  res.status(201).json({
    message: {
      msg_id:        msg.msg_id,
      room_id:       msg.room_id,
      content:       msg.content,
      send_as_ghost: msg.send_as_ghost,
      sender_handle: send_as_ghost ? "Verified Campus Ghost" : req.user!.ghost_handle,
      media_url:     msg.media_url,
      created_at:    msg.created_at,
    },
  });
}));

// ── GET /api/v1/chat/rooms/:roomId/messages ──────────────────────────
router.get("/rooms/:roomId/messages", asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const room = await prisma.chatRoom.findUnique({ where: { room_id: req.params.roomId } });
  if (!room) { res.status(404).json({ message: "Room not found" }); return; }
  if (room.college_id !== req.user!.college_id && req.user!.role !== "DEV_SUPER_ADMIN") {
    res.status(403).json({ message: "Access denied" }); return;
  }

  const messages = await prisma.chatMessage.findMany({
    where: { room_id: req.params.roomId },
    orderBy: { created_at: "asc" },
    take: 50,
    include: { sender: { select: { ghost_handle: true } } },
  });

  res.json({
    messages: messages.map((m) => ({
      msg_id:        m.msg_id,
      room_id:       m.room_id,
      content:       m.content,
      send_as_ghost: m.send_as_ghost,
      sender_handle: m.send_as_ghost ? "Verified Campus Ghost" : m.sender.ghost_handle,
      media_url:     m.media_url,
      created_at:    m.created_at,
    })),
  });
}));

export default router;
