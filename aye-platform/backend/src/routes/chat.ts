import { asyncHandler } from "../utils/asyncHandler";
import { Router, Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { requireAuth, requireActive } from "../middleware/auth";
import { collegeSiloGuard } from "../middleware/collegeSilo";

const router = Router();
const prisma = new PrismaClient();

router.use(requireAuth, requireActive, collegeSiloGuard);

// ── GET /api/v1/chat/rooms ────────────────────────────────────
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

// ── POST /api/v1/chat/rooms/:roomId/messages ─────────────────
/**
 * @swagger
 * /chat/rooms/{roomId}/messages:
 *   post:
 *     summary: Post a new message to a room (called by frontend socket server)
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

  const message = await prisma.chatMessage.create({
    data: {
      room_id:       req.params.roomId,
      sender_id:     req.user!.user_id,
      send_as_ghost: !!send_as_ghost,
      content:       content.trim().slice(0, 2000),
      media_url:     media_url ?? null,
    },
    include: { sender: { select: { ghost_handle: true } } },
  });

  res.status(201).json({
    message: {
      msg_id:        message.msg_id,
      room_id:       message.room_id,
      content:       message.content,
      send_as_ghost: message.send_as_ghost,
      sender_handle: message.send_as_ghost ? "Verified Campus Ghost" : message.sender.ghost_handle,
      media_url:     message.media_url,
      created_at:    message.created_at,
    },
  });
}));

// ── GET /api/v1/chat/rooms/:roomId/messages ───────────────────
/**
 * @swagger
 * /chat/rooms/{roomId}/messages:
 *   get:
 *     summary: Get message history for a room
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 */
router.get("/rooms/:roomId/messages", asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const room = await prisma.chatRoom.findUnique({ where: { room_id: req.params.roomId } });
  if (!room) { res.status(404).json({ message: "Room not found" }); return; }

  // Silo check
  if (room.college_id !== req.user!.college_id && req.user!.role !== "DEV_SUPER_ADMIN") {
    res.status(403).json({ message: "Access denied" });
    return;
  }

  const cursor = req.query.cursor as string | undefined;
  const messages = await prisma.chatMessage.findMany({
    where: { room_id: req.params.roomId },
    orderBy: { created_at: "desc" },
    take: 50,
    ...(cursor ? { cursor: { msg_id: cursor }, skip: 1 } : {}),
    include: {
      sender: { select: { ghost_handle: true } },
    },
  });

  // Mask ghost senders
  const masked = messages.map((m) => ({
    ...m,
    sender_handle: m.send_as_ghost ? "Verified Campus Ghost" : m.sender.ghost_handle,
    sender: undefined,
  }));

  res.json({ messages: masked.reverse() });
}));

export default router;



