import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Compute Haversine distance in meters between two lat/lng points */
export function haversineDistance(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 6371000;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(Δφ / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Simple non-crypto hash (djb2) — used as fallback when crypto.subtle
 * is unavailable (plain HTTP / non-secure context).
 */
function djb2Hash(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i);
    hash = hash >>> 0; // keep unsigned 32-bit
  }
  // Pad to 64 hex chars to match SHA-256 length expected by the backend
  return hash.toString(16).padStart(8, "0").repeat(8);
}

/**
 * Canvas + WebGL + Audio hardware fingerprint.
 * Uses SHA-256 (crypto.subtle) when available — secure contexts only.
 * Falls back to djb2 hash on plain HTTP (e.g. Tailscale IP without HTTPS).
 * The 64-char hex output matches the backend's `hardware_fingerprint_hash`
 * field validation (z.string().length(64)).
 */
export async function getHardwareFingerprint(): Promise<string> {
  const parts: string[] = [];

  // Canvas fingerprint
  try {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d")!;
    ctx.textBaseline = "top";
    ctx.font = "14px 'Arial'";
    ctx.fillStyle = "#f60";
    ctx.fillRect(0, 0, 100, 50);
    ctx.fillStyle = "#069";
    ctx.fillText("AYE\uD83D\uDD12", 2, 2);
    parts.push(canvas.toDataURL());
  } catch { /* ignore */ }

  // WebGL fingerprint
  try {
    const gl = document.createElement("canvas")
      .getContext("webgl") as WebGLRenderingContext | null;
    if (gl) {
      const dbgInfo = gl.getExtension("WEBGL_debug_renderer_info");
      if (dbgInfo) {
        parts.push(gl.getParameter(dbgInfo.UNMASKED_VENDOR_WEBGL) as string);
        parts.push(gl.getParameter(dbgInfo.UNMASKED_RENDERER_WEBGL) as string);
      }
    }
  } catch { /* ignore */ }

  // Platform / screen
  parts.push(navigator.userAgent);
  parts.push(`${screen.width}x${screen.height}x${screen.colorDepth}`);
  parts.push(Intl.DateTimeFormat().resolvedOptions().timeZone);

  const combined = parts.join("||");

  // Use crypto.subtle if available (HTTPS / localhost)
  if (
    typeof crypto !== "undefined" &&
    crypto.subtle &&
    typeof crypto.subtle.digest === "function"
  ) {
    try {
      const buf = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(combined)
      );
      return Array.from(new Uint8Array(buf))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    } catch { /* fall through to djb2 */ }
  }

  // Fallback for plain HTTP (Tailscale IP without HTTPS, etc.)
  return djb2Hash(combined);
}

/** Generate a random ghost handle suggestion */
export function generateGhostHandle(): string {
  const adj  = ["Cyber", "Ghost", "Neon", "Phantom", "Shadow", "Storm", "Void", "Zero"];
  const noun = ["Wolf", "Tiger", "Hawk", "Raven", "Viper", "Phoenix", "Cobra", "Lynx"];
  const num  = Math.floor(Math.random() * 900) + 100;
  return `${adj[Math.floor(Math.random() * adj.length)]}${noun[Math.floor(Math.random() * noun.length)]}_${num}`;
}
