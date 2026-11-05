import { UserRole, AccountStatus } from "@prisma/client";

// JWT payload attached to req.user after auth middleware
export interface JWTPayload {
  user_id: string;
  college_id: string;
  ghost_handle: string;
  role: UserRole;
  account_status: AccountStatus;
  iat?: number;
  exp?: number;
}

// Augment Express Request to carry authenticated user
declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload;
    }
  }
}

export interface GpsVerifyResult {
  valid: boolean;
  college_id: string;
  token?: string; // short-lived GPS proof token
}

export interface RegistrationResult {
  jwt: string;
  ghost_handle: string;
  secret_recovery_key: string; // plain text — shown once, never stored plain
}
