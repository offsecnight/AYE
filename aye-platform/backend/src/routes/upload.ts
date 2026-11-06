import { asyncHandler } from "../utils/asyncHandler";
/**
 * File upload / download routes.
 *
 * POST /api/v1/upload
 *   - Requires auth (any active student).
 *   - Accepts multipart/form-data with field name "files" (up to 10 files, 50 MB each).
 *   - Encrypts each file with AES-256-GCM and stores it on disk.
 *   - Returns an array of { storedName, originalName, mimeType, size } objects
 *     that the caller should persist in the encrypted_files JSON column.
 *
 * GET /api/v1/files/:storedName
 *   - Requires auth.
 *   - Decrypts the file on-the-fly and streams it back with the correct
 *     Content-Type based on the stored mimeType.
 *   - The caller must pass ?mime=<mimeType> so we know what Content-Type
 *     to set (we never derive it from the encrypted blob).
 */

import path    from "path";
import fs      from "fs";
import { Router, Request, Response } from "express";
import multer  from "multer";
import { requireAuth, requireActive } from "../middleware/auth";
import { saveEncryptedFile, readDecryptedFile } from "../services/fileEncryption";

const router = Router();

// ── Upload directory ─────────────────────────────────────────
const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR ?? "./uploads");
// Ensure it exists at startup
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// ── Multer config — store in memory so we can encrypt before disk ──
const MAX_FILE_MB   = parseInt(process.env.MAX_FILE_SIZE_MB ?? "50", 10);
const MAX_FILES     = 10;

const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: MAX_FILE_MB * 1024 * 1024 },
  // Accept any file type — validation is the user's responsibility
  // The encrypted-at-rest storage means content is opaque anyway
});

// ── POST /api/v1/upload ───────────────────────────────────────
/**
 * @swagger
 * /upload:
 *   post:
 *     summary: Upload up to 10 files (encrypted at rest)
 *     tags: [Upload]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               files:
 *                 type: array
 *                 items: { type: string, format: binary }
 */
router.post(
  "/",
  requireAuth,
  requireActive,
  upload.array("files", MAX_FILES),
  async (req: Request, res: Response): Promise<void> => {
    const files = req.files as Express.Multer.File[] | undefined;

    if (!files || files.length === 0) {
      res.status(400).json({ message: "No files provided" });
      return;
    }

    const results: {
      storedName:   string;
      originalName: string;
      mimeType:     string;
      size:         number;
    }[] = [];

    for (const file of files) {
      const storedName = await saveEncryptedFile(file.buffer, UPLOAD_DIR);
      results.push({
        storedName,
        originalName: file.originalname,
        mimeType:     file.mimetype,
        size:         file.size,
      });
    }

    res.status(201).json({ files: results });
  }
);

// ── GET /api/v1/files/:storedName ─────────────────────────────
/**
 * @swagger
 * /files/{storedName}:
 *   get:
 *     summary: Download and decrypt a stored file
 *     tags: [Upload]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: storedName
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: mime
 *         required: true
 *         schema: { type: string }
 */
router.get(
  "/:storedName",
  requireAuth,
  requireActive,
  async (req: Request, res: Response): Promise<void> => {
    const { storedName } = req.params;
    const mimeType       = (req.query.mime as string) ?? "application/octet-stream";

    // Basic path traversal guard — storedName must be a plain UUID.enc
    if (!/^[0-9a-f-]{36}\.enc$/.test(storedName)) {
      res.status(400).json({ message: "Invalid file name" });
      return;
    }

    try {
      const decrypted = await readDecryptedFile(storedName, UPLOAD_DIR);
      res.setHeader("Content-Type", mimeType);
      res.setHeader("Content-Length", decrypted.length.toString());
      res.setHeader("Cache-Control", "private, no-store");
      res.send(decrypted);
    } catch {
      res.status(404).json({ message: "File not found or decryption failed" });
    }
  }
);

export default router;



