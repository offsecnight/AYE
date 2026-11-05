"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Ghost, Shield, Zap, Copy } from "lucide-react";
import { TrustScorePill } from "@/components/ui/StatusBadge";
import { OtpCountdown }   from "@/components/ui/Timer";
import { BruteCard }      from "@/components/ui/BruteCard";
import { authApi }        from "@/lib/api";
import { useAuthStore }   from "@/lib/store";

export function GhostProfile() {
  const router = useRouter();
  const { user, updateTrustScore } = useAuthStore();

  const [otpData,    setOtp]     = useState<{ code: string; expiry: string } | null>(null);
  const [generating, setGen]     = useState(false);
  const [copied,     setCopied]  = useState(false);
  const [genError,   setGenErr]  = useState<string | null>(null);
  const [profile,    setProfile] = useState<{
    trust_score: number; strike_count: number; course_branch: string; study_year: number;
  } | null>(null);

  useEffect(() => {
    if (!user) router.push("/auth");
  }, [user, router]);

  useEffect(() => {
    if (!user?.token) return;
    authApi.me(user.token)
      .then((r) => {
        const d = (r as { user: { trust_score: number; strike_count: number; course_branch: string; study_year: number } }).user;
        setProfile(d);
        updateTrustScore(d.trust_score);
      })
      .catch(() => {});
  }, [user?.token, updateTrustScore]);

  if (!user) return null;

  const trustScore  = profile?.trust_score  ?? user.trust_score  ?? 50;
  const strikeCount = profile?.strike_count ?? user.strike_count ?? 0;

  async function generateOtp() {
    setGen(true);
    setGenErr(null);
    try {
      const res = await authApi.generateOtp(user!.token) as { otp_code: string; expires_at: string };
      setOtp({ code: res.otp_code, expiry: res.expires_at });
    } catch (err: unknown) {
      setGenErr(err instanceof Error ? err.message : "Failed to generate OTP");
    } finally {
      setGen(false);
    }
  }

  function copyOtp() {
    if (!otpData) return;
    navigator.clipboard.writeText(otpData.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="section-label mb-6 inline-block">CAMPUS / GHOST PROFILE</div>

      {/* IDENTITY CARD */}
      <BruteCard className="p-4 sm:p-6 mb-6" accent="acid">
        <div className="flex items-start gap-4">
          {/* Avatar */}
          <div className="w-16 h-16 sm:w-20 sm:h-20 bg-ink border-3 border-ink shadow-brutal-acid flex items-center justify-center shrink-0">
            <Ghost size={28} className="text-acid sm:text-[36px]" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="font-mono text-[10px] text-ink/40 uppercase tracking-widest mb-1">
              GHOST IDENTITY
            </div>
            {/* truncate long handles */}
            <h1 className="font-mono font-bold text-xl sm:text-2xl uppercase mb-1 truncate">
              @{user.ghost_handle}
            </h1>
            <p className="font-mono text-xs text-ink/60 uppercase truncate">
              {profile?.course_branch ?? "—"} • Year {profile?.study_year ?? "—"}
            </p>
          </div>

          <TrustScorePill score={trustScore} />
        </div>
      </BruteCard>

      {/* STATS — 3 cols but responsive text size */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label: "TRUST",   value: trustScore,                   color: "text-emerald" },
          { label: "STRIKES", value: `${strikeCount}/2`,          color: strikeCount > 0 ? "text-danger" : "text-ink" },
          { label: "ROLE",    value: user.role.replace(/_/g, " "), color: "text-ink" },
        ].map((s) => (
          <BruteCard key={s.label} className="p-3 sm:p-4 text-center overflow-hidden">
            {/* text-2xl max to avoid overflow in 3-col grid */}
            <div className={`font-mono font-bold text-xl sm:text-3xl ${s.color} mb-1 truncate`}>
              {s.value}
            </div>
            <div className="font-mono text-[9px] sm:text-[10px] text-ink/40 uppercase tracking-widest leading-tight">
              {s.label}
            </div>
          </BruteCard>
        ))}
      </div>

      {/* CLASSMATE OTP GENERATOR */}
      <BruteCard className="p-4 sm:p-5 mb-6" accent="acid">
        <div className="flex items-center gap-2 mb-4">
          <Zap size={16} className="text-acid shrink-0" />
          <h2 className="font-mono font-bold text-sm uppercase tracking-wider">
            GENERATE 2-MIN CLASSMATE OTP
          </h2>
        </div>
        <p className="font-mono text-xs text-ink/60 mb-4">
          Let a new classmate join your campus silo. Share this 6-digit code.
          If they get banned for trolling, you lose 30 Trust points.
        </p>

        {genError && (
          <p className="font-mono text-xs text-danger uppercase mb-3">{genError}</p>
        )}

        {otpData ? (
          <div className="flex flex-col gap-4">
            <div className="border-3 border-ink bg-acid p-4 text-center">
              <div className="font-mono text-[10px] text-ink/60 uppercase tracking-widest mb-2">
                CLASSMATE OTP
              </div>
              {/* Responsive OTP font size — 5xl is borderline on small phones */}
              <div className="font-mono font-bold text-4xl sm:text-5xl tracking-[0.3em] sm:tracking-[0.4em] text-ink mb-3 break-all">
                {otpData.code}
              </div>
              <button
                onClick={copyOtp}
                className="btn-secondary text-xs py-2 px-4 mx-auto min-h-[44px]"
                aria-label="Copy OTP code"
              >
                <Copy size={12} />
                {copied ? "COPIED!" : "COPY CODE"}
              </button>
            </div>
            <OtpCountdown expiresAt={otpData.expiry} onExpire={() => setOtp(null)} />
            <p className="font-mono text-xs text-danger text-center uppercase tracking-wider">
              ⚠ EXPIRES IN 2 MINUTES
            </p>
          </div>
        ) : (
          <button
            onClick={generateOtp}
            disabled={generating || trustScore < 50}
            className="btn-primary w-full justify-center"
          >
            {generating ? (
              <span className="animate-blink">GENERATING...</span>
            ) : (
              <>
                <Shield size={16} />
                GENERATE 2-MIN OTP
              </>
            )}
          </button>
        )}

        {trustScore < 50 && (
          <p className="font-mono text-xs text-danger mt-2 text-center uppercase">
            TRUST SCORE TOO LOW (need 50+)
          </p>
        )}
      </BruteCard>

      {/* TRUST BREAKDOWN */}
      <BruteCard className="p-4 sm:p-5">
        <h2 className="font-mono font-bold text-sm uppercase tracking-wider mb-4">
          TRUST SCORE BREAKDOWN
        </h2>
        <div className="flex flex-col gap-2">
          {[
            { label: "BASE",       value: 50,              color: "#D4F542" },
            { label: "CURRENT",    value: trustScore,      color: "#10B981" },
            { label: "DEDUCTIONS", value: strikeCount * 30, color: "#E11D48" },
          ].map((t) => (
            <div key={t.label} className="flex items-center gap-2 sm:gap-3">
              <span className="font-mono text-[9px] sm:text-[10px] uppercase text-ink/50 w-20 sm:w-28 shrink-0">
                {t.label}
              </span>
              <div className="flex-1 h-3 border-2 border-ink bg-paper overflow-hidden">
                <div
                  className="h-full transition-all"
                  style={{ width: `${Math.min((t.value / 100) * 100, 100)}%`, background: t.color }}
                />
              </div>
              <span className="font-mono text-xs font-bold w-7 text-right">{t.value}</span>
            </div>
          ))}
        </div>
      </BruteCard>
    </div>
  );
}
