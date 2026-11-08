/**
 * Supabase Realtime + Storage adapter for AYE chat & live events.
 *
 * Split responsibilities:
 *  - Messages are persisted in the Supabase Postgres `chat_message` table and
 *    pushed to clients live via Realtime `postgres_changes` (INSERT events).
 *  - Server→client "event" pushes (e.g. AYE count bumps) go over Realtime
 *    Broadcast channels (college:<id>).
 *
 * All methods are fail-open: if Supabase isn't configured/available the app
 * keeps serving (message persistence/events degrade gracefully instead of
 * crashing the request). The API layer decides what to do with null/empty.
 */
import { Pool } from "pg";
import jwt from "jsonwebtoken";
import { JWTPayload } from "../types";

const SUPABASE_URL        = process.env.SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY   =
  process.env.SUPABASE_ANON_KEY ??
  process.env.SUPABASE_PUBLISHABLE_KEY ??
  "";
const SUPABASE_DB_URL     = process.env.SUPABASE_DB_URL ?? "";
const SUPABASE_JWT_SECRET = process.env.SUPABASE_JWT_SECRET ?? "";

/** True when all env needed for full Supabase integration is present. */
export function supabaseConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY && SUPABASE_DB_URL && SUPABASE_JWT_SECRET);
}

// ── Direct Postgres access (backend is the only writer/reader of storage) ──

let pool: Pool | null = null;

function getPool(): Pool | null {
  if (!SUPABASE_DB_URL) {
    console.warn("[supabase] SUPABASE_DB_URL not set — Supabase storage disabled");
    return null;
  }
  if (!pool) {
    pool = new Pool({ connectionString: SUPABASE_DB_URL, max: 10, idleTimeoutMillis: 30_000 });
    pool.on("error", (err: Error) => console.error("[supabase] pool error", err.message));
  }
  return pool;
}

/** A chat message row exactly as stored (snake_case keys). */
export interface ChatMessageRow {
  msg_id:        string;
  room_id:       string;
  college_id:    string;
  sender_id:     string;
  sender_handle: string | null; // NULL for ghost messages
  send_as_ghost: boolean;
  content:       string;
  media_url:     string | null;
  created_at:    Date;
}

interface InsertChatMessageArgs {
  room_id:       string;
  college_id:    string;
  sender_id:     string;
  sender_handle: string | null; // pass null when ghost
  send_as_ghost: boolean;
  content:       string;
  media_url?:    string | null;
}

/** Persist a message. The INSERT is picked up by Supabase Realtime and pushed to subscribers. */
export async function insertChatMessage(args: InsertChatMessageArgs): Promise<ChatMessageRow | null> {
  const p = getPool();
  if (!p) return null;
  try {
    const { rows } = await p.query<ChatMessageRow>(
      `insert into public.chat_message
         (room_id, college_id, sender_id, sender_handle, send_as_ghost, content, media_url)
       values ($1,$2,$3,$4,$5,$6,$7)
       returning *`,
      [
        args.room_id,
        args.college_id,
        args.sender_id,
        args.sender_handle,
        args.send_as_ghost,
        args.content,
        args.media_url ?? null,
      ]
    );
    return rows[0] ?? null;
  } catch (e) {
    console.error("[supabase] insertChatMessage failed:", (e as Error).message);
    return null;
  }
}

/** Fetch message history for a room (newest 50, ascending order for display). */
export async function getChatMessages(
  roomId: string,
  limit = 50
): Promise<ChatMessageRow[]> {
  const p = getPool();
  if (!p) return [];
  try {
    const { rows } = await p.query<ChatMessageRow>(
      `select * from public.chat_message
        where room_id = $1
        order by created_at desc, msg_id desc
        limit $2`,
      [roomId, limit]
    );
    return rows.reverse();
  } catch (e) {
    console.error("[supabase] getChatMessages failed:", (e as Error).message);
    return [];
  }
}

// ── Realtime client access tokens ────────────────────────────────────────────
// The AYE app authenticates users with its own JWT. To let the browser open a
// Realtime connection scoped to the user's college (for RLS silo enforcement),
// the backend mints a short-lived token signed with SUPABASE_JWT_SECRET that
// carries the user's college_id claim.

export function signRealtimeToken(user: JWTPayload): string | null {
  if (!SUPABASE_URL || !SUPABASE_JWT_SECRET) {
    console.warn("[supabase] SUPABASE_URL / SUPABASE_JWT_SECRET missing — cannot mint realtime token");
    return null;
  }
  const ref = SUPABASE_URL.replace(/^https?:\/\//, "").split(".")[0];
  const iat = Math.floor(Date.now() / 1000);
  return jwt.sign(
    {
      iss: "supabase",
      ref,
      role: "authenticated",
      aud: "authenticated",
      sub: user.user_id,
      college_id: user.college_id,
      ghost_handle: user.ghost_handle,
      iat,
      exp: iat + 3600, // 1h realtime scope
    },
    SUPABASE_JWT_SECRET
  );
}

export function realtimeClientConfig(user: JWTPayload): {
  url: string; key: string; token: string | null;
} {
  return { url: SUPABASE_URL, key: SUPABASE_ANON_KEY, token: signRealtimeToken(user) };
}

// ── Server→client Broadcast (AYE count bumps) ────────────────────────────────
// A single lazy Realtime publisher connection. Broadcast channels aren't gated
// by RLS the way postgres_changes are, so the server (with its anon net client)
// can push to `college:<id>` and every subscribed client receives it.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let publisher: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const collegeChannels = new Map<string, any>();

async function initPublisher(): Promise<boolean> {
  if (publisher) return true;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.warn("[supabase] publisher config missing — live broadcasts disabled");
    return false;
  }
  try {
    const { createClient } = await import("@supabase/supabase-js");
    publisher = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    return true;
  } catch (e) {
    console.error("[supabase] failed to init realtime publisher:", (e as Error).message);
    publisher = null;
    return false;
  }
}

/**
 * Push a small event to every client connected to the college channel.
 * Used for AYE count bumps. Fire-and-forget; never throws up to callers.
 */
export async function publishCollegeEvent(
  collegeId: string,
  event: string,
  payload: Record<string, unknown>
): Promise<void> {
  try {
    if (!(await initPublisher())) return;
    let ch = collegeChannels.get(collegeId);
    if (!ch) {
      ch = publisher.channel(`college:${collegeId}`);
      // Promise-based send needs the channel subscribed first.
      ch.subscribe((status: string) => {
        if (status !== "SUBSCRIBED") return;
        // flush pending on subscribe is handled by awaiting send below
      });
      collegeChannels.set(collegeId, ch);
    }
    await ch.send({ type: "broadcast", event, payload });
  } catch (e) {
    console.warn("[supabase] publishCollegeEvent failed:", (e as Error).message);
  }
}

/** Convenience wrapper for AYE count bumps. */
export async function publishAyeUpdate(
  collegeId: string,
  data: { post_id: string; aye_count: number }
): Promise<void> {
  await publishCollegeEvent(collegeId, "aye:update", data);
}

/** Tear down connections (used in tests / graceful shutdown). */
export async function closeSupabase(): Promise<void> {
  try { await pool?.end(); } catch { /* noop */ }
  pool = null;
  try { collegeChannels.forEach((ch) => publisher?.removeChannel?.(ch)); } catch { /* noop */ }
  collegeChannels.clear();
  publisher = null;
}