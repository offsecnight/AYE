import { PrismaClient, UserRole, VerificationMethod, AccountStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding AYE Platform...");

  // ── Colleges ───────────────────────────────────────────────
  const yenepoya = await prisma.college.upsert({
    where: { slug: "yenepoya-blr" },
    update: {},
    create: {
      name: "Yenepoya University (Bengaluru Campus)",
      slug: "yenepoya-blr",
      city: "Bengaluru",
      gps_lat: 12.9716,
      gps_lng: 77.5946,
      geofence_radius_meters: 500,
    },
  });

  const anupaya = await prisma.college.upsert({
    where: { slug: "anupaya-mng" },
    update: {},
    create: {
      name: "Anupaya University",
      slug: "anupaya-mng",
      city: "Mangaluru",
      gps_lat: 12.8698,
      gps_lng: 74.8431,
      geofence_radius_meters: 500,
    },
  });

  // ── Dev Super-Admin ────────────────────────────────────────
  const adminHash = await bcrypt.hash("AdminPass123!", 12);
  const adminRecovery = await bcrypt.hash("ADMIN-RECOVERY-KEY", 12);

  await prisma.user.upsert({
    where: { ghost_handle: "DevAdmin_AYE" },
    update: {},
    create: {
      college_id: yenepoya.college_id,
      ghost_handle: "DevAdmin_AYE",
      password_hash: adminHash,
      recovery_key_hash: adminRecovery,
      course_branch: "Platform Admin",
      study_year: 1,
      verification_method: VerificationMethod.DEV_SEED,
      trust_score: 100,
      account_status: AccountStatus.ACTIVE,
      hardware_fingerprint_hash: "dev-admin-fingerprint-" + Date.now(),
      role: UserRole.DEV_SUPER_ADMIN,
    },
  });

  // ── Sample student ─────────────────────────────────────────
  const studentHash = await bcrypt.hash("Student123!", 12);
  const studentRecovery = await bcrypt.hash("STUDENT-RECOVERY", 12);

  await prisma.user.upsert({
    where: { ghost_handle: "CyberWolf_404" },
    update: {},
    create: {
      college_id: yenepoya.college_id,
      ghost_handle: "CyberWolf_404",
      password_hash: studentHash,
      recovery_key_hash: studentRecovery,
      course_branch: "BCA Cyber Security",
      study_year: 2,
      verification_method: VerificationMethod.DEV_SEED,
      trust_score: 72,
      account_status: AccountStatus.ACTIVE,
      hardware_fingerprint_hash: "student-fp-" + Date.now(),
      role: UserRole.STUDENT,
    },
  });

  console.log("✅ Seed complete");
  console.log(`   Colleges: ${yenepoya.name}, ${anupaya.name}`);
  console.log("   Admin handle: DevAdmin_AYE / AdminPass123!");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
