/**
 * AES-256-GCM file encryption service backed by Catalyst Stratus.
 *
 * Each file is encrypted with a unique 16-byte IV derived from
 * ENCRYPTION_KEY (env var). The encrypted content is stored as:
 *
 *   [16-byte IV][12-byte auth tag][ciphertext...]
 *
 * This layout lets us decrypt without storing anything in the DB —
 * everything needed is self-contained in the file blob.
 *
 * Files are stored in Catalyst Stratus (object storage) instead of
 * the local filesystem, which is not durable on AppSail.
 */

import crypto from "crypto";
import { Request } from "express";
import { PrismaClient } from "@prisma/client";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH  = 16; // bytes — randomised per file
const TAG_LENGTH = 16; // GCM auth tag length in bytes

/** Stratus bucket name — create this bucket in Catalyst Console first. */
const STRATUS_BUCKET = process.env.STRATUS_BUCKET ?? "aye-uploads";

/** Derive a 32-byte key from the env secret. */
function getKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY ?? process.env.JWT_SECRET ?? "aye-fallback-key-change-me-in-prod";
  // SHA-256 of the secret gives us a stable 32-byte key
  return crypto.createHash("sha256").update(raw).digest();
}

/**
 * Encrypt a Buffer → returns a new Buffer with IV + tag + ciphertext.
 */
export function encryptBuffer(plaintext: Buffer): Buffer {
  const key = getKey();
  const iv  = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH });

  const encrypted   = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag         = cipher.getAuthTag();

  // Layout: [IV 16B][TAG 16B][ciphertext]
  return Buffer.concat([iv, tag, encrypted]);
}

/**
 * Decrypt a Buffer produced by encryptBuffer.
 */
export function decryptBuffer(blob: Buffer): Buffer {
  const key        = getKey();
  const iv         = blob.subarray(0, IV_LENGTH);
  const tag        = blob.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const ciphertext = blob.subarray(IV_LENGTH + TAG_LENGTH);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH });
  decipher.setAuthTag(tag);

  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

/** Initialize Catalyst SDK with admin scope for Stratus operations. */
function getStratusBucket(req?: Request) {
  const catalyst = require("zcatalyst-sdk-node");
  const app = catalyst.initialize(req, { scope: "admin" });
  return app.stratus().bucket(STRATUS_BUCKET);
}

/**
 * Write an encrypted file to Catalyst Stratus.
 * Returns the stored filename (UUID-based, no extension leak).
 */
export async function saveEncryptedFile(
  fileBuffer: Buffer,
  _uploadDir?: string, // kept for signature compatibility; Stratus ignores it
  req?: Request
): Promise<string> {
  const storedName = `${crypto.randomUUID()}.enc`;
  const encrypted  = encryptBuffer(fileBuffer);

  const bucket = getStratusBucket(req);
  await bucket.putObject(`uploads/${storedName}`, encrypted, {
    overwrite: true,
    metaData: { encrypted: "true", algorithm: ALGORITHM },
  });

  return storedName;
}

/**
 * Read and decrypt a file from Catalyst Stratus.
 */
export async function readDecryptedFile(
  storedName: string,
  _uploadDir?: string,
  req?: Request
): Promise<Buffer> {
  const bucket = getStratusBucket(req);
  const stream = await bucket.getObject(`uploads/${storedName}`);

  // Collect stream into a Buffer
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const blob = Buffer.concat(chunks);

  return decryptBuffer(blob);
}

/**
 * Delete an encrypted file from Catalyst Stratus (best-effort).
 */
export async function deleteEncryptedFile(
  storedName: string,
  _uploadDir?: string,
  req?: Request
): Promise<void> {
  const bucket = getStratusBucket(req);
  await bucket.deleteObject(`uploads/${storedName}`).catch(() => {/* already gone */});
}
