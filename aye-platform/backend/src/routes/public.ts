import { asyncHandler } from "../utils/asyncHandler";
import { Router, Request, Response } from "express";
import { PrismaClient } from "@prisma/client";

const router = Router();
const prisma = new PrismaClient();

// ── GET /api/v1/public/scoreboard/:collegeSlug ────────────────
/**
 * @swagger
 * /public/scoreboard/{collegeSlug}:
 *   get:
 *     summary: Public college accountability data (SEO-accessible)
 *     tags: [Public]
 *     parameters:
 *       - in: path
 *         name: collegeSlug
 *         required: true
 *         schema: { type: string }
 */
router.get("/scoreboard/:collegeSlug", asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const college = await prisma.college.findUnique({
    where: { slug: req.params.collegeSlug },
  });
  if (!college) { res.status(404).json({ message: "College not found" }); return; }

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [trending, longestIgnored] = await Promise.all([
    prisma.experience.findMany({
      where: { college_id: college.college_id, status: "TRENDING" },
      orderBy: { aye_count: "desc" },
      take: 5,
      select: {
        post_id: true, title: true, category: true,
        aye_count: true, status: true, created_at: true,
        hide_handle: true,
        author: { select: { ghost_handle: true } },
      },
    }),
    prisma.experience.findMany({
      where: {
        college_id: college.college_id,
        status: { in: ["UNRESOLVED", "TRENDING"] },
        created_at: { lte: sevenDaysAgo },
      },
      orderBy: { created_at: "asc" },
      take: 5,
      select: {
        post_id: true, title: true, category: true,
        aye_count: true, status: true, created_at: true,
        hide_handle: true,
        author: { select: { ghost_handle: true } },
      },
    }),
  ]);

  const maskHandle = (p: { hide_handle: boolean; author: { ghost_handle: string } }) =>
    p.hide_handle ? "Verified Campus Ghost" : p.author.ghost_handle;

  res.json({
    college: {
      name: college.name, slug: college.slug, city: college.city,
      reality_grade: college.reality_grade,
      resolution_rate: college.resolution_rate,
      total_experiences: college.total_experiences,
      total_resolved: college.total_resolved,
    },
    trending:        trending.map((p) => ({ ...p, ghost_handle: maskHandle(p), author: undefined })),
    longest_ignored: longestIgnored.map((p) => ({ ...p, ghost_handle: maskHandle(p), author: undefined })),
  });
}));

export default router;



