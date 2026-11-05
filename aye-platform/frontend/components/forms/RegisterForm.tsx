"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { MapPin, Hash, RefreshCw, Shield, AlertCircle } from "lucide-react";
import { generateGhostHandle, getHardwareFingerprint } from "@/lib/utils";
import { authApi, collegesApi, CollegePublic } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { OtpCountdown } from "@/components/ui/Timer";
import { RecoveryKeycardModal } from "@/components/modals/RecoveryKeycardModal";

type VerifyMethod = "classmate_otp" | "campus_gps";

const BRANCHES = [
  "BCA", "BCA Cyber Security", "BCA Data Science",
  "B.Tech CSE", "B.Tech ECE", "B.Com", "BA", "BBA",
  "B.Sc", "B.Sc Computer Science", "MBA", "MCA", "M.Tech",
];

export function RegisterForm() {
  const [method,      setMethod]    = useState<VerifyMethod>("classmate_otp");
  const [ghostHandle, setGhost]     = useState(generateGhostHandle());
  const [colleges,    setColleges]  = useState<CollegePublic[]>([]);
  const [form,        setForm]      = useState({
    college_id: "", password: "", course_branch: "", study_year: "1", otp_code: "",
  });
  const [gpsToken,    setGpsToken]  = useState<string | null>(null);
  const [gpsChecking, setGps]       = useState(false);
  const [gpsOk,       setGpsOk]     = useState(false);
  const [loading,     setLoading]   = useState(false);
  const [error,       setError]     = useState<string | null>(null);
  const [recoveryKey, setKey]       = useState<string | null>(null);

  const { setAuth } = useAuthStore();
  const router      = useRouter();

  useEffect(() => {
    collegesApi.list()
      .then((d) => setColleges(d.colleges))
      .catch(() => {});
  }, []);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const checkGps = useCallback(async () => {
    if (!form.college_id) { setError("Select a college first"); return; }
    setGps(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const res = await authApi.verifyGps({
            college_id: form.college_id,
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          }) as { valid: boolean; gps_token: string; distance_meters: number };
          if (res.valid) { setGpsToken(res.gps_token); setGpsOk(true); }
          else setError(`Too far from campus (${res.distance_meters}m)`);
        } catch (err: unknown) {
          setError(err instanceof Error ? err.message : "GPS check failed");
        } finally { setGps(false); }
      },
      () => { setError("GPS permission denied"); setGps(false); },
      { timeout: 10_000 }
    );
  }, [form.college_id]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const fp = await getHardwareFingerprint();
      const body: Record<string, unknown> = {
        college_id:               form.college_id,
        ghost_handle:             ghostHandle,
        password:                 form.password,
        course_branch:            form.course_branch,
        study_year:               parseInt(form.study_year),
        hardware_fingerprint_hash: fp,
      };
      if (method === "classmate_otp") body.otp_code = form.otp_code;
      else {
        if (!gpsToken) { setError("Complete GPS verification first"); setLoading(false); return; }
        body.gps_token = gpsToken;
      }
      const res = await authApi.register(body) as { token: string; ghost_handle: string; secret_recovery_key: string };
      setAuth({ ghost_handle: res.ghost_handle, college_id: form.college_id, role: "STUDENT", account_status: "ACTIVE", token: res.token }, res.token);
      setKey(res.secret_recovery_key);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  if (recoveryKey) {
    return <RecoveryKeycardModal ghostHandle={ghostHandle} recoveryKey={recoveryKey} />;
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {/* SERIOUSNESS BANNER */}
      <div className="border-3 border-danger bg-danger/10 p-3">
        <p className="font-mono text-xs font-bold text-danger uppercase tracking-wider">
          ⚠ SERIOUSNESS POLICY — Real campus problems only. Jokes = permanent hardware ban.
        </p>
      </div>

      {error && (
        <div className="border-3 border-danger bg-danger/10 p-3 flex items-start gap-2">
          <AlertCircle size={14} className="text-danger shrink-0 mt-0.5" />
          <p className="font-mono text-xs text-danger uppercase tracking-wide break-words">{error}</p>
        </div>
      )}

      {/* GHOST HANDLE */}
      <div>
        <label className="font-mono text-xs font-bold uppercase tracking-wider block mb-2">GHOST HANDLE</label>
        <div className="flex gap-2">
          <input
            className="brute-input"
            value={ghostHandle}
            onChange={(e) => setGhost(e.target.value.replace(/\s/g, ""))}
            placeholder="GhostTiger_404"
            pattern="^[A-Za-z0-9_]+$"
            minLength={3}
            maxLength={30}
            required
            autoComplete="off"
          />
          <button
            type="button"
            className="min-w-[48px] min-h-[48px] flex items-center justify-center border-3 border-ink bg-white shadow-brutal shrink-0"
            onClick={() => setGhost(generateGhostHandle())}
            aria-label="Generate new ghost handle"
          >
            <RefreshCw size={14} />
          </button>
        </div>
        <p className="font-mono text-[10px] text-ink/40 mt-1 uppercase">Your anonymous identity. No real name ever.</p>
      </div>

      {/* COLLEGE */}
      <div>
        <label className="font-mono text-xs font-bold uppercase tracking-wider block mb-2">COLLEGE</label>
        <select className="brute-input" value={form.college_id} onChange={set("college_id")} required>
          <option value="">Select your campus...</option>
          {colleges.map((c) => <option key={c.college_id} value={c.college_id}>{c.name}</option>)}
        </select>
      </div>

      {/* BRANCH + YEAR */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="font-mono text-xs font-bold uppercase tracking-wider block mb-2">BRANCH</label>
          <select className="brute-input" value={form.course_branch} onChange={set("course_branch")} required>
            <option value="">Select...</option>
            {BRANCHES.map((b) => <option key={b}>{b}</option>)}
          </select>
        </div>
        <div>
          <label className="font-mono text-xs font-bold uppercase tracking-wider block mb-2">YEAR</label>
          <select className="brute-input" value={form.study_year} onChange={set("study_year")} required>
            {[1,2,3,4].map((y) => <option key={y} value={y}>Year {y}</option>)}
          </select>
        </div>
      </div>

      {/* PASSWORD */}
      <div>
        <label className="font-mono text-xs font-bold uppercase tracking-wider block mb-2">PASSWORD / PIN</label>
        <input
          type="password"
          className="brute-input"
          placeholder="Min 8 characters"
          value={form.password}
          onChange={set("password")}
          minLength={8}
          required
          autoComplete="new-password"
        />
      </div>

      {/* CAMPUS VERIFICATION */}
      <div>
        <label className="font-mono text-xs font-bold uppercase tracking-wider block mb-3">CAMPUS VERIFICATION</label>
        {/* Method toggle — full width buttons, min 48px */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          {(["classmate_otp", "campus_gps"] as VerifyMethod[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => { setMethod(m); setError(null); }}
              className={cn(
                method === m
                  ? "bg-ink text-acid border-3 border-ink"
                  : "bg-white text-ink border-3 border-ink",
                "flex items-center justify-center gap-2 py-3 font-mono font-bold text-xs uppercase tracking-wider min-h-[48px]"
              )}
            >
              {m === "classmate_otp" ? <><Hash size={12} /> OTP</> : <><MapPin size={12} /> GPS</>}
            </button>
          ))}
        </div>

        {method === "classmate_otp" ? (
          <div>
            <input
              className="brute-input"
              placeholder="6-digit code from classmate"
              value={form.otp_code}
              onChange={set("otp_code")}
              maxLength={6}
              pattern="\d{6}"
              required
              inputMode="numeric"
              autoComplete="one-time-code"
            />
            {form.otp_code.length > 0 && (
              <div className="mt-3">
                <OtpCountdown expiresAt={new Date(Date.now() + 120_000).toISOString()} />
              </div>
            )}
            <p className="font-mono text-[10px] text-ink/40 mt-2 uppercase">
              Ask a verified classmate to generate a code from their Ghost Profile
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={checkGps}
              disabled={gpsChecking || gpsOk}
              className={gpsOk ? "btn-secondary w-full justify-center" : "btn-primary w-full justify-center"}
            >
              {gpsChecking
                ? <span className="animate-blink">LOCATING...</span>
                : gpsOk
                ? <><Shield size={14} /> ✓ CAMPUS VERIFIED</>
                : <><MapPin size={14} /> CHECK CAMPUS GPS</>}
            </button>
            {!gpsOk && (
              <p className="font-mono text-xs text-ink/50 uppercase text-center">
                Must be within campus boundaries (≤500m)
              </p>
            )}
          </div>
        )}
      </div>

      <button type="submit" disabled={loading} className="btn-primary w-full justify-center">
        {loading
          ? <span className="animate-blink">CREATING GHOST...</span>
          : <><Shield size={16} /> CREATE GHOST IDENTITY</>}
      </button>
    </form>
  );
}

// helper — inline cn to avoid circular import
function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}
