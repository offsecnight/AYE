"use client";

/**
 * Sound effects for AYE Platform.
 *
 * Uses HTMLAudioElement so sounds play without any backend round-trip.
 * Silently no-ops on server-side render or if autoplay is blocked.
 */

function play(src: string) {
  if (typeof window === "undefined") return;
  try {
    const audio = new Audio(src);
    audio.volume = 0.6;
    audio.play().catch(() => {/* autoplay blocked — fine */});
  } catch {
    // ignore
  }
}

/** Play when a user gives an AYE (like) to a post */
export function playAyeSound() {
  play("/sounds/aye.mp3");
}

/** Play when a student successfully drops a new experience post */
export function playPostSuccessSound() {
  play("/sounds/post-success.mp3");
}
