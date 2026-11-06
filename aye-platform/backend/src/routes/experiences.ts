import { Router, Request, Response, NextFunction } from "express";
import express from "express";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { requireActive } from "../middleware/auth";
import { collegeSiloGuard } from "../middleware/collegeSilo";
import { runAntiTrollCheck } from "../services/antiTroll";
import { checkTrendingEscalation } from "../services/trending";
import { recalculateCollegeGrade } from "../services/grading";

const router = Router();
const prisma = new PrismaClient();

// All experience routes require auth + active account + silo guard
router.use(requireAuth, requireActive, collegeSiloGuard);

// ── Async error wrapper ───────────────────────────────────────
// Express 4 doesn't catch async throws automatically.
// Wrap every handler so errors get forwarded to the global error handler
// instead of crashing the process.
function asyncHandler(
  fn: (req: Request, res: Response, next: express.NextFunction) => Promise<void>
) {
  return (req: Request, res: Response, next: express.NextFunction) => {
    fn(req, res, next).catch(next);
  };
}

const CreateSchema = z.object({
  title:          z.string().min(5).max(140),
  what_is_wrong:  z.string().min(20),
  exact_location: z.string().min(3),
  impact_scope:   z.string().min(3),
  category:       z.enum(["HOSTEL","MESS_FOOD","LABS_WIFI","FEES_ADMIN","FACULTY","INFRASTRUCTURE","SAFETY"]),
  severity:       z.enum(["NORMAL","HIGH","CRITICAL"]).default("NORMAL"),
  hide_handle:    z.boolean().default(false),
  // Accept any string — could be an absolute URL or a /api/proxy/files/... path
  media_urls:     z.array(z.string().min(1)).max(10).default([]),
});

// ── GET /api/v1/experiences ───────────────────────────────────
/**
 * @swagger
 * /experiences:
 *   get:
 *     summary: List experiences for authenticated user's college
 *     tags: [Experiences]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string }
 *       - in: query
 *         name: category
 *         schema: { type: string }
 *       - in: query
 *         name: sort
 *         schema: { type: string, enum: [ayes, newest, oldest_unresolved] }
 */
router.get("/", asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { status, category, sort = "ayes" } = req.query as Record<string, string>;
  const college_id = req.user!.college_id;

  const where: Record<string, unknown> = { college_id };
  if (status)   where.status   = status;
  if (category) where.category = category;
  // Never show hidden junk to regular queries
  if (!status) where.status = { not: "HIDDEN_JUNK" };

  const orderBy =
    sort === "newest"            ? { created_at: "desc" as const } :
    sort === "oldest_unresolved" ? { created_at: "asc" as const }  :
                                   { aye_count:  "desc" as const };

  const experiences = await prisma.experience.findMany({
    where,
    orderBy,
    include: {
      author: { select: { ghost_handle: true, trust_score: true } },
    },
    take: 50,
  });

  // Mask author handle if hide_handle is true
  const masked = experiences.map((e) => ({
    ...e,
    ghost_handle: e.hide_handle ? "Verified Campus Ghost" : e.author.ghost_handle,
    author: undefined,
  }));

  res.json({ experiences: masked });
}));

// ── POST /api/v1/experiences ──────────────────────────────────
/**
 * @swagger
 * /experiences:
 *   post:
 *     summary: Drop a new experience (structured problem post)
 *     tags: [Experiences]
 *     security:
 *       - bearerAuth: []
 */
router.post("/", asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const parsed = CreateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Validation error", errors: parsed.error.flatten() });
    return;
  }

  const user = req.user!;
  const experience = await prisma.experience.create({
    data: {
      ...parsed.data,
      college_id: user.college_id,
      author_id:  user.user_id,
      aye_count:  1, // author implicitly AYEs their own post
    },
  });

  // Increment college total_experiences
  await prisma.college.update({
    where: { college_id: user.college_id },
    data: { total_experiences: { increment: 1 } },
  });

  res.status(201).json({ experience });
}));

// ── GET /api/v1/experiences/:id ───────────────────────────────
/**
 * @swagger
 * /experiences/{id}:
 *   get:
 *     summary: Get full experience details with interactions and active poll
 *     tags: [Experiences]
 *     security:
 *       - bearerAuth: []
 */
router.get("/:id", asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const post = await prisma.experience.findUnique({
    where: { post_id: req.params.id },
    include: {
      author: { select: { ghost_handle: true } },
      post_interactions: {
        where: { type: { in: ["CROWD_PROOF"] } },
        take: 20,
      },
      resolution_polls: {
        where: { poll_status: "ACTIVE" },
        take: 1,
      },
    },
  });

  if (!post) { res.status(404).json({ message: "Not found" }); return; }

  // Enforce college silo
  if (post.college_id !== req.user!.college_id && req.user!.role !== "DEV_SUPER_ADMIN") {
    res.status(403).json({ message: "Access denied" });
    return;
  }

  res.json({
    ...post,
    ghost_handle: post.hide_handle ? "Verified Campus Ghost" : post.author.ghost_handle,
    author: undefined,
  });
}));

// ── POST /api/v1/experiences/:id/aye ─────────────────────────
/**
 * @swagger
 * /experiences/{id}/aye:
 *   post:
 *     summary: Toggle AYE upvote
 *     tags: [Experiences]
 *     security:
 *       - bearerAuth: []
 */
router.post("/:id/aye", asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const user_id = req.user!.user_id;
  const post_id = req.params.id;

  const post = await prisma.experience.findUnique({ where: { post_id } });
  if (!post) { res.status(404).json({ message: "Not found" }); return; }
  if (post.college_id !== req.user!.college_id) { res.status(403).json({ message: "Access denied" }); return; }

  const existing = await prisma.postInteraction.findUnique({
    where: { unique_vote_per_user: { post_id, user_id, type: "AYE_VOTE" } },
  });

  if (existing) {
    // Toggle off
    await prisma.postInteraction.delete({ where: { interaction_id: existing.interaction_id } });
    await prisma.experience.update({ where: { post_id }, data: { aye_count: { decrement: 1 } } });
    res.json({ action: "removed", aye_count: post.aye_count - 1 });
    return;
  }

  // Add AYE
  await prisma.postInteraction.create({ data: { post_id, user_id, type: "AYE_VOTE" } });
  const updated = await prisma.experience.update({
    where: { post_id },
    data: { aye_count: { increment: 1 } },
  });

  // Check trending escalation
  await checkTrendingEscalation(post_id);

  res.json({ action: "added", aye_count: updated.aye_count });
}));

// ── POST /api/v1/experiences/:id/flag-junk ────────────────────
/**
 * @swagger
 * /experiences/{id}/flag-junk:
 *   post:
 *     summary: Flag a post as junk/joke
 *     tags: [Experiences]
 *     security:
 *       - bearerAuth: []
 */
router.post("/:id/flag-junk", asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const user_id = req.user!.user_id;
  const post_id = req.params.id;

  const post = await prisma.experience.findUnique({ where: { post_id } });
  if (!post) { res.status(404).json({ message: "Not found" }); return; }
  if (post.college_id !== req.user!.college_id) { res.status(403).json({ message: "Access denied" }); return; }
  if (post.author_id === user_id) { res.status(400).json({ message: "Cannot flag your own post" }); return; }

  const existing = await prisma.postInteraction.findUnique({
    where: { unique_vote_per_user: { post_id, user_id, type: "JUNK_FLAG" } },
  });
  if (existing) { res.status(409).json({ message: "Already flagged" }); return; }

  await prisma.postInteraction.create({ data: { post_id, user_id, type: "JUNK_FLAG" } });
  const updated = await prisma.experience.update({
    where: { post_id },
    data: { junk_flag_count: { increment: 1 } },
  });

  // Run anti-troll check
  await runAntiTrollCheck(post_id);

  res.json({ junk_flag_count: updated.junk_flag_count });
}));

// ── POST /api/v1/experiences/:id/crowd-proof ─────────────────
/**
 * @swagger
 * /experiences/{id}/crowd-proof:
 *   post:
 *     summary: Attach additional student evidence to a post
 *     tags: [Experiences]
 *     security:
 *       - bearerAuth: []
 */
router.post("/:id/crowd-proof", asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { proof_media_url, comment_text } = req.body as {
    proof_media_url?: string;
    comment_text?: string;
  };

  const post = await prisma.experience.findUnique({ where: { post_id: req.params.id } });
  if (!post) { res.status(404).json({ message: "Not found" }); return; }
  if (post.college_id !== req.user!.college_id) { res.status(403).json({ message: "Access denied" }); return; }

  const interaction = await prisma.postInteraction.create({
    data: {
      post_id:         req.params.id,
      user_id:         req.user!.user_id,
      type:            "CROWD_PROOF",
      proof_media_url: proof_media_url ?? null,
      comment_text:    comment_text ?? null,
    },
  });

  res.status(201).json({ interaction });
}));

// ── POST /api/v1/experiences/:id/propose-fix ─────────────────
/**
 * @swagger
 * /experiences/{id}/propose-fix:
 *   post:
 *     summary: Propose that an issue is resolved (starts community poll)
 *     tags: [Experiences]
 *     security:
 *       - bearerAuth: []
 */
router.post("/:id/propose-fix", asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { fix_proof_media_url, fix_note } = req.body as {
    fix_proof_media_url: string;
    fix_note?: string;
  };

  if (!fix_proof_media_url) {
    res.status(400).json({ message: "fix_proof_media_url is required" });
    return;
  }

  const post = await prisma.experience.findUnique({ where: { post_id: req.params.id } });
  if (!post) { res.status(404).json({ message: "Not found" }); return; }
  if (post.college_id !== req.user!.college_id) { res.status(403).json({ message: "Access denied" }); return; }
  if (!["UNRESOLVED", "TRENDING"].includes(post.status)) {
    res.status(400).json({ message: "Post is not in a resolvable state" });
    return;
  }

  // Check no active poll already exists
  const activePoll = await prisma.resolutionPoll.findFirst({
    where: { post_id: req.params.id, poll_status: "ACTIVE" },
  });
  if (activePoll) { res.status(409).json({ message: "An active resolution poll already exists" }); return; }

  const expires_at = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours

  const [poll] = await prisma.$transaction([
    prisma.resolutionPoll.create({
      data: {
        post_id:              req.params.id,
        proposed_by_user_id:  req.user!.user_id,
        fix_proof_media_url,
        fix_note:             fix_note ?? null,
        expires_at,
      },
    }),
    prisma.experience.update({
      where: { post_id: req.params.id },
      data: { status: "FIX_PROPOSED" },
    }),
  ]);

  res.status(201).json({ poll });
}));

// ── POST /api/v1/experiences/:id/vote-fix ────────────────────
/**
 * @swagger
 * /experiences/{id}/vote-fix:
 *   post:
 *     summary: Vote YES or NO on an active resolution poll
 *     tags: [Experiences]
 *     security:
 *       - bearerAuth: []
 */
router.post("/:id/vote-fix", asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { vote } = req.body as { vote: "YES" | "NO" };
  if (!["YES", "NO"].includes(vote)) {
    res.status(400).json({ message: "vote must be YES or NO" });
    return;
  }

  const post = await prisma.experience.findUnique({ where: { post_id: req.params.id } });
  if (!post) { res.status(404).json({ message: "Not found" }); return; }
  if (post.college_id !== req.user!.college_id) { res.status(403).json({ message: "Access denied" }); return; }

  // Only previous AYE voters can vote on resolution
  const hasAyed = await prisma.postInteraction.findUnique({
    where: { unique_vote_per_user: { post_id: req.params.id, user_id: req.user!.user_id, type: "AYE_VOTE" } },
  });
  if (!hasAyed) {
    res.status(403).json({ message: "Only users who AYEd this post can vote on its resolution" });
    return;
  }

  const poll = await prisma.resolutionPoll.findFirst({
    where: { post_id: req.params.id, poll_status: "ACTIVE" },
  });
  if (!poll) { res.status(404).json({ message: "No active poll found" }); return; }

  // Cast vote
  const updatedPoll = await prisma.resolutionPoll.update({
    where: { poll_id: poll.poll_id },
    data:  vote === "YES"
      ? { yes_fixed_votes: { increment: 1 } }
      : { no_broken_votes: { increment: 1 } },
  });

  const total = updatedPoll.yes_fixed_votes + updatedPoll.no_broken_votes;
  const expired = new Date() >= updatedPoll.expires_at;

  // Resolve poll if threshold met (10 votes or expired)
  if (total >= 10 || expired) {
    const yesPct = (updatedPoll.yes_fixed_votes / total) * 100;

    if (yesPct >= 70) {
      // RESOLVED
      await prisma.$transaction([
        prisma.resolutionPoll.update({
          where: { poll_id: poll.poll_id },
          data: { poll_status: "APPROVED_RESOLVED" },
        }),
        prisma.experience.update({
          where: { post_id: req.params.id },
          data: { status: "RESOLVED", resolved_at: new Date() },
        }),
      ]);
      await recalculateCollegeGrade(post.college_id);
      res.json({ result: "RESOLVED", yes_pct: yesPct.toFixed(1) });
    } else {
      // Rejected
      await prisma.$transaction([
        prisma.resolutionPoll.update({
          where: { poll_id: poll.poll_id },
          data: { poll_status: "REJECTED_STILL_BROKEN" },
        }),
        prisma.experience.update({
          where: { post_id: req.params.id },
          data: { status: post.status === "FIX_PROPOSED" ? "UNRESOLVED" : post.status },
        }),
      ]);
      res.json({ result: "REJECTED", yes_pct: yesPct.toFixed(1) });
    }
    return;
  }

  res.json({ votes_cast: total, yes_fixed_votes: updatedPoll.yes_fixed_votes, no_broken_votes: updatedPoll.no_broken_votes });
}));

export default router;


