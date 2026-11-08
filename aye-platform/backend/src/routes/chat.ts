import { asyncHandler } from "../utils/asyncHandler";
import { Router, Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { requireAuth, requireActive } from "../middleware/auth";
import { collegeSiloGuard } from "../middleware/collegeSilo";
import {
  supabaseConfigured,
  insertChatMessage,
  getChatMessages,
  realtimeClientConfig,
} from "../services/supabase";
import { ChatMessageRow } from "../services/supabase";

const router = Router();
const prisma = new PrismaClient();

router.use(requireAuth, requireActive, collegeSiloGuard);

/** Map a stored row into the wire shape the frontend expects. */
function toMessageShape(row: ChatMessageRow) {
  return {
    msg_id:        row.msg_id,
    room_id:       row.room_id,
    content:       row.content,
    send_as_ghost: row.send_as_ghost,
    sender_handle: row.send_as_ghost
      ? "Verified Campus Ghost"
      : (row.sender_handle ?? ""),
    media_url:     row.media_url,
    created_at:    row.created_at,
  };
}

// ── GET /api/v1/chat/realtime-token ────────────────────────────────
/**
 * Returns the Supabase URL + publishable key + a short-lived, college-scoped
 * Realtime access token. The client uses these to subscribe to `postgres_changes`
 * on chat_message (chat) and to Broadcast channels (college events / presence).
 */
router.get("/realtime-token", asyncHandler(async (req: Request, res: Response): Promise<void> => {
  if (!supabaseConfigured()) {
    res.status(503).json({ message: "Realtime not configured" });
    return;
  }
  res.json(realtimeClientConfig(req.user!));
}));

// ── GET /api/v1/chat/rooms ────────────────────────────────────────
/**
 * @swagger
 * /chat/rooms:
 *   get:
 *     summary: Get all chat rooms for authenticated user's college
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 */
router.get("/rooms", asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const rooms = await prisma.chatRoom.findMany({
    where: { college_id: req.user!.college_id },
    orderBy: { created_at: "asc" },
  });
  res.json({ rooms });
}));

// ── POST /api/v1/chat/rooms/:roomId/messages ────────────────────────
/**
 * @swagger
 * /chat/rooms/{roomId}/messages:
 *   post:
 *     summary: Post a new message to a room (persisted to Supabase, pushed live via Realtime)
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 */
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

  const row = await insertChatMessage({
    room_id:       req.params.roomId,
    college_id:    room.college_id,
    sender_id:     req.user!.user_id,
    sender_handle: send_as_ghost ? null : req.user!.ghost_handle,
    send_as_ghost: !!send_as_ghost,
    content:       content.trim().slice(0, 2000),
    media_url:     media_url ?? null,
  });

  if (!row) { res.status(500).json({ message: "Message store unavailable" }); return; }

  res.status(201).json({ message: toMessageShape(row) });
}));

// ── GET /api/v1/chat/rooms/:roomId/messages ──────────────────────────
/**
 * @swagger
 * /chat/rooms/{roomId}/messages:
 *   get:
 *     summary: Get message history for a room (reads from Supabase)
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 */
router.get("/rooms/:roomId/messages", asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const room = await prisma.chatRoom.findUnique({ where: { room_id: req.params.roomId } });
  if (!room) { res.status(404).json({ message: "Room not found" }); return; }

  if (room.college_id !== req.user!.college_id && req.user!.role !== "DEV_SUPER_ADMIN") {
    res.status(403).json({ message: "Access denied" }); return;
  }

  const rows = await getChatMessages(req.params.roomId);
  res.json({ messages: rows.map(toMessageShape) });
}));

export default router;