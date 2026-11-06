import { asyncHandler } from "../utils/asyncHandler";
import { Router, Request, Response } from "express";
import { PrismaClient, VerificationMethod } from "@prisma/client";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { signToken } from "../middleware/auth";
import { isFingerprintBanned } from "../services/fingerprint";
import { verifyGpsProximity, verifyGpsToken } from "../services/gps";

const router = Router();
const prisma = new PrismaClient();

// ── Helpers ───────────────────────────────────────────────────
function generateRecoveryKey(): string {
  // 12 alphanum chars formatted as XXX-XXX-XXX-XXX
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const raw = Array.from({ length: 12 }, () =>
    chars[Math.floor(Math.random() * chars.length)]
  ).join("");
  return `${raw.slice(0, 3)}-${raw.slice(3, 6)}-${raw.slice(6, 9)}-${raw.slice(9, 12)}`;
}

function generateOtpCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// ── Schemas ───────────────────────────────────────────────────
const RegisterSchema = z.object({
  college_id:               z.string().uuid(),
  ghost_handle:             z.string().min(3).max(30).regex(/^[A-Za-z0-9_]+$/),
  password:                 z.string().min(8).max(128),
  course_branch:            z.string().min(2).max(80),
  study_year:               z.number().int().min(1).max(6),
  hardware_fingerprint_hash: z.string().length(64),
  otp_code:                 z.string().length(6).optional(),
  gps_token:                z.string().optional(),
});

const LoginSchema = z.object({
  ghost_handle:              z.string(),
  password:                  z.string(),
  hardware_fingerprint_hash: z.string().length(64),
});

const RecoverSchema = z.object({
  ghost_handle:  z.string(),
  recovery_key:  z.string(),
  new_password:  z.string().min(8).max(128),
});

// ── GET /api/v1/colleges — public ─────────────────────────────
/**
 * @swagger
 * /colleges:
 *   get:
 *     summary: List all colleges with reality scores
 *     tags: [Public]
 *     responses:
 *       200:
 *         description: Array of colleges
 */
router.get("/colleges", async (_req: Request, res: Response) => {
  const colleges = await prisma.college.findMany({
    orderBy: { resolution_rate: "desc" },
    select: {
      college_id: true, name: true, slug: true, city: true,
      reality_grade: true, resolution_rate: true,
      total_experiences: true, total_resolved: true,
    },
  });
  res.json({ colleges });
});

// ── POST /api/v1/auth/generate-otp ───────────────────────────
/**
 * @swagger
 * /auth/generate-otp:
 *   post:
 *     summary: Generate a 2-minute classmate OTP (auth required)
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 */
router.post("/auth/generate-otp", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const user = req.user!;

  // Fetch fresh trust_score from DB to validate
  const dbUser = await prisma.user.findUnique({ where: { user_id: user.user_id } });
  if (!dbUser || dbUser.trust_score < 50) {
    res.status(403).json({ message: "Trust score too low to generate OTPs" });
    return;
  }

  const code = generateOtpCode();
  const expires_at = new Date(Date.now() + 120_000); // 2 minutes

  const otp = await prisma.campusOtp.create({
    data: {
      college_id:           user.college_id,
      generated_by_user_id: user.user_id,
      otp_code:             code,
      expires_at,
    },
  });

  res.json({ otp_code: otp.otp_code, expires_at: otp.expires_at });
});

// ── POST /api/v1/auth/verify-gps ─────────────────────────────
/**
 * @swagger
 * /auth/verify-gps:
 *   post:
 *     summary: Validate GPS coordinates against college geofence
 *     tags: [Auth]
 */
router.post("/auth/verify-gps", asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { college_id, lat, lng } = req.body as {
    college_id: string;
    lat: number;
    lng: number;
  };

  if (!college_id || lat === undefined || lng === undefined) {
    res.status(400).json({ message: "college_id, lat, lng required" });
    return;
  }

  const college = await prisma.college.findUnique({ where: { college_id } });
  if (!college) {
    res.status(404).json({ message: "College not found" });
    return;
  }

  const result = verifyGpsProximity(
    lat, lng,
    college.gps_lat, college.gps_lng,
    college.geofence_radius_meters,
    college_id
  );

  if (!result.valid) {
    res.status(400).json({
      message: `You are ${result.distance_meters}m away from campus. Must be within ${college.geofence_radius_meters}m.`,
      distance_meters: result.distance_meters,
    });
    return;
  }

  res.json({ valid: true, gps_token: result.gps_token, distance_meters: result.distance_meters });
}));

// ── POST /api/v1/auth/register ────────────────────────────────
/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Register new Zero-PII ghost account
 *     tags: [Auth]
 */
router.post("/auth/register", asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const parsed = RegisterSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Validation error", errors: parsed.error.flatten() });
    return;
  }

  const data = parsed.data;

  // Check fingerprint not banned
  if (await isFingerprintBanned(data.hardware_fingerprint_hash)) {
    res.status(403).json({ message: "Device is permanently banned from AYE Platform" });
    return;
  }

  // Check ghost handle availability
  const existing = await prisma.user.findUnique({ where: { ghost_handle: data.ghost_handle } });
  if (existing) {
    res.status(409).json({ message: "Ghost handle already taken" });
    return;
  }

  // Check fingerprint not already registered
  const fpExists = await prisma.user.findUnique({
    where: { hardware_fingerprint_hash: data.hardware_fingerprint_hash },
  });
  if (fpExists) {
    res.status(409).json({ message: "A ghost account already exists on this device" });
    return;
  }

  // Campus verification
  let verification_method: VerificationMethod;
  let invited_by_user_id: string | undefined;

  if (data.otp_code) {
    // Classmate OTP path
    const otp = await prisma.campusOtp.findFirst({
      where: {
        otp_code:   data.otp_code,
        college_id: data.college_id,
        is_used:    false,
        expires_at: { gte: new Date() },
      },
    });
    if (!otp) {
      res.status(400).json({ message: "Invalid or expired OTP" });
      return;
    }

    // Mark OTP as used
    await prisma.campusOtp.update({
      where: { otp_id: otp.otp_id },
      data: { is_used: true },
    });

    verification_method   = VerificationMethod.CLASSMATE_OTP;
    invited_by_user_id    = otp.generated_by_user_id;

  } else if (data.gps_token) {
    // Campus GPS path
    const gpsResult = verifyGpsToken(data.gps_token);
    if (!gpsResult || gpsResult.college_id !== data.college_id) {
      res.status(400).json({ message: "Invalid GPS verification token" });
      return;
    }
    verification_method = VerificationMethod.CAMPUS_GPS;

  } else {
    res.status(400).json({ message: "Either otp_code or gps_token is required" });
    return;
  }

  // Hash password and generate recovery key
  const [password_hash, recovery_key_plain] = await Promise.all([
    bcrypt.hash(data.password, 12),
    Promise.resolve(generateRecoveryKey()),
  ]);
  const recovery_key_hash = await bcrypt.hash(recovery_key_plain, 12);

  // Create user
  const user = await prisma.user.create({
    data: {
      college_id:                data.college_id,
      ghost_handle:              data.ghost_handle,
      password_hash,
      recovery_key_hash,
      course_branch:             data.course_branch,
      study_year:                data.study_year,
      verification_method,
      invited_by_user_id:        invited_by_user_id ?? null,
      hardware_fingerprint_hash: data.hardware_fingerprint_hash,
    },
  });

  const token = signToken({
    user_id:        user.user_id,
    college_id:     user.college_id,
    ghost_handle:   user.ghost_handle,
    role:           user.role,
    account_status: user.account_status,
  });

  // Set HttpOnly cookie + return token + recovery key (shown once)
  res
    .cookie("aye_token", token, { httpOnly: true, sameSite: "lax", maxAge: 7 * 86400_000 })
    .status(201)
    .json({
      token,
      ghost_handle:       user.ghost_handle,
      secret_recovery_key: recovery_key_plain, // plaintext shown once, never stored
    });
}));

// ── POST /api/v1/auth/login ───────────────────────────────────
/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Login with ghost_handle + password + hardware fingerprint
 *     tags: [Auth]
 */
router.post("/auth/login", asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const parsed = LoginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Validation error", errors: parsed.error.flatten() });
    return;
  }

  const { ghost_handle, password, hardware_fingerprint_hash } = parsed.data;

  // Check fingerprint ban first
  if (await isFingerprintBanned(hardware_fingerprint_hash)) {
    res.status(403).json({ message: "Device is permanently banned from AYE Platform" });
    return;
  }

  const user = await prisma.user.findUnique({ where: { ghost_handle } });
  if (!user) {
    res.status(401).json({ message: "Invalid credentials" });
    return;
  }

  // Also check the user's own fingerprint (in case of device change attempt after ban)
  if (await isFingerprintBanned(user.hardware_fingerprint_hash)) {
    res.status(403).json({ message: "Account permanently banned" });
    return;
  }

  if (user.account_status === "BANNED_TROLL") {
    res.status(403).json({ message: "Account permanently banned" });
    return;
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    res.status(401).json({ message: "Invalid credentials" });
    return;
  }

  const token = signToken({
    user_id:        user.user_id,
    college_id:     user.college_id,
    ghost_handle:   user.ghost_handle,
    role:           user.role,
    account_status: user.account_status,
  });

  res
    .cookie("aye_token", token, { httpOnly: true, sameSite: "lax", maxAge: 7 * 86400_000 })
    .json({
      token,
      ghost_handle:   user.ghost_handle,
      college_id:     user.college_id,
      role:           user.role,
      trust_score:    user.trust_score,
      strike_count:   user.strike_count,
    });
}));

// ── GET /api/v1/auth/me ───────────────────────────────────────
/**
 * @swagger
 * /auth/me:
 *   get:
 *     summary: Get current user profile (trust score, strikes, etc.)
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 */
router.get("/auth/me", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const user = await prisma.user.findUnique({
    where: { user_id: req.user!.user_id },
    select: {
      user_id:       true,
      ghost_handle:  true,
      college_id:    true,
      course_branch: true,
      study_year:    true,
      trust_score:   true,
      strike_count:  true,
      account_status: true,
      role:          true,
      verification_method: true,
      created_at:    true,
    },
  });

  if (!user) { res.status(404).json({ message: "User not found" }); return; }
  res.json({ user });
});

// ── POST /api/v1/auth/recover ─────────────────────────────────
/**
 * @swagger
 * /auth/recover:
 *   post:
 *     summary: Reset password using ghost_handle + AYE Recovery Keycard
 *     tags: [Auth]
 */
router.post("/auth/recover", asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const parsed = RecoverSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Validation error", errors: parsed.error.flatten() });
    return;
  }

  const { ghost_handle, recovery_key, new_password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { ghost_handle } });
  if (!user) {
    res.status(400).json({ message: "Invalid ghost handle or recovery key" });
    return;
  }

  const keyValid = await bcrypt.compare(recovery_key.toUpperCase(), user.recovery_key_hash);
  if (!keyValid) {
    res.status(400).json({ message: "Invalid ghost handle or recovery key" });
    return;
  }

  const new_password_hash = await bcrypt.hash(new_password, 12);
  await prisma.user.update({
    where: { user_id: user.user_id },
    data: { password_hash: new_password_hash },
  });

  res.json({ message: "Password updated successfully" });
}));

export default router;



