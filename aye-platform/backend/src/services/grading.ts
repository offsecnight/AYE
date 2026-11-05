import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/** Map resolution_rate percentage to A–F grade */
export function calculateGrade(rate: number): string {
  if (rate >= 85) return "A";
  if (rate >= 70) return "B";
  if (rate >= 50) return "C";
  if (rate >= 35) return "D";
  return "F";
}

/**
 * Recalculate and persist a college's resolution_rate and reality_grade.
 * Applies penalty for overdue issues (unresolved > 7 days with > 25 AYEs).
 */
export async function recalculateCollegeGrade(college_id: string): Promise<void> {
  const [total, resolved, overdue] = await Promise.all([
    prisma.experience.count({ where: { college_id } }),
    prisma.experience.count({ where: { college_id, status: "RESOLVED" } }),
    // Overdue: UNRESOLVED or TRENDING, older than 7 days, with 25+ AYEs
    prisma.experience.count({
      where: {
        college_id,
        status: { in: ["UNRESOLVED", "TRENDING"] },
        aye_count: { gte: 25 },
        created_at: {
          lte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        },
      },
    }),
  ]);

  if (total === 0) return;

  // Base rate
  let rate = (resolved / total) * 100;

  // Penalty: each overdue high-impact issue deducts 2 points (capped at 20)
  const penalty = Math.min(overdue * 2, 20);
  rate = Math.max(0, rate - penalty);

  const grade = calculateGrade(rate);

  await prisma.college.update({
    where: { college_id },
    data: {
      resolution_rate: parseFloat(rate.toFixed(2)),
      reality_grade: grade,
      total_experiences: total,
      total_resolved: resolved,
    },
  });
}
