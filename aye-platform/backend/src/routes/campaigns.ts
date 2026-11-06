import { asyncHandler } from "../utils/asyncHandler";
/**
 * Campaign Manager routes.
 *
 * ADMIN (DEV_SUPER_ADMIN only):
 *   GET    /api/v1/dev-admin/campaigns          — list all campaigns
 *   POST   /api/v1/dev-admin/campaigns          — create campaign
 *   PATCH  /api/v1/dev-admin/campaigns/:id      — update status/details
 *   DELETE /api/v1/dev-admin/campaigns/:id      — delete campaign
 *   GET    /api/v1/dev-admin/campaigns/:id/submissions — list submissions
 *   PATCH  /api/v1/dev-admin/campaigns/submissions/:subId — approve/reject
 *
 * STUDENT:
 *   GET    /api/v1/campaigns                    — list active campaigns for their college
 *   GET    /api/v1/campaigns/:id                — campaign detail + own submission status
 *   POST   /api/v1/campaigns/:id/submit         — submit problem report (with files)
 */

import { Router, Request, Response } from "express";
import { PrismaClient, CampaignStatus, SubmissionStatus } from "@prisma/client";
import { z } from "zod";
import {
  requireAuth,
  requireActive,
  requireRole,
} from "../middleware/auth";
import { collegeSiloGuard } from "../middleware/collegeSilo";
import { deleteEncryptedFile } from "../services/fileEncryption";
import path from "path";

// ── Sub-routers ───────────────────────────────────────────────
export const adminCampaignRouter  = Router();
export const studentCampaignRouter = Router();

const prisma    = new PrismaClient();
const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR ?? "./uploads");

// ── Schemas ───────────────────────────────────────────────────
// datetime-local inputs send "YYYY-MM-DDTHH:mm" (no seconds/timezone).
// We accept any ISO-ish date string and coerce it ourselves.
const isoDateString = z.string().refine(
  (s) => !isNaN(Date.parse(s)),
  { message: "Invalid date string" }
);

const CreateCampaignSchema = z.object({
  college_id:    z.string().uuid(),
  title:         z.string().min(5).max(140),
  description:   z.string().min(20),
  reward_points: z.number().int().min(1).max(1000).default(10),
  status:        z.enum(["DRAFT", "ACTIVE", "PAUSED", "CLOSED"]).default("DRAFT"),
  starts_at:     isoDateString,
  ends_at:       isoDateString,
});

const UpdateCampaignSchema = z.object({
  title:         z.string().min(5).max(140).optional(),
  description:   z.string().min(20).optional(),
  reward_points: z.number().int().min(1).max(1000).optional(),
  status:        z.enum(["DRAFT", "ACTIVE", "PAUSED", "CLOSED"]).optional(),
  starts_at:     isoDateString.optional(),
  ends_at:       isoDateString.optional(),
});

const SubmitSchema = z.object({
  title:           z.string().min(5).max(140),
  description:     z.string().min(20),
  encrypted_files: z
    .array(
      z.object({
        storedName:   z.string(),
        originalName: z.string(),
        mimeType:     z.string(),
        size:         z.number(),
      })
    )
    .max(10)
    .default([]),
});

const ReviewSchema = z.object({
  status:     z.enum(["APPROVED", "REJECTED"]),
  admin_note: z.string().optional(),
});

// ═════════════════════════════════════════════════════════════
// ADMIN ROUTES
// ═════════════════════════════════════════════════════════════

adminCampaignRouter.use(requireAuth, requireRole("DEV_SUPER_ADMIN"));

// Request logger — logs every incoming admin campaign request
adminCampaignRouter.use((req, _res, next) => {
  console.log(`[Campaign Admin] ${req.method} ${req.path}`, {
    body:   req.body,
    user:   req.user?.ghost_handle ?? "(no user yet)",
  });
  next();
});

// ── GET /api/v1/dev-admin/campaigns ──────────────────────────
/**
 * @swagger
 * /dev-admin/campaigns:
 *   get:
 *     summary: List all campaigns (admin)
 *     tags: [Campaigns]
 *     security:
 *       - bearerAuth: []
 */
adminCampaignRouter.get("/", async (_req: Request, res: Response): Promise<void> => {
  const campaigns = await prisma.campaign.findMany({
    orderBy: { created_at: "desc" },
    include: {
      college:     { select: { name: true, slug: true } },
      _count:      { select: { submissions: true } },
    },
  });
  res.json({ campaigns });
});

// ── POST /api/v1/dev-admin/campaigns ─────────────────────────
/**
 * @swagger
 * /dev-admin/campaigns:
 *   post:
 *     summary: Create a new campaign
 *     tags: [Campaigns]
 *     security:
 *       - bearerAuth: []
 */
adminCampaignRouter.post("/", asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const parsed = CreateCampaignSchema.safeParse(req.body);
  if (!parsed.success) {
    const flat = parsed.error.flatten();
    // Build a readable message from field errors
    const fieldMsgs = Object.entries(flat.fieldErrors)
      .map(([f, msgs]) => `${f}: ${(msgs ?? []).join(", ")}`)
      .join(" | ");
    const message = fieldMsgs || "Validation error";
    console.error("[Campaign Admin] Validation failed:", flat);
    res.status(400).json({ message, errors: flat });
    return;
  }

  const college = await prisma.college.findUnique({ where: { college_id: parsed.data.college_id } });
  if (!college) { res.status(404).json({ message: "College not found" }); return; }

  if (new Date(parsed.data.starts_at) >= new Date(parsed.data.ends_at)) {
    res.status(400).json({ message: "starts_at must be before ends_at" });
    return;
  }

  const campaign = await prisma.campaign.create({
    data: {
      college_id:    parsed.data.college_id,
      title:         parsed.data.title,
      description:   parsed.data.description,
      reward_points: parsed.data.reward_points,
      status:        parsed.data.status as CampaignStatus,
      starts_at:     new Date(parsed.data.starts_at),
      ends_at:       new Date(parsed.data.ends_at),
      created_by:    req.user!.user_id,
    },
    include: { college: { select: { name: true, slug: true } } },
  });

  res.status(201).json({ campaign });
}));

// ── PATCH /api/v1/dev-admin/campaigns/:id ────────────────────
adminCampaignRouter.patch("/:id", asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const parsed = UpdateCampaignSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Validation error", errors: parsed.error.flatten() });
    return;
  }

  const campaign = await prisma.campaign.findUnique({ where: { campaign_id: req.params.id } });
  if (!campaign) { res.status(404).json({ message: "Campaign not found" }); return; }

  const updated = await prisma.campaign.update({
    where: { campaign_id: req.params.id },
    data: {
      ...(parsed.data.title         && { title:         parsed.data.title }),
      ...(parsed.data.description   && { description:   parsed.data.description }),
      ...(parsed.data.reward_points && { reward_points: parsed.data.reward_points }),
      ...(parsed.data.status        && { status:        parsed.data.status as CampaignStatus }),
      ...(parsed.data.starts_at     && { starts_at:     new Date(parsed.data.starts_at) }),
      ...(parsed.data.ends_at       && { ends_at:       new Date(parsed.data.ends_at) }),
    },
    include: { college: { select: { name: true, slug: true } }, _count: { select: { submissions: true } } },
  });

  res.json({ campaign: updated });
}));

// ── DELETE /api/v1/dev-admin/campaigns/:id ───────────────────
adminCampaignRouter.delete("/:id", asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const campaign = await prisma.campaign.findUnique({
    where:   { campaign_id: req.params.id },
    include: { submissions: true },
  });
  if (!campaign) { res.status(404).json({ message: "Campaign not found" }); return; }

  // Delete encrypted files from disk for all submissions
  for (const sub of campaign.submissions) {
    const files = sub.encrypted_files as { storedName: string }[];
    for (const f of files) {
      await deleteEncryptedFile(f.storedName, UPLOAD_DIR);
    }
  }

  await prisma.campaign.delete({ where: { campaign_id: req.params.id } });
  res.json({ message: "Campaign and all submissions deleted" });
}));

// ── GET /api/v1/dev-admin/campaigns/:id/submissions ──────────
/**
 * @swagger
 * /dev-admin/campaigns/{id}/submissions:
 *   get:
 *     summary: List all submissions for a campaign
 *     tags: [Campaigns]
 *     security:
 *       - bearerAuth: []
 */
adminCampaignRouter.get("/:id/submissions", asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const campaign = await prisma.campaign.findUnique({ where: { campaign_id: req.params.id } });
  if (!campaign) { res.status(404).json({ message: "Campaign not found" }); return; }

  const submissions = await prisma.campaignSubmission.findMany({
    where:   { campaign_id: req.params.id },
    orderBy: { submitted_at: "desc" },
    include: {
      submitter: { select: { ghost_handle: true, trust_score: true } },
    },
  });

  res.json({ submissions });
}));

// ── PATCH /api/v1/dev-admin/campaigns/submissions/:subId ─────
/**
 * @swagger
 * /dev-admin/campaigns/submissions/{subId}:
 *   patch:
 *     summary: Approve or reject a campaign submission (and grant/deny rewards)
 *     tags: [Campaigns]
 *     security:
 *       - bearerAuth: []
 */
adminCampaignRouter.patch("/submissions/:subId", asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const parsed = ReviewSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Validation error", errors: parsed.error.flatten() });
    return;
  }

  const sub = await prisma.campaignSubmission.findUnique({
    where:   { submission_id: req.params.subId },
    include: { campaign: true },
  });
  if (!sub) { res.status(404).json({ message: "Submission not found" }); return; }
  if (sub.status !== "PENDING") {
    res.status(409).json({ message: "Submission already reviewed" });
    return;
  }

  const isApproved = parsed.data.status === "APPROVED";

  const [updated] = await prisma.$transaction([
    prisma.campaignSubmission.update({
      where: { submission_id: req.params.subId },
      data:  {
        status:         parsed.data.status as SubmissionStatus,
        admin_note:     parsed.data.admin_note ?? null,
        reward_granted: isApproved,
        reviewed_at:    new Date(),
      },
    }),
    // Grant reward points to the student if approved
    ...(isApproved
      ? [
          prisma.user.update({
            where: { user_id: sub.submitted_by },
            data:  { reward_points: { increment: sub.campaign.reward_points } },
          }),
        ]
      : []),
  ]);

  res.json({ submission: updated });
}));

// ═════════════════════════════════════════════════════════════
// STUDENT ROUTES
// ═════════════════════════════════════════════════════════════

studentCampaignRouter.use(requireAuth, requireActive, collegeSiloGuard);

// ── GET /api/v1/campaigns ─────────────────────────────────────
/**
 * @swagger
 * /campaigns:
 *   get:
 *     summary: List active campaigns for the student's college
 *     tags: [Campaigns]
 *     security:
 *       - bearerAuth: []
 */
studentCampaignRouter.get("/", asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const now = new Date();
  const campaigns = await prisma.campaign.findMany({
    where: {
      college_id: req.user!.college_id,
      status:     "ACTIVE",
      starts_at:  { lte: now },
      ends_at:    { gte: now },
    },
    orderBy: { ends_at: "asc" },
    include: {
      _count: { select: { submissions: true } },
    },
  });

  res.json({ campaigns });
}));

// ── GET /api/v1/campaigns/:id ─────────────────────────────────
studentCampaignRouter.get("/:id", asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const campaign = await prisma.campaign.findUnique({
    where:   { campaign_id: req.params.id },
    include: { college: { select: { name: true } }, _count: { select: { submissions: true } } },
  });
  if (!campaign) { res.status(404).json({ message: "Campaign not found" }); return; }
  if (campaign.college_id !== req.user!.college_id) {
    res.status(403).json({ message: "Access denied" }); return;
  }

  // Check if the student has already submitted
  const ownSubmission = await prisma.campaignSubmission.findFirst({
    where: { campaign_id: req.params.id, submitted_by: req.user!.user_id },
    select: { submission_id: true, status: true, reward_granted: true, submitted_at: true },
  });

  res.json({ campaign, own_submission: ownSubmission });
}));

// ── POST /api/v1/campaigns/:id/submit ────────────────────────
/**
 * @swagger
 * /campaigns/{id}/submit:
 *   post:
 *     summary: Submit a problem report to a campaign
 *     tags: [Campaigns]
 *     security:
 *       - bearerAuth: []
 */
studentCampaignRouter.post("/:id/submit", asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const parsed = SubmitSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Validation error", errors: parsed.error.flatten() });
    return;
  }

  const campaign = await prisma.campaign.findUnique({ where: { campaign_id: req.params.id } });
  if (!campaign) { res.status(404).json({ message: "Campaign not found" }); return; }
  if (campaign.college_id !== req.user!.college_id) {
    res.status(403).json({ message: "Access denied" }); return;
  }

  // Campaign must be ACTIVE and within date window
  const now = new Date();
  if (campaign.status !== "ACTIVE" || now < campaign.starts_at || now > campaign.ends_at) {
    res.status(400).json({ message: "Campaign is not currently accepting submissions" });
    return;
  }

  // One submission per student per campaign
  const existing = await prisma.campaignSubmission.findFirst({
    where: { campaign_id: req.params.id, submitted_by: req.user!.user_id },
  });
  if (existing) {
    res.status(409).json({ message: "You have already submitted to this campaign" });
    return;
  }

  const submission = await prisma.campaignSubmission.create({
    data: {
      campaign_id:     req.params.id,
      submitted_by:    req.user!.user_id,
      title:           parsed.data.title,
      description:     parsed.data.description,
      encrypted_files: parsed.data.encrypted_files,
    },
  });

  res.status(201).json({ submission });
}));




