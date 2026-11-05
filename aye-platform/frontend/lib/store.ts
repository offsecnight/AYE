"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface AuthUser {
  user_id?: string;
  ghost_handle: string;
  college_id: string;
  role: "STUDENT" | "CAMPUS_MOD" | "DEV_SUPER_ADMIN";
  account_status: "ACTIVE" | "RESTRICTED" | "BANNED_TROLL";
  trust_score?: number;
  strike_count?: number;
  token: string;
}

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  setAuth: (user: AuthUser, token: string) => void;
  clearAuth: () => void;
  updateTrustScore: (score: number) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user:  null,
      token: null,

      setAuth: (user, token) =>
        set({ user: { ...user, token }, token }),

      clearAuth: () =>
        set({ user: null, token: null }),

      updateTrustScore: (score) =>
        set((s) => ({
          user: s.user ? { ...s.user, trust_score: score } : null,
        })),
    }),
    {
      name: "aye-auth",
      partialize: (s) => ({ user: s.user, token: s.token }),
    }
  )
);
