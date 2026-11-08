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
 * Falls back to local filesystem in development if Stratus is unavailable.
 */

import crypto from "crypto";
import { Request } from "express";
import path from "path";
import fs from "fs/promises";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH  = 16; // bytes — randomised per file
const TAG_LENGTH = 16; // GCM auth tag length in bytes

/** Stratus bucket name — create this bucket in Catalyst Console first. */
const STRATUS_BUCKET = process.env.STRATUS_BUCKET ?? "aye-uploads";

/** Local upload directory for development fallback */
const LOCAL_UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR ?? "./uploads");

/** Check if we're running on Catalyst AppSail (production) */
const IS_APPSAIL = !!process.env.X_ZOHO_CATALYST_LISTEN_PORT;

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
async function getStratusBucket(req?: Request) {
  const catalyst = require("zcatalyst-sdk-node");
  const app = catalyst.initialize(req, { scope: "admin" });
  return app.stratus().bucket(STRATUS_BUCKET);
}

/** Ensure local upload directory exists */
async function ensureLocalDir(): Promise<void> {
  await fs.mkdir(LOCAL_UPLOAD_DIR, { recursive: true });
}

/** Get local file path for a stored name */
function getLocalPath(storedName: string): string {
  return path.join(LOCAL_UPLOAD_DIR, storedName);
}

/**
 * Write an encrypted file to Catalyst Stratus (or local FS in dev fallback).
 * Returns the stored filename (UUID-based, no extension leak).
 */
export async function saveEncryptedFile(
  fileBuffer: Buffer,
  _uploadDir?: string, // kept for signature compatibility; Stratus ignores it
  req?: Request
): Promise<string> {
  const storedName = `${crypto.randomUUID()}.enc`;
  const encrypted  = encryptBuffer(fileBuffer);

  // Try Stratus first (production or when available)
  if (IS_APPSAIL || process.env.FORCE_STRATUS === "true") {
    try {
      const bucket = await getStratusBucket(req);
      await bucket.putObject(`uploads/${storedName}`, encrypted, {
        overwrite: true,
        metaData: { encrypted: "true", algorithm: ALGORITHM },
      });
      console.log(`[Stratus] Uploaded: ${storedName} (${encrypted.length} bytes)`);
      return storedName;
    } catch (err) {
      console.error(`[Stratus] Upload failed for ${storedName}:`, err);
      if (IS_APPSAIL) throw err; // In production, fail hard
      // In development, fall through to local storage
      console.warn(`[Stratus] Falling back to local storage for ${storedName}`);
    }
  }

  // Local filesystem fallback (development)
  await ensureLocalDir();
  const localPath = getLocalPath(storedName);
  await fs.writeFile(localPath, encrypted);
  console.log(`[Local] Saved: ${storedName} (${encrypted.length} bytes)`);
  return storedName;
}

/**
 * Read and decrypt a file from Catalyst Stratus (or local FS in dev fallback).
 */
export async function readDecryptedFile(
  storedName: string,
  _uploadDir?: string,
  req?: Request
): Promise<Buffer> {
  // Basic path traversal guard — storedName must be a plain UUID.enc
  if (!/^[0-9a-f-]{36}\.enc$/.test(storedName)) {
    throw new Error("Invalid file name");
  }

  // Try Stratus first (production or when available)
  if (IS_APPSAIL || process.env.FORCE_STRATUS === "true") {
    try {
      const bucket = await getStratusBucket(req);
      const stream = await bucket.getObject(`uploads/${storedName}`);

      // Collect stream into a Buffer
      const chunks: Buffer[] = [];
      for await (const chunk of stream) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      const blob = Buffer.concat(chunks);
      console.log(`[Stratus] Downloaded: ${storedName} (${blob.length} bytes)`);
      return decryptBuffer(blob);
    } catch (err) {
      console.error(`[Stratus] Download failed for ${storedName}:`, err);
      if (IS_APPSAIL) throw err; // In production, fail hard
      // In development, fall through to local storage
      console.warn(`[Stratus] Falling back to local storage for ${storedName}`);
    }
  }

  // Local filesystem fallback (development)
  const localPath = getLocalPath(storedName);
  const blob = await fs.readFile(localPath);
  console.log(`[Local] Read: ${storedName} (${blob.length} bytes)`);
  return decryptBuffer(blob);
}

/**
 * Delete an encrypted file from Catalyst Stratus (or local FS in dev fallback).
 */
export async function deleteEncryptedFile(
  storedName: string,
  _uploadDir?: string,
  req?: Request
): Promise<void> {
  // Basic path traversal guard
  if (!/^[0-9a-f-]{36}\.enc$/.test(storedName)) {
    return;
  }

  // Try Stratus first
  if (IS_APPSAIL || process.env.FORCE_STRATUS === "true") {
    try {
      const bucket = await getStratusBucket(req);
      await bucket.deleteObject(`uploads/${storedName}`);
      console.log(`[Stratus] Deleted: ${storedName}`);
      return;
    } catch (err) {
      console.error(`[Stratus] Delete failed for ${storedName}:`, err);
      if (IS_APPSAIL) throw err;
      console.warn(`[Stratus] Falling back to local storage for ${storedName}`);
    }
  }

  // Local filesystem fallback
  const localPath = getLocalPath(storedName);
  await fs.unlink(localPath).catch(() => {/* already gone */});
  console.log(`[Local] Deleted: ${storedName}`);
}