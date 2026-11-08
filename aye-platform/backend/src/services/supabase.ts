/**
 * Supabase Realtime adapter for AYE live events.
 *
 * - AYE count bumps → Realtime Broadcast on `college:<id>` channel
 * - Chat messages   → written by REST endpoint into Prisma `ChatMessage`
 *   table; Supabase Realtime picks up the INSERT via postgres_changes
 *   and pushes to subscribed clients in real-time.
 *
 * Token minting is NOT used — the frontend subscribes with the anon key
 * (publishable key) which works for broadcast + postgres_changes on tables
 * that have a permissive SELECT RLS policy.
 */
import { createClient, SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL     = process.env.SUPABASE_URL     ?? "";
const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY ??
  process.env.SUPABASE_PUBLISHABLE_KEY ??
  "";

/** True when Supabase Realtime broadcast is available. */
export function supabaseConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

/** Config the browser client needs to open a Realtime connection. */
export function realtimeClientConfig(): { url: string; key: string } {
  return { url: SUPABASE_URL, key: SUPABASE_ANON_KEY };
}

// ── Server→client Broadcast (AYE count bumps) ────────────────────────────────

let publisher: SupabaseClient | null = null;
const collegeChannels = new Map<string, ReturnType<SupabaseClient["channel"]>>();

async function initPublisher(): Promise<boolean> {
  if (publisher) return true;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.warn("[supabase] config missing — live broadcasts disabled");
    return false;
  }
  try {
    publisher = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    return true;
  } catch (e) {
    console.error("[supabase] failed to init publisher:", (e as Error).message);
    publisher = null;
    return false;
  }
}

/**
 * Push an event to every client on the college's broadcast channel.
 * Used for AYE count bumps. Fire-and-forget — never throws to callers.
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
      ch = publisher!.channel(`college:${collegeId}`);
      ch.subscribe();
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

/** Tear down connections (graceful shutdown). */
export async function closeSupabase(): Promise<void> {
  try {
    collegeChannels.forEach((ch) => publisher?.removeChannel(ch));
  } catch { /* noop */ }
  collegeChannels.clear();
  publisher = null;
}
