/**
 * Wraps an async Express route handler so that any thrown error or
 * rejected promise is forwarded to next(err) instead of crashing
 * the process or causing a silent hang.
 *
 * Express 4 does NOT automatically catch async errors — this utility
 * bridges that gap for every route.
 */
import { Request, Response, NextFunction } from "express";

type AsyncHandler = (
  req:  Request,
  res:  Response,
  next: NextFunction
) => Promise<void>;

export function asyncHandler(fn: AsyncHandler) {
  return (req: Request, res: Response, next: NextFunction): void => {
    fn(req, res, next).catch((err: unknown) => {
      console.error("[AsyncHandler] Unhandled error:", err);
      next(err);
    });
  };
}
