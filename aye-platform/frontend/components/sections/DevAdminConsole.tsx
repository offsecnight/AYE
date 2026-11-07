"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Plus, Ban, Zap, AlertTriangle, AlertCircle, Trash2, MessageSquare,
  Megaphone, CheckCircle, XCircle, Clock, Upload, FileText,
} from "lucide-react";
import { BruteCard }    from "@/components/ui/BruteCard";
import { GradeDisplay } from "@/components/ui/GradeDisplay";
import { useAuthStore } from "@/lib/store";
import { cn } from "@/lib/utils";

type AdminTab = "stats" | "colleges" | "rooms" | "seed-otp" | "junk" | "bans" | "campaigns" | "issues";

const TABS: { id: AdminTab; label: string }[] = [
  { id: "stats",     label: "STATS" },
  { id: "colleges",  label: "COLLEGES" },
  { id: "rooms",     label: "ROOMS" },
  { id: "seed-otp",  label: "SEED OTP" },
  { id: "junk",      label: "JUNK QUEUE" },
  { id: "bans",      label: "HW BANS" },
  { id: "campaigns", label: "CAMPAIGNS" },
  { id: "issues",    label: "ISSUES" },
];

const API_BASE = "/api/proxy";

async function apiCall(path: string, method = "GET", body?: object, token?: string) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error((err as { message?: string }).message ?? "API error");
  }
  return res.json();
}

// ── Types ─────────────────────────────────────────────────────

interface Stats {
  colleges: number;
  active_users: number;
  total_experiences: number;
  hardware_bans: number;
}

interface College {
  college_id:             string;
  name:                   string;
  slug:                   string;
  city:                   string;
  reality_grade:          string;
  resolution_rate:        number | null;
  total_experiences:      number;
  total_resolved:         number;
  gps_lat:                number | null;
  gps_lng:                number | null;
  geofence_radius_meters: number;
}

interface JunkPost {
  post_id:                   string;
  title:                     string;
  ghost_handle:              string;
  hardware_fingerprint_hash: string;
  college:                   string;
  junk_flag_count:           number;
  aye_count:                 number;
  created_at:                string;
}

// ── Rooms Panel ───────────────────────────────────────────────

interface Room {
  room_id:    string;
  room_type:  string;
  name:       string;
  college_id: string;
  created_at: string;
  college:    { name: string; slug: string };
  _count:     { chat_messages: number };
}

function RoomsPanel({ token, colleges }: { token: string; colleges: College[] }) {
  const [rooms,    setRooms]   = useState<Room[]>([]);
  const [loading,  setLoad]    = useState(true);
  const [error,    setErr]     = useState<string | null>(null);
  const [adding,   setAdding]  = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [newRoom,  setNewRoom] = useState({
    college_id: "",
    room_type: "GLOBAL" as "GLOBAL" | "BRANCH" | "ISSUE_ROOM",
    name: "",
  });

  const ROOM_TYPES = [
    { value: "GLOBAL",     label: "# GLOBAL - All students" },
    { value: "BRANCH",     label: "# BRANCH - Specific course/branch" },
    { value: "ISSUE_ROOM", label: "! ISSUE ROOM - Linked to a post" },
  ];

  function loadRooms() {
    setLoad(true);
    setErr(null);
    apiCall("/dev-admin/rooms", "GET", undefined, token)
      .then((r) => setRooms((r as { rooms: Room[] }).rooms))
      .catch((e: unknown) => setErr(e instanceof Error ? e.message : "Failed to load rooms"))
      .finally(() => setLoad(false));
  }

  useEffect(() => { loadRooms(); }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  async function createRoom(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      await apiCall("/dev-admin/rooms", "POST", {
        college_id: newRoom.college_id,
        room_type:  newRoom.room_type,
        name:       newRoom.name,
      }, token);
      setAdding(false);
      setNewRoom({ college_id: "", room_type: "GLOBAL", name: "" });
      loadRooms();
    } catch (err: unknown) {
      setErr(err instanceof Error ? err.message : "Failed to create room");
    }
  }

  async function deleteRoom(roomId: string, roomName: string) {
    if (!confirm(`Delete room "${roomName}"? All messages will be lost.`)) return;
    setDeleting(roomId);
    try {
      await apiCall(`/dev-admin/rooms/${roomId}`, "DELETE", undefined, token);
      setRooms((r) => r.filter((x) => x.room_id !== roomId));
    } catch (err: unknown) {
      setErr(err instanceof Error ? err.message : "Failed to delete room");
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-3">
        <h2 className="font-mono font-bold text-sm uppercase">CHAT ROOMS</h2>
        <button className="btn-primary" onClick={() => setAdding((v) => !v)}>
          <Plus size={14} />CREATE ROOM
        </button>
      </div>

      {error && (
        <div className="brute-card p-3 mb-4 border-t-4 border-danger">
          <p className="font-mono text-xs text-danger uppercase">{error}</p>
        </div>
      )}

      {adding && (
        <BruteCard className="p-5 mb-5" accent="acid">
          <h3 className="font-mono font-bold text-sm uppercase mb-4 flex items-center gap-2">
            <MessageSquare size={14} /> NEW CHAT ROOM
          </h3>
          <form onSubmit={createRoom} className="flex flex-col gap-4">
            <div>
              <label className="font-mono text-[10px] uppercase tracking-widest text-ink/50 block mb-1">COLLEGE *</label>
              <select className="brute-input" value={newRoom.college_id}
                onChange={(e) => setNewRoom((r) => ({ ...r, college_id: e.target.value }))} required>
                <option value="">Select college...</option>
                {colleges.map((c) => <option key={c.college_id} value={c.college_id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="font-mono text-[10px] uppercase tracking-widest text-ink/50 block mb-1">ROOM TYPE *</label>
              <div className="flex flex-col gap-2">
                {ROOM_TYPES.map((t) => (
                  <button key={t.value} type="button"
                    onClick={() => setNewRoom((r) => ({ ...r, room_type: t.value as "GLOBAL" | "BRANCH" | "ISSUE_ROOM" }))}
                    className={cn("text-left px-4 py-3 border-2 border-ink font-mono text-xs font-bold uppercase transition-colors min-h-[48px]",
                      newRoom.room_type === t.value ? "bg-ink text-acid" : "bg-white text-ink")}>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="font-mono text-[10px] uppercase tracking-widest text-ink/50 block mb-1">ROOM NAME *</label>
              <input className="brute-input" placeholder="# campus-general"
                value={newRoom.name} onChange={(e) => setNewRoom((r) => ({ ...r, name: e.target.value }))} required />
            </div>
            <div className="flex gap-3">
              <button type="submit" className="btn-primary"><Plus size={14} />CREATE ROOM</button>
              <button type="button" className="btn-secondary" onClick={() => setAdding(false)}>CANCEL</button>
            </div>
          </form>
        </BruteCard>
      )}

      {loading ? (
        <div className="flex flex-col gap-3">{[1,2,3].map((i) => <div key={i} className="brute-card h-16 animate-pulse" />)}</div>
      ) : rooms.length === 0 ? (
        <BruteCard className="p-10 text-center">
          <p className="font-mono text-sm text-ink/40 uppercase tracking-widest">NO ROOMS YET</p>
        </BruteCard>
      ) : (
        <div className="border-3 border-ink shadow-brutal overflow-x-auto">
          <table className="w-full min-w-[500px]">
            <thead className="bg-ink text-acid">
              <tr>
                {["NAME", "TYPE", "COLLEGE", "MESSAGES", ""].map((h, i) => (
                  <th key={i} className="px-4 py-3 text-left font-mono text-xs uppercase tracking-widest border-r-2 border-acid/20 last:border-r-0" scope="col">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rooms.map((r) => (
                <tr key={r.room_id} className="border-t-2 border-ink hover:bg-acid/5">
                  <td className="px-4 py-3 font-mono text-xs font-bold">{r.name}</td>
                  <td className="px-4 py-3 font-mono text-xs">{r.room_type.replace("_", " ")}</td>
                  <td className="px-4 py-3 font-mono text-xs text-ink/60 truncate max-w-[160px]">{r.college.name}</td>
                  <td className="px-4 py-3 font-mono text-xs">{r._count.chat_messages}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => deleteRoom(r.room_id, r.name)} disabled={deleting === r.room_id}
                      className="flex items-center gap-1 px-2 py-1.5 border-2 border-ink font-mono text-[10px] uppercase hover:bg-danger hover:text-white transition-colors min-h-[36px]">
                      <Trash2 size={10} />{deleting === r.room_id ? "..." : "DELETE"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Junk Queue Panel ──────────────────────────────────────────

function JunkQueuePanel({ token, onBanSuccess }: { token: string; onBanSuccess: () => void }) {
  const [posts,        setPosts]   = useState<JunkPost[]>([]);
  const [loading,      setLoad]    = useState(true);
  const [banErr,       setBanErr]  = useState<string | null>(null);
  const [banningId,    setBanning] = useState<string | null>(null);
  const [manualId,     setManualId] = useState("");
  const [manualReason, setReason]  = useState("");

  useEffect(() => {
    apiCall("/dev-admin/flagged-junk", "GET", undefined, token)
      .then((r) => setPosts((r as { posts: JunkPost[] }).posts))
      .catch(() => {})
      .finally(() => setLoad(false));
  }, [token]);

  async function quickBan(post: JunkPost) {
    setBanning(post.post_id);
    setBanErr(null);
    try {
      await apiCall("/dev-admin/ban-user", "POST",
        { user_id: post.post_id, reason: `Junk post: ${post.title.slice(0, 80)}` }, token);
      setPosts((p) => p.filter((x) => x.post_id !== post.post_id));
      onBanSuccess();
    } catch (err: unknown) {
      setBanErr(err instanceof Error ? err.message : "Ban failed");
    } finally {
      setBanning(null);
    }
  }

  async function manualBan(e: React.FormEvent) {
    e.preventDefault();
    setBanErr(null);
    try {
      await apiCall("/dev-admin/ban-user", "POST", { user_id: manualId, reason: manualReason }, token);
      setManualId(""); setReason("");
      alert("Hardware ban issued successfully");
      onBanSuccess();
    } catch (err: unknown) {
      setBanErr(err instanceof Error ? err.message : "Ban failed");
    }
  }

  return (
    <div>
      <h2 className="font-mono font-bold text-sm uppercase mb-4">FLAGGED JUNK QUEUE</h2>
      {banErr && <div className="brute-card p-3 mb-4 border-danger"><p className="font-mono text-xs text-danger uppercase">{banErr}</p></div>}
      {loading ? (
        <div className="flex flex-col gap-3">{[1,2,3].map((i) => <div key={i} className="brute-card h-16 animate-pulse" />)}</div>
      ) : posts.length === 0 ? (
        <BruteCard className="p-8 text-center" accent="none">
          <p className="font-mono text-sm text-emerald uppercase tracking-widest">JUNK QUEUE CLEAR</p>
        </BruteCard>
      ) : (
        <div className="flex flex-col gap-3 mb-6">
          {posts.map((p) => (
            <BruteCard key={p.post_id} className="p-4 flex items-center gap-4" accent="danger">
              <AlertTriangle size={18} className="text-danger shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-mono text-sm font-bold truncate uppercase">{p.title}</p>
                <p className="font-mono text-xs text-ink/50 uppercase">
                  @{p.ghost_handle} · {p.college} · {p.junk_flag_count} flags · {p.aye_count} ayes
                </p>
              </div>
              <button onClick={() => quickBan(p)} disabled={banningId === p.post_id} className="btn-danger text-xs py-1.5 px-3 shrink-0">
                <Ban size={12} />{banningId === p.post_id ? "BANNING..." : "HW BAN"}
              </button>
            </BruteCard>
          ))}
        </div>
      )}
      <BruteCard className="p-5" accent="danger">
        <h3 className="font-mono font-bold text-sm uppercase mb-4 flex items-center gap-2"><Ban size={14} /> MANUAL HARDWARE BAN</h3>
        <form onSubmit={manualBan} className="flex flex-col gap-3 max-w-md">
          <div>
            <label className="font-mono text-[10px] uppercase tracking-widest text-ink/50 block mb-1">USER ID (UUID) *</label>
            <input className="brute-input font-mono text-xs" placeholder="00000000-0000-0000-0000-000000000000"
              value={manualId} onChange={(e) => setManualId(e.target.value)} required />
          </div>
          <div>
            <label className="font-mono text-[10px] uppercase tracking-widest text-ink/50 block mb-1">REASON *</label>
            <input className="brute-input" placeholder="Serial troll / harassment"
              value={manualReason} onChange={(e) => setReason(e.target.value)} required />
          </div>
          <button type="submit" className="btn-danger justify-center"><Ban size={14} />EXECUTE HARDWARE BAN</button>
        </form>
      </BruteCard>
    </div>
  );
}

// ── Main DevAdminConsole ──────────────────────────────────────

export function DevAdminConsole() {
  const router   = useRouter();
  const { user } = useAuthStore();

  const [tab,      setTab]     = useState<AdminTab>("stats");
  const [adding,   setAdding]  = useState(false);
  const [stats,    setStats]   = useState<Stats | null>(null);
  const [colleges, setCols]    = useState<College[]>([]);
  const [loading,  setLoading] = useState(false);
  const [error,    setError]   = useState<string | null>(null);

  const [newCollege, setNew] = useState({
    name: "", slug: "", city: "", gps_lat: "", gps_lng: "", geofence_radius_meters: "500",
  });

  const [seedCollegeId, setSeedCol]   = useState("");
  const [seedCount,     setSeedCount] = useState("10");
  const [seedResult,    setSeedResult] = useState<string[] | null>(null);

  useEffect(() => {
    if (!user)                           { router.push("/auth"); return; }
    if (user.role !== "DEV_SUPER_ADMIN") { router.push("/");    return; }
  }, [user, router]);

  const loadColleges = (token: string) =>
    apiCall("/dev-admin/colleges", "GET", undefined, token).then((r) =>
      setCols((r as { colleges: College[] }).colleges));

  useEffect(() => {
    if (!user?.token) return;
    setLoading(true);
    setError(null);
    Promise.all([
      apiCall("/dev-admin/stats",    "GET", undefined, user.token),
      apiCall("/dev-admin/colleges", "GET", undefined, user.token),
    ])
      .then(([s, c]) => { setStats(s as Stats); setCols((c as { colleges: College[] }).colleges); })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Load failed"))
      .finally(() => setLoading(false));
  }, [user?.token]);

  if (!user || user.role !== "DEV_SUPER_ADMIN") return null;

  async function addCollege(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!user) return;
    try {
      await apiCall("/dev-admin/colleges", "POST", {
        name:                   newCollege.name,
        slug:                   newCollege.slug,
        city:                   newCollege.city,
        gps_lat:                parseFloat(newCollege.gps_lat),
        gps_lng:                parseFloat(newCollege.gps_lng),
        geofence_radius_meters: parseInt(newCollege.geofence_radius_meters),
      }, user.token);
      setAdding(false);
      setNew({ name: "", slug: "", city: "", gps_lat: "", gps_lng: "", geofence_radius_meters: "500" });
      await loadColleges(user.token);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to add college");
    }
  }

  async function generateSeedOtps(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!user) return;
    try {
      const res = await apiCall("/dev-admin/seed-otp", "POST",
        { college_id: seedCollegeId, count: parseInt(seedCount) }, user.token);
      setSeedResult((res as { codes: { otp_code: string }[] }).codes.map((c) => c.otp_code));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to generate seed OTPs");
    }
  }

  const fmtGps  = (v: number | null | undefined) => v != null ? Number(v).toFixed(4) : "-";
  const fmtRate = (v: number | null | undefined) => (v ?? 0).toFixed(0);

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <div className="bg-danger text-white font-mono font-bold text-sm px-3 py-1.5 border-3 border-ink shadow-brutal">
          DEV SUPER-ADMIN
        </div>
        <div>
          <div className="section-label mb-1">PLATFORM CONTROL</div>
          <h1 className="font-mono font-bold text-3xl uppercase">ADMIN CONSOLE</h1>
        </div>
      </div>

      {error && (
        <div className="brute-card p-3 mb-4 flex items-center gap-2 border-t-4 border-danger">
          <AlertCircle size={14} className="text-danger shrink-0" />
          <p className="font-mono text-xs text-danger uppercase">{error}</p>
        </div>
      )}

      {/* TAB BAR */}
      <div className="flex flex-wrap border-3 border-ink mb-6 shadow-brutal">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={cn("py-2.5 font-mono font-bold text-[11px] uppercase tracking-wider",
              "border-r-2 border-b-2 border-ink transition-colors whitespace-nowrap px-3 last:border-r-0",
              tab === t.id ? "bg-ink text-acid" : "bg-paper text-ink hover:bg-acid/20")}>
            {t.label}
          </button>
        ))}
      </div>

      {/* STATS */}
      {tab === "stats" && (
        <div>
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[1,2,3,4].map((i) => <div key={i} className="brute-card p-6 h-24 animate-pulse" />)}
            </div>
          ) : stats ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: "COLLEGES",     value: stats.colleges,          color: "text-acid" },
                { label: "ACTIVE USERS", value: stats.active_users,      color: "text-emerald" },
                { label: "EXPERIENCES",  value: stats.total_experiences, color: "text-ink" },
                { label: "HW BANS",      value: stats.hardware_bans,     color: "text-danger" },
              ].map((s) => (
                <BruteCard key={s.label} className="p-6 text-center">
                  <div className={`font-mono font-bold text-4xl ${s.color} mb-2`}>{s.value}</div>
                  <div className="font-mono text-[10px] text-ink/40 uppercase tracking-widest">{s.label}</div>
                </BruteCard>
              ))}
            </div>
          ) : <p className="font-mono text-xs text-ink/40 uppercase">No data</p>}
        </div>
      )}

      {/* COLLEGES */}
      {tab === "colleges" && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-mono font-bold text-sm uppercase">REGISTERED COLLEGES</h2>
            <button className="btn-primary" onClick={() => setAdding((v) => !v)}>
              <Plus size={14} />ADD COLLEGE
            </button>
          </div>
          {adding && (
            <BruteCard className="p-5 mb-5" accent="acid">
              <h3 className="font-mono font-bold text-sm uppercase mb-4">NEW COLLEGE</h3>
              <form onSubmit={addCollege}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                  {[
                    { key: "name",                   label: "COLLEGE NAME", ph: "Yenepoya University", req: true },
                    { key: "slug",                   label: "SLUG",         ph: "yenepoya-blr",        req: true },
                    { key: "city",                   label: "CITY",         ph: "Bengaluru",            req: true },
                    { key: "gps_lat",                label: "GPS LAT",      ph: "12.9716",             req: true },
                    { key: "gps_lng",                label: "GPS LNG",      ph: "77.5946",             req: true },
                    { key: "geofence_radius_meters", label: "GEOFENCE (m)", ph: "500",                 req: false },
                  ].map((f) => (
                    <div key={f.key}>
                      <label className="font-mono text-[10px] uppercase tracking-widest text-ink/50 block mb-1">
                        {f.label}{f.req && " *"}
                      </label>
                      <input className="brute-input" placeholder={f.ph}
                        value={newCollege[f.key as keyof typeof newCollege]}
                        onChange={(e) => setNew((n) => ({ ...n, [f.key]: e.target.value }))}
                        required={f.req} />
                    </div>
                  ))}
                </div>
                <div className="flex gap-3">
                  <button type="submit" className="btn-primary">SAVE COLLEGE</button>
                  <button type="button" className="btn-secondary" onClick={() => setAdding(false)}>CANCEL</button>
                </div>
              </form>
            </BruteCard>
          )}
          <div className="border-3 border-ink shadow-brutal overflow-x-auto">
            <table className="w-full min-w-[560px]">
              <thead className="bg-ink text-acid">
                <tr>
                  {["NAME", "CITY", "GRADE", "RATE", "ISSUES", "GPS"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left font-mono text-xs uppercase tracking-widest border-r-2 border-acid/20 last:border-r-0" scope="col">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? [1,2].map((i) => (
                  <tr key={i} className="border-t-2 border-ink">
                    {[1,2,3,4,5,6].map((j) => <td key={j} className="px-4 py-3"><div className="h-4 bg-ink/10 animate-pulse rounded" /></td>)}
                  </tr>
                )) : colleges.map((c) => (
                  <tr key={c.college_id} className="border-t-2 border-ink hover:bg-acid/5">
                    <td className="px-4 py-3 font-mono text-xs font-bold">{c.name}</td>
                    <td className="px-4 py-3 font-mono text-xs text-ink/60 uppercase">{c.city}</td>
                    <td className="px-4 py-3"><GradeDisplay grade={c.reality_grade ?? "N/A"} size="sm" /></td>
                    <td className="px-4 py-3 font-mono text-xs">{fmtRate(c.resolution_rate)}%</td>
                    <td className="px-4 py-3 font-mono text-xs">{c.total_experiences ?? 0}</td>
                    <td className="px-4 py-3 font-mono text-[10px] text-ink/40">{fmtGps(c.gps_lat)}, {fmtGps(c.gps_lng)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!loading && colleges.length === 0 && (
              <div className="py-10 text-center font-mono text-xs text-ink/30 uppercase">NO COLLEGES YET</div>
            )}
          </div>
        </div>
      )}

      {/* ROOMS */}
      {tab === "rooms" && <RoomsPanel token={user.token} colleges={colleges} />}

      {/* SEED OTP */}
      {tab === "seed-otp" && (
        <BruteCard className="p-6">
          <h2 className="font-mono font-bold text-sm uppercase mb-4">GENERATE SEED OTP</h2>
          <p className="font-mono text-xs text-ink/60 mb-5">Generate master invite codes for bootstrapping a new college.</p>
          <form onSubmit={generateSeedOtps} className="flex flex-col gap-4 max-w-md">
            <div>
              <label className="font-mono text-[10px] uppercase tracking-widest text-ink/50 block mb-1">SELECT COLLEGE *</label>
              <select className="brute-input" value={seedCollegeId} onChange={(e) => setSeedCol(e.target.value)} required>
                <option value="">Select college...</option>
                {colleges.map((c) => <option key={c.college_id} value={c.college_id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="font-mono text-[10px] uppercase tracking-widest text-ink/50 block mb-1">NUMBER OF CODES</label>
              <input className="brute-input" type="number" value={seedCount}
                onChange={(e) => setSeedCount(e.target.value)} min={1} max={50} />
            </div>
            <button type="submit" className="btn-inverse w-full justify-center">
              <Zap size={16} />GENERATE SEED CODES
            </button>
          </form>
          {seedResult && (
            <div className="mt-6">
              <div className="section-label mb-3 inline-block">GENERATED CODES</div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {seedResult.map((code) => (
                  <div key={code} className="border-2 border-ink bg-acid font-mono font-bold text-center py-2 text-sm tracking-widest">{code}</div>
                ))}
              </div>
              <p className="font-mono text-xs text-ink/50 mt-3 uppercase">Valid 7 days. Single-use only.</p>
            </div>
          )}
        </BruteCard>
      )}

      {/* JUNK QUEUE */}
      {tab === "junk" && <JunkQueuePanel token={user.token} onBanSuccess={() => {}} />}

      {/* HW BANS */}
      {tab === "bans" && (
        <div>
          <h2 className="font-mono font-bold text-sm uppercase mb-4">HARDWARE BAN REGISTRY</h2>
          <BruteCard className="p-4" accent="none">
            <p className="font-mono text-xs text-ink/60 uppercase">
              Hardware bans live in the <code className="bg-ink/10 px-1">banned_fingerprints</code> table.
              Auto-bans trigger after 2 strikes. Use the JUNK QUEUE tab for manual bans.
            </p>
          </BruteCard>
        </div>
      )}

      {/* CAMPAIGNS */}
      {tab === "campaigns" && <CampaignPanel token={user.token} colleges={colleges} />}

      {/* ISSUES */}
      {tab === "issues" && <IssuesPanel token={user.token} />}
    </div>
  );
}

// ── Campaign helpers ──────────────────────────────────────────

interface Campaign {
  campaign_id:   string;
  college_id:    string;
  title:         string;
  description:   string;
  reward_points: number;
  status:        "DRAFT" | "ACTIVE" | "PAUSED" | "CLOSED";
  starts_at:     string;
  ends_at:       string;
  created_at:    string;
  college:       { name: string; slug: string };
  _count:        { submissions: number };
}

interface CampaignSubmission {
  submission_id:   string;
  campaign_id:     string;
  submitted_by:    string;
  title:           string;
  description:     string;
  encrypted_files: { storedName: string; originalName: string; mimeType: string; size: number }[];
  status:          "PENDING" | "APPROVED" | "REJECTED";
  reward_granted:  boolean;
  admin_note:      string | null;
  submitted_at:    string;
  reviewed_at:     string | null;
  submitter:       { ghost_handle: string; trust_score: number };
}

type CampaignSubTab = "list" | "create" | "submissions";

const STATUS_COLORS: Record<string, string> = {
  DRAFT:    "bg-ink/20 text-ink",
  ACTIVE:   "bg-emerald/20 text-emerald",
  PAUSED:   "bg-amber/20 text-amber",
  CLOSED:   "bg-danger/20 text-danger",
  PENDING:  "bg-amber/20 text-amber",
  APPROVED: "bg-emerald/20 text-emerald",
  REJECTED: "bg-danger/20 text-danger",
};

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtBytes(b: number) {
  if (b < 1024)        return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

// ── Campaign Panel ────────────────────────────────────────────

function CampaignPanel({ token, colleges }: { token: string; colleges: College[] }) {
  const [subTab,      setSubTab]    = useState<CampaignSubTab>("list");
  const [campaigns,   setCampaigns] = useState<Campaign[]>([]);
  const [loading,     setLoading]   = useState(true);
  const [error,       setError]     = useState<string | null>(null);
  const [saving,      setSaving]    = useState(false);
  const [viewCampaign, setViewCampaign] = useState<Campaign | null>(null);
  const [submissions,  setSubmissions]  = useState<CampaignSubmission[]>([]);
  const [subLoading,   setSubLoading]   = useState(false);
  const [reviewing,    setReviewing]    = useState<string | null>(null);
  const [editing,    setEditing]    = useState<string | null>(null);
  const [editStatus, setEditStatus] = useState<string>("DRAFT");
  const [form, setForm] = useState({
    college_id: "", title: "", description: "", reward_points: "10", status: "DRAFT", starts_at: "", ends_at: "",
  });

  const loadCampaigns = async () => {
    setLoading(true); setError(null);
    try {
      const r = await apiCall("/dev-admin/campaigns", "GET", undefined, token);
      setCampaigns((r as { campaigns: Campaign[] }).campaigns);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load campaigns");
    } finally { setLoading(false); }
  };

  useEffect(() => { loadCampaigns(); }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadSubmissions = async (campaign: Campaign) => {
    setViewCampaign(campaign); setSubTab("submissions"); setSubLoading(true);
    try {
      const r = await apiCall(`/dev-admin/campaigns/${campaign.campaign_id}/submissions`, "GET", undefined, token);
      setSubmissions((r as { submissions: CampaignSubmission[] }).submissions);
    } catch { setSubmissions([]); }
    finally { setSubLoading(false); }
  };

  async function createCampaign(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError(null);
    try {
      await apiCall("/dev-admin/campaigns", "POST", { ...form, reward_points: parseInt(form.reward_points) }, token);
      setForm({ college_id: "", title: "", description: "", reward_points: "10", status: "DRAFT", starts_at: "", ends_at: "" });
      setSubTab("list");
      await loadCampaigns();
    } catch (e: unknown) { setError(e instanceof Error ? e.message : "Failed to create campaign"); }
    finally { setSaving(false); }
  }

  async function updateStatus(campaignId: string, status: string) {
    try { await apiCall(`/dev-admin/campaigns/${campaignId}`, "PATCH", { status }, token); setEditing(null); await loadCampaigns(); }
    catch (e: unknown) { setError(e instanceof Error ? e.message : "Failed to update"); }
  }

  async function deleteCampaign(campaign: Campaign) {
    if (!confirm(`Delete campaign "${campaign.title}"?`)) return;
    try { await apiCall(`/dev-admin/campaigns/${campaign.campaign_id}`, "DELETE", undefined, token); await loadCampaigns(); }
    catch (e: unknown) { setError(e instanceof Error ? e.message : "Failed to delete campaign"); }
  }

  async function reviewSubmission(subId: string, status: "APPROVED" | "REJECTED", note: string) {
    setReviewing(subId);
    try {
      await apiCall(`/dev-admin/campaigns/submissions/${subId}`, "PATCH", { status, admin_note: note || undefined }, token);
      if (viewCampaign) await loadSubmissions(viewCampaign);
    } catch (e: unknown) { setError(e instanceof Error ? e.message : "Review failed"); }
    finally { setReviewing(null); }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Megaphone size={16} className="text-acid" />
          <h2 className="font-mono font-bold text-sm uppercase">CAMPAIGN MANAGER</h2>
        </div>
        <div className="flex border-2 border-ink overflow-hidden">
          {(["list", "create"] as CampaignSubTab[]).map((t) => (
            <button key={t} onClick={() => { setSubTab(t); setViewCampaign(null); }}
              className={cn("px-3 py-1.5 font-mono text-xs uppercase font-bold border-r-2 border-ink last:border-r-0",
                subTab === t ? "bg-ink text-acid" : "bg-paper text-ink hover:bg-acid/20")}>
              {t === "list" ? "ALL CAMPAIGNS" : "+ NEW CAMPAIGN"}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="brute-card p-3 mb-4 flex items-center gap-2 border-t-4 border-danger">
          <AlertCircle size={14} className="text-danger shrink-0" />
          <p className="font-mono text-xs text-danger uppercase">{error}</p>
        </div>
      )}

      {subTab === "list" && (
        <div>
          {loading ? (
            <div className="flex flex-col gap-3">{[1,2,3].map((i) => <div key={i} className="brute-card h-20 animate-pulse" />)}</div>
          ) : campaigns.length === 0 ? (
            <BruteCard className="p-8 text-center" accent="none">
              <Megaphone size={32} className="mx-auto mb-3 text-ink/20" />
              <p className="font-mono text-sm text-ink/40 uppercase tracking-widest">NO CAMPAIGNS YET</p>
            </BruteCard>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-3 border-ink shadow-brutal text-sm">
                <thead className="bg-ink text-acid">
                  <tr>
                    {["TITLE","COLLEGE","REWARD","STATUS","SUBMISSIONS","DATES","ACTIONS"].map((h) => (
                      <th key={h} className="px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-left border-r-2 border-acid/20 last:border-r-0">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {campaigns.map((c) => (
                    <tr key={c.campaign_id} className="border-t-2 border-ink hover:bg-acid/5">
                      <td className="px-4 py-3">
                        <p className="font-mono text-xs font-bold max-w-[160px] truncate">{c.title}</p>
                        <p className="font-mono text-[10px] text-ink/40 max-w-[160px] truncate">{c.description}</p>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-ink/60">{c.college.name}</td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs font-bold text-acid bg-ink px-2 py-0.5">+{c.reward_points} PTS</span>
                      </td>
                      <td className="px-4 py-3">
                        {editing === c.campaign_id ? (
                          <div className="flex items-center gap-1">
                            <select className="brute-input text-[10px] py-1 px-1 font-mono" value={editStatus}
                              onChange={(e) => setEditStatus(e.target.value)}>
                              {["DRAFT","ACTIVE","PAUSED","CLOSED"].map((s) => <option key={s} value={s}>{s}</option>)}
                            </select>
                            <button onClick={() => updateStatus(c.campaign_id, editStatus)}
                              className="font-mono text-[10px] px-1.5 py-1 bg-acid text-ink border-2 border-ink font-bold">OK</button>
                            <button onClick={() => setEditing(null)}
                              className="font-mono text-[10px] px-1.5 py-1 border-2 border-ink">X</button>
                          </div>
                        ) : (
                          <button onClick={() => { setEditing(c.campaign_id); setEditStatus(c.status); }}
                            className={cn("font-mono text-[10px] px-2 py-1 border-2 border-ink/30 uppercase font-bold", STATUS_COLORS[c.status])}>
                            {c.status}
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <button onClick={() => loadSubmissions(c)}
                          className="font-mono text-xs font-bold text-acid underline underline-offset-2">
                          {c._count.submissions} VIEW
                        </button>
                      </td>
                      <td className="px-4 py-3 font-mono text-[10px] text-ink/50">
                        <div>{fmtDate(c.starts_at)}</div>
                        <div>to {fmtDate(c.ends_at)}</div>
                      </td>
                      <td className="px-4 py-3">
                        <button onClick={() => deleteCampaign(c)}
                          className="flex items-center gap-1 px-2 py-1.5 border-2 border-ink font-mono text-[10px] uppercase hover:bg-danger hover:text-white transition-colors min-h-[36px]">
                          <Trash2 size={10} />DEL
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {subTab === "create" && (
        <BruteCard className="p-6" accent="acid">
          <h3 className="font-mono font-bold text-sm uppercase mb-5 flex items-center gap-2">
            <Plus size={14} />NEW CAMPAIGN
          </h3>
          <form onSubmit={createCampaign} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="font-mono text-[10px] uppercase tracking-widest text-ink/50 block mb-1">COLLEGE *</label>
              <select className="brute-input font-mono text-xs w-full" value={form.college_id}
                onChange={(e) => setForm({ ...form, college_id: e.target.value })} required>
                <option value="">Select college</option>
                {colleges.map((c) => <option key={c.college_id} value={c.college_id}>{c.name}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="font-mono text-[10px] uppercase tracking-widest text-ink/50 block mb-1">CAMPAIGN TITLE *</label>
              <input className="brute-input font-mono text-xs w-full" placeholder="e.g. Report Broken Lab Equipment"
                value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required minLength={5} maxLength={140} />
            </div>
            <div className="sm:col-span-2">
              <label className="font-mono text-[10px] uppercase tracking-widest text-ink/50 block mb-1">DESCRIPTION *</label>
              <textarea className="brute-input font-mono text-xs w-full min-h-[80px] resize-y"
                placeholder="What problem areas should students document?"
                value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required minLength={20} />
            </div>
            <div>
              <label className="font-mono text-[10px] uppercase tracking-widest text-ink/50 block mb-1">REWARD POINTS *</label>
              <input type="number" min={1} max={1000} className="brute-input font-mono text-xs w-full"
                value={form.reward_points} onChange={(e) => setForm({ ...form, reward_points: e.target.value })} required />
            </div>
            <div>
              <label className="font-mono text-[10px] uppercase tracking-widest text-ink/50 block mb-1">INITIAL STATUS</label>
              <select className="brute-input font-mono text-xs w-full" value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}>
                <option value="DRAFT">DRAFT (not visible to students)</option>
                <option value="ACTIVE">ACTIVE (open for submissions)</option>
              </select>
            </div>
            <div>
              <label className="font-mono text-[10px] uppercase tracking-widest text-ink/50 block mb-1">STARTS AT *</label>
              <input type="datetime-local" className="brute-input font-mono text-xs w-full"
                value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} required />
            </div>
            <div>
              <label className="font-mono text-[10px] uppercase tracking-widest text-ink/50 block mb-1">ENDS AT *</label>
              <input type="datetime-local" className="brute-input font-mono text-xs w-full"
                value={form.ends_at} onChange={(e) => setForm({ ...form, ends_at: e.target.value })} required />
            </div>
            <div className="sm:col-span-2 flex gap-3 pt-2">
              <button type="submit" disabled={saving} className="btn-primary">
                <Megaphone size={14} />{saving ? "CREATING..." : "CREATE CAMPAIGN"}
              </button>
              <button type="button" onClick={() => setSubTab("list")} className="btn-secondary">CANCEL</button>
            </div>
          </form>
        </BruteCard>
      )}

      {subTab === "submissions" && viewCampaign && (
        <div>
          <div className="flex items-center gap-3 mb-4">
            <button onClick={() => { setSubTab("list"); setViewCampaign(null); }}
              className="font-mono text-xs btn-secondary py-1.5 px-3">
              BACK
            </button>
            <div>
              <p className="font-mono text-[10px] text-ink/40 uppercase">CAMPAIGN</p>
              <p className="font-mono font-bold text-sm uppercase">{viewCampaign.title}</p>
            </div>
            <span className={cn("ml-auto font-mono text-[10px] px-2 py-1 border-2 border-ink/30 uppercase font-bold", STATUS_COLORS[viewCampaign.status])}>
              {viewCampaign.status}
            </span>
          </div>
          {subLoading ? (
            <div className="flex flex-col gap-3">{[1,2].map((i) => <div key={i} className="brute-card h-24 animate-pulse" />)}</div>
          ) : submissions.length === 0 ? (
            <BruteCard className="p-8 text-center" accent="none">
              <p className="font-mono text-sm text-ink/40 uppercase tracking-widest">NO SUBMISSIONS YET</p>
            </BruteCard>
          ) : (
            <div className="flex flex-col gap-4">
              {submissions.map((sub) => (
                <SubmissionCard key={sub.submission_id} sub={sub} token={token} reviewing={reviewing} onReview={reviewSubmission} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Submission Card ───────────────────────────────────────────

function SubmissionCard({
  sub, token, reviewing, onReview,
}: {
  sub: CampaignSubmission;
  token: string;
  reviewing: string | null;
  onReview: (id: string, status: "APPROVED" | "REJECTED", note: string) => void;
}) {
  const [noteText] = useState("");

  const accentMap: Record<string, "acid" | "danger" | "none"> = {
    PENDING: "none", APPROVED: "acid", REJECTED: "danger",
  };

  return (
    <BruteCard className="p-4" accent={accentMap[sub.status] ?? "none"}>
      <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
        <div>
          <p className="font-mono text-sm font-bold uppercase">{sub.title}</p>
          <p className="font-mono text-[10px] text-ink/50 uppercase mt-0.5">
            @{sub.submitter.ghost_handle} · Trust {sub.submitter.trust_score} · {fmtDate(sub.submitted_at)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn("font-mono text-[10px] px-2 py-1 border-2 border-ink/30 uppercase font-bold", STATUS_COLORS[sub.status])}>
            {sub.status === "PENDING" ? <Clock size={10} className="inline mr-1" /> :
             sub.status === "APPROVED" ? <CheckCircle size={10} className="inline mr-1" /> :
             <XCircle size={10} className="inline mr-1" />}
            {sub.status}
          </span>
          {sub.reward_granted && (
            <span className="font-mono text-[10px] px-2 py-0.5 bg-acid text-ink font-bold border-2 border-ink">REWARD GRANTED</span>
          )}
        </div>
      </div>
      <p className="font-mono text-xs text-ink/80 mb-3 line-clamp-3">{sub.description}</p>
      {sub.encrypted_files.length > 0 && (
        <div className="mb-3">
          <p className="font-mono text-[10px] uppercase text-ink/40 mb-1.5 flex items-center gap-1">
            <Upload size={10} /> {sub.encrypted_files.length} FILE{sub.encrypted_files.length > 1 ? "S" : ""}
          </p>
          <div className="flex flex-wrap gap-2">
            {sub.encrypted_files.map((f) => (
              <a key={f.storedName}
                href={`/api/proxy/files/${f.storedName}?mime=${encodeURIComponent(f.mimeType)}`}
                target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-2.5 py-1.5 border-2 border-ink font-mono text-[10px] uppercase hover:bg-acid/20 transition-colors">
                <FileText size={10} />
                <span className="max-w-[120px] truncate">{f.originalName}</span>
                <span className="text-ink/40">{fmtBytes(f.size)}</span>
              </a>
            ))}
          </div>
        </div>
      )}
      {sub.admin_note && (
        <div className="mb-3 p-2 bg-ink/5 border-l-4 border-ink/20">
          <p className="font-mono text-[10px] text-ink/50 uppercase mb-0.5">ADMIN NOTE</p>
          <p className="font-mono text-xs">{sub.admin_note}</p>
        </div>
      )}
      {sub.status === "PENDING" && (
        <SubmissionReview subId={sub.submission_id} reviewing={reviewing} onReview={onReview} />
      )}
    </BruteCard>
  );
}

function SubmissionReview({
  subId, reviewing, onReview,
}: {
  subId: string;
  reviewing: string | null;
  onReview: (id: string, status: "APPROVED" | "REJECTED", note: string) => void;
}) {
  const [note, setNote] = useState("");
  return (
    <div className="border-t-2 border-ink/10 pt-3 mt-1">
      <div className="flex items-end gap-2 flex-wrap">
        <div className="flex-1 min-w-[200px]">
          <label className="font-mono text-[10px] uppercase text-ink/40 block mb-1">ADMIN NOTE (optional)</label>
          <input className="brute-input font-mono text-xs w-full" placeholder="Feedback for the student..."
            value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        <button disabled={reviewing === subId} onClick={() => onReview(subId, "APPROVED", note)}
          className="flex items-center gap-1.5 px-3 py-2 bg-emerald text-white border-2 border-ink font-mono text-xs uppercase font-bold hover:opacity-90 min-h-[40px]">
          <CheckCircle size={12} />{reviewing === subId ? "..." : "APPROVE + REWARD"}
        </button>
        <button disabled={reviewing === subId} onClick={() => onReview(subId, "REJECTED", note)}
          className="btn-danger text-xs py-2 px-3 min-h-[40px]">
          <XCircle size={12} />REJECT
        </button>
      </div>
    </div>
  );
}

// ── Issues Panel ──────────────────────────────────────────────

interface IssueProof {
  interaction_id:  string;
  proof_media_url: string | null;
  comment_text:    string | null;
  created_at:      string;
  user:            { ghost_handle: string };
}

interface Issue {
  post_id:      string;
  title:        string;
  status:       string;
  severity:     string;
  category:     string;
  aye_count:    number;
  college:      string;
  ghost_handle: string;
  created_at:   string;
  proofs:       IssueProof[];
}

const ISSUE_STATUS_COLORS: Record<string, string> = {
  UNRESOLVED:   "bg-amber/20 text-amber",
  TRENDING:     "bg-acid/20 text-ink",
  FIX_PROPOSED: "bg-blue-200 text-blue-800",
  RESOLVED:     "bg-emerald/20 text-emerald",
  HIDDEN_JUNK:  "bg-danger/20 text-danger",
};

function IssuesPanel({ token }: { token: string }) {
  const [issues,   setIssues]  = useState<Issue[]>([]);
  const [loading,  setLoading] = useState(true);
  const [error,    setError]   = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [closing,  setClosing] = useState<string | null>(null);
  const [filter,   setFilter]  = useState<string>("ALL");

  useEffect(() => {
    setLoading(true);
    apiCall("/dev-admin/issues", "GET", undefined, token)
      .then((r) => setIssues((r as { issues: Issue[] }).issues))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Failed to load issues"))
      .finally(() => setLoading(false));
  }, [token]);

  async function setStatus(postId: string, status: string) {
    setClosing(postId);
    try {
      await apiCall(`/dev-admin/issues/${postId}/status`, "PATCH", { status }, token);
      setIssues((prev) => prev.map((i) => i.post_id === postId ? { ...i, status } : i));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Status update failed");
    } finally {
      setClosing(null);
    }
  }

  const filtered = filter === "ALL" ? issues : issues.filter((i) => i.status === filter);

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h2 className="font-mono font-bold text-sm uppercase">ALL ISSUES ({filtered.length})</h2>
        <div className="flex flex-wrap border-2 border-ink overflow-hidden text-[10px] font-mono font-bold">
          {["ALL","UNRESOLVED","TRENDING","FIX_PROPOSED","RESOLVED","HIDDEN_JUNK"].map((s) => (
            <button key={s} onClick={() => setFilter(s)}
              className={cn("px-2 py-1.5 border-r-2 border-ink last:border-r-0 uppercase whitespace-nowrap",
                filter === s ? "bg-ink text-acid" : "hover:bg-acid/20")}>
              {s.replace(/_/g, " ")}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="brute-card p-3 mb-4 flex items-center gap-2 border-t-4 border-danger">
          <AlertCircle size={14} className="text-danger shrink-0" />
          <p className="font-mono text-xs text-danger uppercase">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col gap-3">{[1,2,3].map((i) => <div key={i} className="brute-card h-16 animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <BruteCard className="p-8 text-center" accent="none">
          <p className="font-mono text-xs text-ink/40 uppercase">NO ISSUES MATCH THIS FILTER</p>
        </BruteCard>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((issue) => (
            <BruteCard key={issue.post_id} className="overflow-hidden" accent="none">
              <div className="p-3 flex items-start gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className={cn("font-mono text-[10px] px-1.5 py-0.5 font-bold uppercase border border-ink/20",
                      ISSUE_STATUS_COLORS[issue.status] ?? "")}>
                      {issue.status.replace(/_/g, " ")}
                    </span>
                    <span className="font-mono text-[10px] text-ink/40 uppercase">{issue.severity}</span>
                    <span className="font-mono text-[10px] text-ink/40 uppercase">{issue.category.replace(/_/g, " ")}</span>
                    <span className="font-mono text-[10px] text-ink/40">+{issue.aye_count} AYE</span>
                  </div>
                  <p className="font-mono text-sm font-bold uppercase truncate">{issue.title}</p>
                  <p className="font-mono text-[10px] text-ink/40 mt-0.5">
                    @{issue.ghost_handle} · {issue.college} · {new Date(issue.created_at).toLocaleDateString("en-IN")}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0 flex-wrap">
                  {issue.proofs.length > 0 && (
                    <button onClick={() => setExpanded(expanded === issue.post_id ? null : issue.post_id)}
                      className="font-mono text-[10px] px-2 py-1.5 border-2 border-ink uppercase font-bold hover:bg-acid/20 min-h-[36px]">
                      {expanded === issue.post_id ? "HIDE PROOFS" : `PROOFS (${issue.proofs.length})`}
                    </button>
                  )}
                  {issue.status !== "RESOLVED" && (
                    <button onClick={() => setStatus(issue.post_id, "RESOLVED")} disabled={closing === issue.post_id}
                      className="font-mono text-[10px] px-2 py-1.5 border-2 border-emerald text-emerald uppercase font-bold hover:bg-emerald hover:text-white transition-colors min-h-[36px]">
                      {closing === issue.post_id ? "..." : "CLOSE"}
                    </button>
                  )}
                  {issue.status !== "HIDDEN_JUNK" && (
                    <button onClick={() => setStatus(issue.post_id, "HIDDEN_JUNK")} disabled={closing === issue.post_id}
                      className="font-mono text-[10px] px-2 py-1.5 border-2 border-ink uppercase font-bold hover:bg-danger hover:text-white transition-colors min-h-[36px]">
                      HIDE
                    </button>
                  )}
                  {issue.status === "RESOLVED" && (
                    <button onClick={() => setStatus(issue.post_id, "UNRESOLVED")} disabled={closing === issue.post_id}
                      className="font-mono text-[10px] px-2 py-1.5 border-2 border-ink/30 uppercase font-bold hover:bg-ink/10 transition-colors min-h-[36px]">
                      REOPEN
                    </button>
                  )}
                </div>
              </div>

              {expanded === issue.post_id && issue.proofs.length > 0 && (
                <div className="border-t-2 border-ink bg-ink/5 p-3 flex flex-col gap-3">
                  <p className="font-mono text-[10px] uppercase text-ink/50 font-bold">CROWD PROOFS</p>
                  {issue.proofs.map((proof) => {
                    let files: { storedName: string; originalName: string; mimeType: string }[] = [];
                    try {
                      if (proof.proof_media_url) {
                        const parsed = JSON.parse(proof.proof_media_url);
                        if (Array.isArray(parsed)) files = parsed;
                      }
                    } catch { /* plain string URL, not JSON */ }

                    return (
                      <div key={proof.interaction_id} className="border-2 border-ink/20 bg-paper p-3">
                        <p className="font-mono text-[10px] text-ink/50 uppercase mb-2">
                          @{proof.user.ghost_handle} · {new Date(proof.created_at).toLocaleDateString("en-IN")}
                        </p>
                        {proof.comment_text && (
                          <p className="font-mono text-xs mb-2">{proof.comment_text}</p>
                        )}
                        {files.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {files.map((f) => (
                              <a key={f.storedName}
                                href={`/api/proxy/files/${f.storedName}?mime=${encodeURIComponent(f.mimeType)}`}
                                target="_blank" rel="noopener noreferrer"
                                className="flex items-center gap-1 px-2 py-1 border-2 border-ink font-mono text-[10px] uppercase hover:bg-acid/20 transition-colors">
                                <FileText size={10} />
                                {f.originalName || f.storedName.slice(0, 12)}
                              </a>
                            ))}
                          </div>
                        ) : proof.proof_media_url ? (
                          <a href={proof.proof_media_url} target="_blank" rel="noopener noreferrer"
                            className="font-mono text-[10px] text-acid underline break-all">
                            {proof.proof_media_url}
                          </a>
                        ) : (
                          <p className="font-mono text-[10px] text-ink/30 uppercase">No files attached</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </BruteCard>
          ))}
        </div>
      )}
    </div>
  );
}
