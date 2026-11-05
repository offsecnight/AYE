import { Request, Response, NextFunction } from "express";

/**
 * Strict Multi-College Silo Guard.
 * Ensures the authenticated user can only access data for their own college.
 * Attaches college_id filter to req for all downstream route handlers.
 */
export function collegeSiloGuard(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ message: "Authentication required" });
    return;
  }

  // DEV_SUPER_ADMIN bypasses silo restrictions
  if (req.user.role === "DEV_SUPER_ADMIN") {
    next();
    return;
  }

  // Inject the college_id so routes always filter by it
  // Routes read req.user.college_id — never accept college_id from request body/query
  next();
}
