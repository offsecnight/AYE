"use client";

// Supabase Realtime client for AYE live events.
//
//  - Chat messages: postgres_changes on "ChatMessage" table filtered by room_id
//    The backend writes via Prisma; Supabase Realtime pushes INSERTs live.
//  - AYE count bumps: Broadcast on `college:<id>` channel.
//  - Online count: Presence on per-room channel.
//
// The client is initialized directly from NEXT_PUBLIC_SUPABASE_* env vars —
// no backend round-trip needed. These are publishable (anon) keys, safe to
// expose in the browser.

import { createClient, SupabaseClient, RealtimeChannel } from "@supabase/supabase-js";

// Supabase anon key is a publishable key — safe to include in browser JS.
// Catalyst AppSail injects env vars at runtime, AFTER Next.js builds the bundle,
// so NEXT_PUBLIC_* are empty at build time. We hardcode the values here as fallback.
const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  "https://yhxkmhrszchxgbdhiusp.supabase.co";
const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InloeGttaHJzemNoeGdiZGhpdXNwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQwNDEwMjksImV4cCI6MjEwOTYxNzAyOX0.JiC7toIn40pPmCY7SluVUQ2ukgrQCuD418P0fjs5DqY";

let client: SupabaseClient | null = null;

function getClient(): SupabaseClient | null {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error("[realtime] Supabase env vars not set (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY)");
    return null;
  }
  if (client) return client;
  client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return client;
}

function disposeClient() {
  if (!client) return;
  try { client.removeAllChannels(); } catch { /* noop */ }
  try { client.realtime.disconnect(); } catch { /* noop */ }
  client = null;
}

/**
 * Subscribe to new chat messages in a room via postgres_changes.
 * The backend writes to Prisma's ChatMessage table; Supabase Realtime
 * delivers the INSERT payload to this subscriber immediately.
 */
export async function subscribeRoomMessages(
  _appToken: string,   // kept for API compatibility, not used for auth
  roomId: string,
  onMessage: (row: Record<string, unknown>) => void
): Promise<() => void> {
  const supabase = getClient();
  if (!supabase) return () => {};

  const channel: RealtimeChannel = supabase.channel(`room-msg:${roomId}`);
  channel.on(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    "postgres_changes" as any,
    { event: "INSERT", schema: "public", table: "ChatMessage", filter: `room_id=eq.${roomId}` },
    (payload: { new: Record<string, unknown> }) => onMessage(payload.new)
  );
  channel.subscribe((status) => {
    console.log(`[realtime] room-msg:${roomId} →`, status);
  });

  return () => {
    try { supabase.removeChannel(channel); } catch { /* noop */ }
  };
}

/**
 * Track presence for online count in a room.
 */
export async function trackRoomPresence(
  _appToken: string,
  roomId: string,
  userId: string,
  onCount: (count: number) => void,
  onStatus?: (live: boolean) => void
): Promise<() => void> {
  const supabase = getClient();
  if (!supabase) return () => {};

  const channel: RealtimeChannel = supabase.channel(`presence:${roomId}`);
  channel.on("presence", { event: "sync" }, () => {
    onCount(Object.keys(channel.presenceState()).length);
  });
  channel.subscribe(async (status) => {
    if (status === "SUBSCRIBED") {
      onStatus?.(true);
      try { await channel.track({ user_id: userId, online_at: Date.now() }); } catch { /* noop */ }
    } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
      onStatus?.(false);
    }
  });

  return () => {
    try { channel.untrack(); } catch { /* noop */ }
    try { supabase.removeChannel(channel); } catch { /* noop */ }
  };
}

/**
 * Subscribe to live college-wide AYE count updates via Broadcast.
 * The backend publishes to `college:<id>` after each AYE toggle.
 */
export async function subscribeCollegeEvents(
  _appToken: string,
  collegeId: string,
  onAye: (data: { post_id: string; aye_count: number }) => void,
  onStatus?: (live: boolean) => void
): Promise<() => void> {
  const supabase = getClient();
  if (!supabase) return () => {};

  const channel: RealtimeChannel = supabase.channel(`college:${collegeId}`);
  channel.on("broadcast", { event: "aye:update" }, ({ payload }) => {
    onAye(payload as { post_id: string; aye_count: number });
  });
  channel.subscribe((status) => {
    console.log(`[realtime] college:${collegeId} →`, status);
    if (status === "SUBSCRIBED") onStatus?.(true);
    else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") onStatus?.(false);
  });

  return () => {
    try { supabase.removeChannel(channel); } catch { /* noop */ }
  };
}

export function disconnectRealtime() {
  disposeClient();
}
