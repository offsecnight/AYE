"use client";

// Supabase Realtime client for AYE live events.
//
//  - Chat messages: postgres_changes on "ChatMessage" table filtered by room_id
//    The backend writes via Prisma; Supabase Realtime pushes INSERTs live.
//  - AYE count bumps: Broadcast on `college:<id>` channel.
//  - Online count: Presence on per-room channel.

import { createClient, SupabaseClient, RealtimeChannel } from "@supabase/supabase-js";
import { chatApi } from "./api";

interface RealtimeCfg { url: string; key: string; }

let client: SupabaseClient | null = null;
let clientForToken: string | null = null;

function disposeClient() {
  if (!client) return;
  try { client.removeAllChannels(); } catch { /* noop */ }
  try { client.realtime.disconnect(); } catch { /* noop */ }
  client = null;
  clientForToken = null;
}

export async function ensureRealtimeClient(appToken: string): Promise<SupabaseClient | null> {
  if (client && clientForToken === appToken) return client;
  if (client) disposeClient();
  try {
    const cfg = (await chatApi.realtimeToken(appToken)) as RealtimeCfg;
    client = createClient(cfg.url, cfg.key, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    clientForToken = appToken;
    return client;
  } catch (e) {
    console.error("[realtime] init failed:", e);
    return null;
  }
}

/**
 * Subscribe to new chat messages in a room via postgres_changes.
 * The backend writes to Prisma's ChatMessage table; Supabase Realtime
 * delivers the INSERT payload to this subscriber immediately.
 */
export async function subscribeRoomMessages(
  appToken: string,
  roomId: string,
  onMessage: (row: Record<string, unknown>) => void
): Promise<() => void> {
  const supabase = await ensureRealtimeClient(appToken);
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
  appToken: string,
  roomId: string,
  userId: string,
  onCount: (count: number) => void,
  onStatus?: (live: boolean) => void
): Promise<() => void> {
  const supabase = await ensureRealtimeClient(appToken);
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
  appToken: string,
  collegeId: string,
  onAye: (data: { post_id: string; aye_count: number }) => void,
  onStatus?: (live: boolean) => void
): Promise<() => void> {
  const supabase = await ensureRealtimeClient(appToken);
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
