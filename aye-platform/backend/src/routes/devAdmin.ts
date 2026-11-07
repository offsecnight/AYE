import { asyncHandler } from "../utils/asyncHandler";
import { Router, Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { requireAuth, requireRole } from "../middleware/auth";
import { banFingerprint } from "../services/fingerprint";
import { applyInviterPenalty } from "../services/antiTroll";
import { recalculateCollegeGrade } from "../services/grading";

const router = Router();
const prisma = new PrismaClient();

// All dev-admin routes require DEV_SUPER_ADMIN role
router.use(requireAuth, requireRole("DEV_SUPER_ADMIN"));

const CollegeSchema = z.object({
  name:                   z.string().min(3),
  slug:                   z.string().min(2).max(60).regex(/^[a-z0-9-]+$/),
  city:                   z.string().min(2),
  gps_lat:                z.number(),
  gps_lng:                z.number(),
  geofence_radius_meters: z.number().int().min(100).max(5000).default(500),
});

// ── GET /api/v1/dev-admin/colleges ───────────────────────────
/**
 * @swagger
 * /dev-admin/colleges:
 *   get:
 *     summary: List all colleges with full data including GPS
 *     tags: [DevAdmin]
 *     security:
 *       - bearerAuth: []
 */
router.get("/colleges", async (_req: Request, res: Response): Promise<void> => {
  const colleges = await prisma.college.findMany({
    orderBy: { created_at: "asc" },
  });
  res.json({ colleges });
});

// ── POST /api/v1/dev-admin/colleges ───────────────────────────
/**
 * @swagger
 * /dev-admin/colleges:
 *   post:
 *     summary: Add a new college with GPS coordinates
 *     tags: [DevAdmin]
 *     security:
 *       - bearerAuth: []
 */
router.post("/colleges", asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const parsed = CollegeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Validation error", errors: parsed.error.flatten() });
    return;
  }

  const existing = await prisma.college.findUnique({ where: { slug: parsed.data.slug } });
  if (existing) {
    res.status(409).json({ message: "College with this slug already exists" });
    return;
  }

  const college = await prisma.college.create({ data: parsed.data });

  // Auto-create a Global chat room for the new college
  await prisma.chatRoom.create({
    data: {
      college_id: college.college_id,
      room_type: "GLOBAL",
      name: "# campus-general",
    },
  });

  res.status(201).json({ college });
}));

// ── POST /api/v1/dev-admin/ban-user ───────────────────────────
/**
 * @swagger
 * /dev-admin/ban-user:
 *   post:
 *     summary: 1-click hardware ban a user + penalise their inviter
 *     tags: [DevAdmin]
 *     security:
 *       - bearerAuth: []
 */
router.post("/ban-user", asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { user_id, reason } = req.body as { user_id: string; reason: string };

  if (!user_id || !reason) {
    res.status(400).json({ message: "user_id and reason are required" });
    return;
  }

  const user = await prisma.user.findUnique({ where: { user_id } });
  if (!user) { res.status(404).json({ message: "User not found" }); return; }

  // Ban account
  await prisma.user.update({
    where: { user_id },
    data: { account_status: "BANNED_TROLL", trust_score: 0 },
  });

  // Hardware ban fingerprint
  await banFingerprint(user.hardware_fingerprint_hash, reason);

  // Chain-reaction: penalise inviter
  await applyInviterPenalty(user_id);

  res.json({ message: `User @${user.ghost_handle} hardware banned`, ghost_handle: user.ghost_handle });
}));

// ── POST /api/v1/dev-admin/seed-otp ───────────────────────────
/**
 * @swagger
 * /dev-admin/seed-otp:
 *   post:
 *     summary: Generate master seed invite codes for a new college
 *     tags: [DevAdmin]
 *     security:
 *       - bearerAuth: []
 */
router.post("/seed-otp", asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { college_id, count = 10 } = req.body as { college_id: string; count?: number };

  if (!college_id) { res.status(400).json({ message: "college_id required" }); return; }

  const college = await prisma.college.findUnique({ where: { college_id } });
  if (!college) { res.status(404).json({ message: "College not found" }); return; }

  const admin = await prisma.user.findFirst({
    where: { role: "DEV_SUPER_ADMIN" },
  });
  if (!admin) { res.status(500).json({ message: "No admin user found for OTP generation" }); return; }

  const safeCount = Math.min(Math.max(1, count), 50);
  const expires_at = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days for seed codes

  const codes = await prisma.$transaction(
    Array.from({ length: safeCount }, () =>
      prisma.campusOtp.create({
        data: {
          college_id,
          generated_by_user_id: admin.user_id,
          otp_code: String(Math.floor(100000 + Math.random() * 900000)),
          expires_at,
        },
      })
    )
  );

  res.status(201).json({
    college: college.name,
    codes: codes.map((c) => ({ otp_code: c.otp_code, expires_at: c.expires_at })),
  });
}));

// ── GET /api/v1/dev-admin/stats ───────────────────────────────
/**
 * @swagger
 * /dev-admin/stats:
 *   get:
 *     summary: Platform-wide statistics
 *     tags: [DevAdmin]
 *     security:
 *       - bearerAuth: []
 */
router.get("/stats", async (_req: Request, res: Response): Promise<void> => {
  const [colleges, users, experiences, banned] = await Promise.all([
    prisma.college.count(),
    prisma.user.count({ where: { account_status: "ACTIVE" } }),
    prisma.experience.count({ where: { status: { not: "HIDDEN_JUNK" } } }),
    prisma.bannedFingerprint.count(),
  ]);

  res.json({ colleges, active_users: users, total_experiences: experiences, hardware_bans: banned });
});

// ── GET /api/v1/dev-admin/flagged-junk ───────────────────────
/**
 * @swagger
 * /dev-admin/flagged-junk:
 *   get:
 *     summary: List posts that have been auto-hidden as junk
 *     tags: [DevAdmin]
 *     security:
 *       - bearerAuth: []
 */
router.get("/flagged-junk", async (_req: Request, res: Response): Promise<void> => {
  const posts = await prisma.experience.findMany({
    where: { status: "HIDDEN_JUNK" },
    orderBy: { junk_flag_count: "desc" },
    take: 50,
    include: {
      author: { select: { ghost_handle: true, hardware_fingerprint_hash: true } },
      college: { select: { name: true } },
    },
  });

  res.json({
    posts: posts.map((p) => ({
      post_id:         p.post_id,
      title:           p.title,
      ghost_handle:    p.author.ghost_handle,
      hardware_fingerprint_hash: p.author.hardware_fingerprint_hash,
      college:         p.college.name,
      junk_flag_count: p.junk_flag_count,
      aye_count:       p.aye_count,
      created_at:      p.created_at,
    })),
  });
});

// ── GET /api/v1/dev-admin/rooms ───────────────────────────────
/**
 * @swagger
 * /dev-admin/rooms:
 *   get:
 *     summary: List all chat rooms across all colleges
 *     tags: [DevAdmin]
 *     security:
 *       - bearerAuth: []
 */
router.get("/rooms", async (_req: Request, res: Response): Promise<void> => {
  const rooms = await prisma.chatRoom.findMany({
    orderBy: { created_at: "desc" },
    include: {
      college: { select: { name: true, slug: true } },
      _count:  { select: { chat_messages: true } },
    },
  });
  res.json({ rooms });
});

// ── POST /api/v1/dev-admin/rooms ──────────────────────────────
/**
 * @swagger
 * /dev-admin/rooms:
 *   post:
 *     summary: Create a chat room for a college (admin only)
 *     tags: [DevAdmin]
 *     security:
 *       - bearerAuth: []
 */
router.post("/rooms", asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { college_id, room_type, name } = req.body as {
    college_id: string;
    room_type:  "GLOBAL" | "BRANCH" | "ISSUE_ROOM";
    name:       string;
  };

  if (!college_id || !room_type || !name) {
    res.status(400).json({ message: "college_id, room_type and name are required" });
    return;
  }

  const college = await prisma.college.findUnique({ where: { college_id } });
  if (!college) { res.status(404).json({ message: "College not found" }); return; }

  const room = await prisma.chatRoom.create({
    data: { college_id, room_type, name: name.trim() },
  });

  res.status(201).json({ room });
}));

// ── DELETE /api/v1/dev-admin/rooms/:roomId ────────────────────
/**
 * @swagger
 * /dev-admin/rooms/{roomId}:
 *   delete:
 *     summary: Delete a chat room
 *     tags: [DevAdmin]
 *     security:
 *       - bearerAuth: []
 */
router.delete("/rooms/:roomId", asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const room = await prisma.chatRoom.findUnique({ where: { room_id: req.params.roomId } });
  if (!room) { res.status(404).json({ message: "Room not found" }); return; }

  // Delete messages first, then room
  await prisma.chatMessage.deleteMany({ where: { room_id: req.params.roomId } });
  await prisma.chatRoom.delete({ where: { room_id: req.params.roomId } });

  res.json({ message: "Room deleted" });
}));

// -- GET /api/v1/dev-admin/issues -----------------------------
// List all experiences across all colleges with crowd proofs
router.get("/issues", asyncHandler(async (_req: Request, res: Response): Promise<void> => {
  const issues = await prisma.experience.findMany({
    where: { status: { not: "HIDDEN_JUNK" } },
    orderBy: { created_at: "desc" },
    take: 200,
    include: {
      college:  { select: { name: true, slug: true } },
      author:   { select: { ghost_handle: true } },
      post_interactions: {
        where: { type: "CROWD_PROOF" },
        select: {
          interaction_id:  true,
          proof_media_url: true,
          comment_text:    true,
          created_at:      true,
          user:            { select: { ghost_handle: true } },
        },
        orderBy: { created_at: "desc" },
      },
    },
  });

  res.json({ issues: issues.map((i) => ({
    post_id:       i.post_id,
    title:         i.title,
    status:        i.status,
    severity:      i.severity,
    category:      i.category,
    aye_count:     i.aye_count,
    college:       i.college.name,
    ghost_handle:  i.hide_handle ? "Verified Campus Ghost" : i.author.ghost_handle,
    created_at:    i.created_at,
    proofs:        i.post_interactions,
  })) });
}));

// -- PATCH /api/v1/dev-admin/issues/:id/status ----------------
// Force-set an issue status (admin override)
router.patch("/issues/:id/status", asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { status, note } = req.body as { status: string; note?: string };
  const validStatuses = ["RESOLVED", "HIDDEN_JUNK", "UNRESOLVED", "TRENDING"];
  if (!validStatuses.includes(status)) {
    res.status(400).json({ message: `status must be one of: ${validStatuses.join(", ")}` });
    return;
  }

  const issue = await prisma.experience.findUnique({ where: { post_id: req.params.id } });
  if (!issue) { res.status(404).json({ message: "Issue not found" }); return; }

  const updated = await prisma.experience.update({
    where: { post_id: req.params.id },
    data: {
      status:      status as import("@prisma/client").ExperienceStatus,
      resolved_at: status === "RESOLVED" ? new Date() : null,
    },
  });

  // Recalculate college grade if resolving
  if (status === "RESOLVED") {
    await prisma.college.update({
      where: { college_id: issue.college_id },
      data: { total_resolved: { increment: 1 } },
    });
    await (await import("../services/grading")).recalculateCollegeGrade(issue.college_id);
  }

  res.json({ issue: updated, note });
}));

export default router;

