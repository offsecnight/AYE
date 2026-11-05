"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Ghost, LayoutGrid, MessageSquare, LogOut, User, Shield, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/lib/store";
import { disconnectSocket } from "@/lib/socket";

const navLinks = [
  { href: "/",               label: "SCOREBOARD", icon: LayoutGrid },
  { href: "/campus/wall",    label: "WALL",        icon: Zap },
  { href: "/campus/lounge",  label: "LOUNGE",      icon: MessageSquare },
  { href: "/campus/profile", label: "GHOST",       icon: User },
];

export function Navbar() {
  const path   = usePathname();
  const router = useRouter();
  const { user, clearAuth } = useAuthStore();

  function logout() {
    disconnectSocket();
    clearAuth();
    router.push("/auth");
  }

  return (
    <nav className="sticky top-8 z-40 bg-paper border-b-3 border-ink">
      <div className="max-w-screen-xl mx-auto px-3 sm:px-4 flex items-center justify-between h-14">

        {/* WORDMARK */}
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <div className="bg-ink text-acid font-mono font-bold text-lg px-3 py-1 border-3 border-ink shadow-brutal-acid select-none">
            AYE
          </div>
          <span className="font-mono font-bold text-sm uppercase tracking-widest hidden sm:block">
            PLATFORM
          </span>
        </Link>

        {/* DESKTOP LINKS */}
        <div className="hidden md:flex items-center gap-1">
          {navLinks.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "px-4 py-2 font-mono font-bold text-xs uppercase tracking-widest border-2 border-transparent",
                "hover:border-ink hover:shadow-brutal-sm transition-all duration-75",
                path === href && "bg-ink text-acid border-ink"
              )}
            >
              {label}
            </Link>
          ))}
          {user?.role === "DEV_SUPER_ADMIN" && (
            <Link
              href="/dev-admin"
              className={cn(
                "px-4 py-2 font-mono font-bold text-xs uppercase tracking-widest border-2 border-transparent",
                "hover:border-ink hover:shadow-brutal-sm transition-all duration-75",
                path === "/dev-admin" && "bg-ink text-acid border-ink"
              )}
            >
              ADMIN
            </Link>
          )}
        </div>

        {/* AUTH SECTION */}
        <div className="flex items-center gap-2 shrink-0">
          {user ? (
            <>
              <span className="font-mono text-xs text-ink/60 uppercase hidden sm:block max-w-[120px] truncate">
                <Ghost size={12} className="inline mr-1" />
                @{user.ghost_handle}
              </span>
              {/* 48×48 min touch target */}
              <button
                onClick={logout}
                className="min-w-[48px] min-h-[48px] flex items-center justify-center gap-2 px-3 bg-white text-ink font-mono font-bold text-xs uppercase border-3 border-ink shadow-brutal"
                aria-label="Logout"
              >
                <LogOut size={14} />
                <span className="hidden sm:inline">LOGOUT</span>
              </button>
            </>
          ) : (
            <>
              <Link href="/auth" className="btn-secondary text-xs py-2 px-3 min-h-[44px]">
                LOGIN
              </Link>
              <Link href="/auth?tab=register" className="btn-primary text-xs py-2 px-3 min-h-[44px]">
                <Shield size={14} />
                JOIN
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}

/** Mobile bottom tab bar — only shown on small screens */
export function MobileTabBar() {
  const path   = usePathname();
  const router = useRouter();
  const { user, clearAuth } = useAuthStore();

  function logout() {
    disconnectSocket();
    clearAuth();
    router.push("/auth");
  }

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 bg-paper border-t-3 border-ink flex md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {navLinks.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          className={cn(
            "flex-1 flex flex-col items-center justify-center py-3 gap-1 min-h-[56px]",
            "font-mono text-[10px] uppercase tracking-wider",
            path === href ? "bg-ink text-acid" : "text-ink"
          )}
        >
          <Icon size={18} />
          <span className="leading-none">{label}</span>
        </Link>
      ))}
      {user ? (
        <button
          onClick={logout}
          className="flex-1 flex flex-col items-center justify-center py-3 gap-1 min-h-[56px] font-mono text-[10px] uppercase tracking-wider text-ink"
          aria-label="Logout"
        >
          <LogOut size={18} />
          <span className="leading-none">OUT</span>
        </button>
      ) : (
        <Link
          href="/auth"
          className="flex-1 flex flex-col items-center justify-center py-3 gap-1 min-h-[56px] font-mono text-[10px] uppercase tracking-wider text-ink"
        >
          <Ghost size={18} />
          <span className="leading-none">LOGIN</span>
        </Link>
      )}
    </nav>
  );
}
