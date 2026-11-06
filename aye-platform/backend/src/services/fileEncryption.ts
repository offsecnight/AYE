/**
 * AES-256-GCM file encryption service.
 *
 * Each file is encrypted with a unique 16-byte IV derived from
 * ENCRYPTION_KEY (env var). The encrypted content is stored as:
 *
 *   [16-byte IV][12-byte auth tag][ciphertext...]
 *
 * This layout lets us decrypt without storing anything in the DB —
 * everything needed is self-contained in the file blob.
 */

import crypto from "crypto";
import fs     from "fs";
import path   from "path";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH  = 16; // bytes — randomised per file
const TAG_LENGTH = 16; // GCM auth tag length in bytes

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

/**
 * Write an encrypted file to disk.
 * Returns the stored filename (UUID-based, no extension leak).
 */
export async function saveEncryptedFile(
  fileBuffer: Buffer,
  uploadDir: string
): Promise<string> {
  const storedName = `${crypto.randomUUID()}.enc`;
  const fullPath   = path.join(uploadDir, storedName);

  const encrypted  = encryptBuffer(fileBuffer);
  await fs.promises.writeFile(fullPath, encrypted);

  return storedName;
}

/**
 * Read and decrypt a file from disk.
 */
export async function readDecryptedFile(
  storedName: string,
  uploadDir: string
): Promise<Buffer> {
  const fullPath = path.join(uploadDir, storedName);
  const blob     = await fs.promises.readFile(fullPath);
  return decryptBuffer(blob);
}

/**
 * Delete an encrypted file from disk (best-effort).
 */
export async function deleteEncryptedFile(
  storedName: string,
  uploadDir: string
): Promise<void> {
  const fullPath = path.join(uploadDir, storedName);
  await fs.promises.unlink(fullPath).catch(() => {/* already gone */});
}
