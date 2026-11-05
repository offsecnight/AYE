import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/** Check if a hardware fingerprint is banned */
export async function isFingerprintBanned(hash: string): Promise<boolean> {
  const banned = await prisma.bannedFingerprint.findUnique({
    where: { fingerprint_hash: hash },
  });
  return !!banned;
}

/** Add a fingerprint to the ban registry */
export async function banFingerprint(hash: string, reason: string): Promise<void> {
  await prisma.bannedFingerprint.upsert({
    where: { fingerprint_hash: hash },
    update: { reason },
    create: { fingerprint_hash: hash, reason },
  });
}
