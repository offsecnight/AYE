"use client";

// Supabase Realtime client for AYE Lounge chat + live campus events.
// Replaces the old Socket.io layer.
//
//  - Chat messages: subscribed via `postgres_changes` on the chat_message
//    table (filtered by room). The backend persists the row and Realtime pushes
//    it live to everyone in the room.
//  - Online count: Realtime Presence on a per-room channel.
//  - AYE count bumps: Realtime Broadcast on the college channel.

import { createClient, SupabaseClient, RealtimeChannel } from "@supabase/supabase-js";
import { chatApi } from "./api";

interface RealtimeCfg { url: string; key: string; token: string; }

// Single shared client per logged-in user. Recreated when the token changes.
let client: SupabaseClient | null = null;
let clientForToken: string | null = null;

function disposeClient() {
  if (!client) return;
  try { client.removeAllChannels(); } catch { /* noop */ }
  try { client.realtime.disconnect(); } catch { /* noop */ }
  client = null;
  clientForToken = null;
}

async function ensureClient(appToken: string): Promise<SupabaseClient | null> {
  if (client && clientForToken === appToken) return client;

  // Token changed (or client died) — tear down and rebuild.
  if (client) disposeClient();

  try {
    const cfg = (await chatApi.realtimeToken(appToken)) as RealtimeCfg;
    client = createClient(cfg.url, cfg.key, {
      global: { headers: { Authorization: `Bearer ${cfg.token}` } },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
    clientForToken = appToken;
    return client;
  } catch (e) {
    console.error("[realtime] init failed:", e);
    return null;
  }
}

/**
 * Subscribe to new chat messages in a room. Returns an unsubscribe function.
 */
export async function subscribeRoomMessages(
  appToken: string,
  roomId: string,
  onMessage: (row: Record<string, unknown>) => void
): Promise<() => void> {
  const supabase = await ensureClient(appToken);
  if (!supabase) return () => {};

  const channel: RealtimeChannel = supabase.channel(`room-msg:${roomId}`);
  channel.on(
    "postgres_changes",
    { event: "INSERT", schema: "public", table: "chat_message", filter: `room_id=eq.${roomId}` },
    (payload) => onMessage(payload.new as Record<string, unknown>)
  );
  channel.subscribe();

  return () => {
    try { supabase.removeChannel(channel); } catch { /* noop */ }
  };
}

/**
 * Track this client as present in a room and report the live online count.
 * Best for tasks like an error-fallback or when a fresh client is needed.
 */
export async function trackRoomPresence(
  appToken: string,
  roomId: string,
  userId: string,
  onCount: (count: number) => void,
  onStatus?: (live: boolean) => void
): Promise<() => void> {
  const supabase = await ensureClient(appToken);
  if (!supabase) return () => {};

  const channel: RealtimeChannel = supabase.channel(`presence:${roomId}`);
  channel.on("presence", { event: "sync" }, () => {
    const keys = Object.keys(channel.presenceState());
    onCount(keys.length);
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
 * Subscribe to live college-wide broadcast events (AYE count bumps).
 * Returns an unsubscribe function.
 */
export async function subscribeCollegeEvents(
  appToken: string,
  collegeId: string,
  onAye: (payload: { post_id: string; aye_count: number }) => void,
  onStatus?: (live: boolean) => void
): Promise<() => void> {
  const supabase = await ensureClient(appToken);
  if (!supabase) return () => {};

  const channel: RealtimeChannel = supabase.channel(`college:${collegeId}`);
  channel.on("broadcast", { event: "aye:update" }, (payload) => {
    onAye(payload as unknown as { post_id: string; aye_count: number });
  });
  channel.subscribe((status) => {
    if (status === "SUBSCRIBED") onStatus?.(true);
    else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") onStatus?.(false);
  });

  return () => {
    try { supabase.removeChannel(channel); } catch { /* noop */ }
  };
}

/** Tear down the shared client (e.g. on logout). */
export function disconnectRealtime() {
  disposeClient();
}