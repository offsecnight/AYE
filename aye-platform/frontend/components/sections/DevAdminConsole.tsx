"use client";

import { useState, useEffect } from "react";
import { useRouter }    from "next/navigation";
import { Plus, Ban, Zap, AlertTriangle, AlertCircle, Trash2, MessageSquare } from "lucide-react";
import { BruteCard }    from "@/components/ui/BruteCard";
import { GradeDisplay } from "@/components/ui/GradeDisplay";
import { useAuthStore } from "@/lib/store";
import { cn } from "@/lib/utils";

type AdminTab = "stats" | "colleges" | "rooms" | "seed-otp" | "junk" | "bans";

const TABS: { id: AdminTab; label: string }[] = [
  { id: "stats",    label: "STATS" },
  { id: "colleges", label: "COLLEGES" },
  { id: "rooms",    label: "ROOMS" },
  { id: "seed-otp", label: "SEED OTP" },
  { id: "junk",     label: "JUNK QUEUE" },
  { id: "bans",     label: "HW BANS" },
];

// All client-side calls go through same-origin proxy → backend
const API_BASE = "/api/proxy";

async function apiCall(
  path: string,
  method = "GET",
  body?: object,
  token?: string
) {
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
    throw new Error(err.message ?? "API error");
  }
  return res.json();
}

// ── Types ────────────────────────────────────────────────────

interface Stats {
  colleges: number;
  active_users: number;
  total_experiences: number;
  hardware_bans: number;
}

interface College {
  college_id:        string;
  name:              string;
  slug:              string;
  city:              string;
  reality_grade:     string;
  resolution_rate:   number | null;
  total_experiences: number;
  total_resolved:    number;
  gps_lat:           number | null;
  gps_lng:           number | null;
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

// ── Rooms Panel ──────────────────────────────────────────────

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
  const [rooms,     setRooms]   = useState<Room[]>([]);
  const [loading,   setLoad]    = useState(true);
  const [error,     setErr]     = useState<string | null>(null);
  const [adding,    setAdding]  = useState(false);
  const [deleting,  setDeleting]= useState<string | null>(null);
  const [newRoom,   setNewRoom] = useState({
    college_id: "",
    room_type:  "GLOBAL" as "GLOBAL" | "BRANCH" | "ISSUE_ROOM",
    name:       "",
  });

  const ROOM_TYPES = [
    { value: "GLOBAL",     label: "# GLOBAL — All students" },
    { value: "BRANCH",     label: "# BRANCH — Specific course/branch" },
    { value: "ISSUE_ROOM", label: "⚡ ISSUE ROOM — Linked to a post" },
  ];

  function loadRooms() {
    setLoad(true);
    setErr(null);
    apiCall("/dev-admin/rooms", "GET", undefined, token)
      .then((r) => setRooms((r as { rooms: Room[] }).rooms))
      .catch((e: unknown) => setErr(e instanceof Error ? e.message : "Failed to load rooms"))
      .finally(() => setLoad(false));
  }

  useEffect(() => { loadRooms(); }, [token]);

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

  const roomTypeIcon = (t: string) =>
    t === "ISSUE_ROOM" ? "⚡" : t === "BRANCH" ? "#" : "#";

  const roomTypeColor = (t: string) =>
    t === "ISSUE_ROOM" ? "badge-amber" : t === "BRANCH" ? "badge-acid" : "badge badge-outline";

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-3">
        <h2 className="font-mono font-bold text-sm uppercase">CHAT ROOMS</h2>
        <button className="btn-primary" onClick={() => setAdding((v) => !v)}>
          <Plus size={14} />
          CREATE ROOM
        </button>
      </div>

      {error && (
        <div className="brute-card p-3 mb-4 border-t-4 border-danger">
          <p className="font-mono text-xs text-danger uppercase">{error}</p>
        </div>
      )}

      {/* CREATE ROOM FORM */}
      {adding && (
        <BruteCard className="p-5 mb-5" accent="acid">
          <h3 className="font-mono font-bold text-sm uppercase mb-4 flex items-center gap-2">
            <MessageSquare size={14} /> NEW CHAT ROOM
          </h3>
          <form onSubmit={createRoom} className="flex flex-col gap-4">
            {/* College */}
            <div>
              <label className="font-mono text-[10px] uppercase tracking-widest text-ink/50 block mb-1">
                COLLEGE *
              </label>
              <select
                className="brute-input"
                value={newRoom.college_id}
                onChange={(e) => setNewRoom((r) => ({ ...r, college_id: e.target.value }))}
                required
              >
                <option value="">Select college...</option>
                {colleges.map((c) => (
                  <option key={c.college_id} value={c.college_id}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* Room type */}
            <div>
              <label className="font-mono text-[10px] uppercase tracking-widest text-ink/50 block mb-1">
                ROOM TYPE *
              </label>
              <div className="flex flex-col gap-2">
                {ROOM_TYPES.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setNewRoom((r) => ({ ...r, room_type: t.value as "GLOBAL" | "BRANCH" | "ISSUE_ROOM" }))}
                    className={cn(
                      "text-left px-4 py-3 border-2 border-ink font-mono text-xs font-bold uppercase transition-colors min-h-[48px]",
                      newRoom.room_type === t.value ? "bg-ink text-acid" : "bg-white text-ink"
                    )}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Room name */}
            <div>
              <label className="font-mono text-[10px] uppercase tracking-widest text-ink/50 block mb-1">
                ROOM NAME *
              </label>
              <input
                className="brute-input"
                placeholder={
                  newRoom.room_type === "BRANCH"     ? "# bca-cyber-2026" :
                  newRoom.room_type === "ISSUE_ROOM" ? "⚡ wifi-outage-oct" :
                  "# campus-general"
                }
                value={newRoom.name}
                onChange={(e) => setNewRoom((r) => ({ ...r, name: e.target.value }))}
                required
              />
            </div>

            <div className="flex gap-3">
              <button type="submit" className="btn-primary">
                <Plus size={14} />
                CREATE ROOM
              </button>
              <button type="button" className="btn-secondary" onClick={() => setAdding(false)}>
                CANCEL
              </button>
            </div>
          </form>
        </BruteCard>
      )}

      {/* ROOMS LIST */}
      {loading ? (
        <div className="flex flex-col gap-3">
          {[1,2,3].map((i) => <div key={i} className="brute-card h-16 animate-pulse" />)}
        </div>
      ) : rooms.length === 0 ? (
        <BruteCard className="p-10 text-center">
          <p className="font-mono text-sm text-ink/40 uppercase tracking-widest mb-3">
            NO ROOMS YET
          </p>
          <p className="font-mono text-xs text-ink/30 uppercase">
            Rooms are auto-created when a college is added (GLOBAL) or when a post hits 25 AYEs (ISSUE ROOM).
            Use CREATE ROOM to add manual rooms.
          </p>
        </BruteCard>
      ) : (
        <div className="border-3 border-ink shadow-brutal overflow-x-auto">
          <table className="w-full min-w-[500px]">
            <thead className="bg-ink text-acid">
              <tr>
                {["NAME", "TYPE", "COLLEGE", "MESSAGES", ""].map((h, i) => (
                  <th key={i} className="px-4 py-3 text-left font-mono text-xs uppercase tracking-widest border-r-2 border-acid/20 last:border-r-0" scope="col">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rooms.map((r) => (
                <tr key={r.room_id} className="border-t-2 border-ink hover:bg-acid/5">
                  <td className="px-4 py-3 font-mono text-xs font-bold">
                    {roomTypeIcon(r.room_type)} {r.name.replace(/^[#⚡]\s?/, "")}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`badge ${roomTypeColor(r.room_type)}`}>
                      {r.room_type.replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-ink/60 truncate max-w-[160px]">
                    {r.college.name}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">
                    {r._count.chat_messages}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => deleteRoom(r.room_id, r.name)}
                      disabled={deleting === r.room_id}
                      className="flex items-center gap-1 px-2 py-1.5 border-2 border-ink font-mono text-[10px] uppercase hover:bg-danger hover:text-white transition-colors min-h-[36px]"
                      aria-label="Delete room"
                    >
                      <Trash2 size={10} />
                      {deleting === r.room_id ? "..." : "DELETE"}
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

// ── Junk Queue sub-panel ─────────────────────────────────────

function JunkQueuePanel({
  token,
  onBanSuccess,
}: {
  token: string;
  onBanSuccess: () => void;
}) {
  const [posts,        setPosts]    = useState<JunkPost[]>([]);
  const [loading,      setLoad]     = useState(true);
  const [banErr,       setBanErr]   = useState<string | null>(null);
  const [banningId,    setBanning]  = useState<string | null>(null);
  const [manualId,     setManualId] = useState("");
  const [manualReason, setReason]   = useState("");

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
      await apiCall(
        "/dev-admin/ban-user",
        "POST",
        { user_id: post.post_id, reason: `Junk post: ${post.title.slice(0, 80)}` },
        token
      );
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
      await apiCall(
        "/dev-admin/ban-user",
        "POST",
        { user_id: manualId, reason: manualReason },
        token
      );
      setManualId("");
      setReason("");
      alert("Hardware ban issued successfully");
      onBanSuccess();
    } catch (err: unknown) {
      setBanErr(err instanceof Error ? err.message : "Ban failed");
    }
  }

  return (
    <div>
      <h2 className="font-mono font-bold text-sm uppercase mb-4">
        FLAGGED JUNK QUEUE
      </h2>

      {banErr && (
        <div className="brute-card p-3 mb-4 border-danger">
          <p className="font-mono text-xs text-danger uppercase">{banErr}</p>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="brute-card h-16 animate-pulse" />
          ))}
        </div>
      ) : posts.length === 0 ? (
        <BruteCard className="p-8 text-center" accent="none">
          <p className="font-mono text-sm text-emerald uppercase tracking-widest">
            ✓ JUNK QUEUE CLEAR — NO AUTO-HIDDEN POSTS
          </p>
        </BruteCard>
      ) : (
        <div className="flex flex-col gap-3 mb-6">
          {posts.map((p) => (
            <BruteCard
              key={p.post_id}
              className="p-4 flex items-center gap-4"
              accent="danger"
            >
              <AlertTriangle size={18} className="text-danger shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-mono text-sm font-bold truncate uppercase">
                  {p.title}
                </p>
                <p className="font-mono text-xs text-ink/50 uppercase">
                  @{p.ghost_handle} • {p.college} • {p.junk_flag_count} flags •{" "}
                  {p.aye_count} ayes
                </p>
              </div>
              <button
                onClick={() => quickBan(p)}
                disabled={banningId === p.post_id}
                className="btn-danger text-xs py-1.5 px-3 shrink-0"
              >
                <Ban size={12} />
                {banningId === p.post_id ? "BANNING..." : "HW BAN"}
              </button>
            </BruteCard>
          ))}
        </div>
      )}

      {/* Manual ban form */}
      <BruteCard className="p-5" accent="danger">
        <h3 className="font-mono font-bold text-sm uppercase mb-4 flex items-center gap-2">
          <Ban size={14} /> MANUAL HARDWARE BAN (BY USER ID)
        </h3>
        <form onSubmit={manualBan} className="flex flex-col gap-3 max-w-md">
          <div>
            <label className="font-mono text-[10px] uppercase tracking-widest text-ink/50 block mb-1">
              USER ID (UUID) *
            </label>
            <input
              className="brute-input font-mono text-xs"
              placeholder="00000000-0000-0000-0000-000000000000"
              value={manualId}
              onChange={(e) => setManualId(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="font-mono text-[10px] uppercase tracking-widest text-ink/50 block mb-1">
              REASON *
            </label>
            <input
              className="brute-input"
              placeholder="Serial troll / harassment"
              value={manualReason}
              onChange={(e) => setReason(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="btn-danger justify-center">
            <Ban size={14} />
            EXECUTE HARDWARE BAN
          </button>
        </form>
      </BruteCard>
    </div>
  );
}

// ── Main console ─────────────────────────────────────────────

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
    name: "", slug: "", city: "",
    gps_lat: "", gps_lng: "",
    geofence_radius_meters: "500",
  });

  const [seedCollegeId, setSeedCol]    = useState("");
  const [seedCount,     setSeedCount]  = useState("10");
  const [seedResult,    setSeedResult] = useState<string[] | null>(null);

  // Redirect non-admins
  useEffect(() => {
    if (!user)                          { router.push("/auth"); return; }
    if (user.role !== "DEV_SUPER_ADMIN") { router.push("/");    return; }
  }, [user, router]);

  // Helper: load all colleges from the admin endpoint (includes GPS)
  const loadColleges = (token: string) =>
    apiCall("/dev-admin/colleges", "GET", undefined, token).then((r) =>
      setCols((r as { colleges: College[] }).colleges)
    );

  // Initial data load
  useEffect(() => {
    if (!user?.token) return;
    setLoading(true);
    setError(null);
    Promise.all([
      apiCall("/dev-admin/stats", "GET", undefined, user.token),
      apiCall("/dev-admin/colleges", "GET", undefined, user.token),
    ])
      .then(([s, c]) => {
        setStats(s as Stats);
        setCols((c as { colleges: College[] }).colleges);
      })
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : "Load failed")
      )
      .finally(() => setLoading(false));
  }, [user?.token]);

  if (!user || user.role !== "DEV_SUPER_ADMIN") return null;

  async function addCollege(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!user) return;
    try {
      await apiCall(
        "/dev-admin/colleges",
        "POST",
        {
          name:                   newCollege.name,
          slug:                   newCollege.slug,
          city:                   newCollege.city,
          gps_lat:                parseFloat(newCollege.gps_lat),
          gps_lng:                parseFloat(newCollege.gps_lng),
          geofence_radius_meters: parseInt(newCollege.geofence_radius_meters),
        },
        user.token
      );
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
      const res = await apiCall(
        "/dev-admin/seed-otp",
        "POST",
        { college_id: seedCollegeId, count: parseInt(seedCount) },
        user.token
      );
      setSeedResult(
        (res as { codes: { otp_code: string }[] }).codes.map((c) => c.otp_code)
      );
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Failed to generate seed OTPs"
      );
    }
  }

  // Safe GPS formatter
  const fmtGps = (v: number | null | undefined) =>
    v != null ? Number(v).toFixed(4) : "—";

  // Safe rate formatter
  const fmtRate = (v: number | null | undefined) =>
    (v ?? 0).toFixed(0);

  return (
    <div>
      {/* HEADER */}
      <div className="flex items-center gap-4 mb-6">
        <div className="bg-danger text-white font-mono font-bold text-sm px-3 py-1.5 border-3 border-ink shadow-brutal">
          ⚡ DEV SUPER-ADMIN
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
      <div className="flex border-3 border-ink mb-6 shadow-brutal overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "flex-1 py-3 font-mono font-bold text-xs uppercase tracking-widest",
              "border-r-2 border-ink last:border-r-0 transition-colors whitespace-nowrap px-2",
              tab === t.id
                ? "bg-ink text-acid"
                : "bg-paper text-ink hover:bg-acid/20"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── STATS ─────────────────────────────────────────── */}
      {tab === "stats" && (
        <div>
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="brute-card p-6 h-24 animate-pulse" />
              ))}
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
                  <div className={`font-mono font-bold text-4xl ${s.color} mb-2`}>
                    {s.value}
                  </div>
                  <div className="font-mono text-[10px] text-ink/40 uppercase tracking-widest">
                    {s.label}
                  </div>
                </BruteCard>
              ))}
            </div>
          ) : (
            <p className="font-mono text-xs text-ink/40 uppercase">No data</p>
          )}
        </div>
      )}

      {/* ── COLLEGES ──────────────────────────────────────── */}
      {tab === "colleges" && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-mono font-bold text-sm uppercase">
              REGISTERED COLLEGES
            </h2>
            <button
              className="btn-primary"
              onClick={() => setAdding((v) => !v)}
            >
              <Plus size={14} />
              ADD COLLEGE
            </button>
          </div>

          {adding && (
            <BruteCard className="p-5 mb-5" accent="acid">
              <h3 className="font-mono font-bold text-sm uppercase mb-4">
                NEW COLLEGE
              </h3>
              <form onSubmit={addCollege}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                  {[
                    { key: "name",                   label: "COLLEGE NAME", ph: "Yenepoya University (Bengaluru Campus)", req: true },
                    { key: "slug",                   label: "SLUG",         ph: "yenepoya-blr",                            req: true },
                    { key: "city",                   label: "CITY",         ph: "Bengaluru",                               req: true },
                    { key: "gps_lat",                label: "GPS LAT",      ph: "12.9716",                                 req: true },
                    { key: "gps_lng",                label: "GPS LNG",      ph: "77.5946",                                 req: true },
                    { key: "geofence_radius_meters", label: "GEOFENCE (m)", ph: "500",                                     req: false },
                  ].map((f) => (
                    <div key={f.key}>
                      <label className="font-mono text-[10px] uppercase tracking-widest text-ink/50 block mb-1">
                        {f.label}{f.req && " *"}
                      </label>
                      <input
                        className="brute-input"
                        placeholder={f.ph}
                        value={newCollege[f.key as keyof typeof newCollege]}
                        onChange={(e) =>
                          setNew((n) => ({ ...n, [f.key]: e.target.value }))
                        }
                        required={f.req}
                      />
                    </div>
                  ))}
                </div>
                <div className="flex gap-3">
                  <button type="submit" className="btn-primary">
                    SAVE COLLEGE
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setAdding(false)}
                  >
                    CANCEL
                  </button>
                </div>
              </form>
            </BruteCard>
          )}

          <div className="border-3 border-ink shadow-brutal overflow-x-auto">
            <table className="w-full min-w-[560px]">
              <thead className="bg-ink text-acid">
                <tr>
                  {["NAME", "CITY", "GRADE", "RATE", "ISSUES", "GPS"].map(
                    (h) => (
                      <th
                        key={h}
                        className="px-4 py-3 text-left font-mono text-xs uppercase tracking-widest border-r-2 border-acid/20 last:border-r-0"
                        scope="col"
                      >
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  [1, 2].map((i) => (
                    <tr key={i} className="border-t-2 border-ink">
                      {[1, 2, 3, 4, 5, 6].map((j) => (
                        <td key={j} className="px-4 py-3">
                          <div className="h-4 bg-ink/10 animate-pulse rounded" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : (
                  colleges.map((c) => (
                    <tr
                      key={c.college_id}
                      className="border-t-2 border-ink hover:bg-acid/5"
                    >
                      <td className="px-4 py-3 font-mono text-xs font-bold">
                        {c.name}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-ink/60 uppercase">
                        {c.city}
                      </td>
                      <td className="px-4 py-3">
                        <GradeDisplay
                          grade={c.reality_grade ?? "N/A"}
                          size="sm"
                        />
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">
                        {fmtRate(c.resolution_rate)}%
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">
                        {c.total_experiences ?? 0}
                      </td>
                      <td className="px-4 py-3 font-mono text-[10px] text-ink/40">
                        {fmtGps(c.gps_lat)}, {fmtGps(c.gps_lng)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            {!loading && colleges.length === 0 && (
              <div className="py-10 text-center font-mono text-xs text-ink/30 uppercase">
                NO COLLEGES YET
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── SEED OTP ──────────────────────────────────────── */}
      {tab === "seed-otp" && (
        <BruteCard className="p-6">
          <h2 className="font-mono font-bold text-sm uppercase mb-4">
            GENERATE SEED OTP
          </h2>
          <p className="font-mono text-xs text-ink/60 mb-5">
            Generate master invite codes for bootstrapping a new college.
          </p>
          <form onSubmit={generateSeedOtps} className="flex flex-col gap-4 max-w-md">
            <div>
              <label className="font-mono text-[10px] uppercase tracking-widest text-ink/50 block mb-1">
                SELECT COLLEGE *
              </label>
              <select
                className="brute-input"
                value={seedCollegeId}
                onChange={(e) => setSeedCol(e.target.value)}
                required
              >
                <option value="">Select college...</option>
                {colleges.map((c) => (
                  <option key={c.college_id} value={c.college_id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="font-mono text-[10px] uppercase tracking-widest text-ink/50 block mb-1">
                NUMBER OF CODES
              </label>
              <input
                className="brute-input"
                type="number"
                value={seedCount}
                onChange={(e) => setSeedCount(e.target.value)}
                min={1}
                max={50}
              />
            </div>
            <button type="submit" className="btn-inverse w-full justify-center">
              <Zap size={16} />
              GENERATE SEED CODES
            </button>
          </form>

          {seedResult && (
            <div className="mt-6">
              <div className="section-label mb-3 inline-block">
                GENERATED CODES
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {seedResult.map((code) => (
                  <div
                    key={code}
                    className="border-2 border-ink bg-acid font-mono font-bold text-center py-2 text-sm tracking-widest"
                  >
                    {code}
                  </div>
                ))}
              </div>
              <p className="font-mono text-xs text-ink/50 mt-3 uppercase">
                Valid 7 days. Single-use only.
              </p>
            </div>
          )}
        </BruteCard>
      )}

      {/* ── ROOMS ─────────────────────────────────────── */}
      {tab === "rooms" && (
        <RoomsPanel token={user.token} colleges={colleges} />
      )}

      {/* ── JUNK QUEUE ────────────────────────────────────── */}
      {tab === "junk" && (
        <JunkQueuePanel token={user.token} onBanSuccess={() => {}} />
      )}

      {/* ── HW BANS ───────────────────────────────────────── */}
      {tab === "bans" && (
        <div>
          <h2 className="font-mono font-bold text-sm uppercase mb-4">
            HARDWARE BAN REGISTRY
          </h2>
          <BruteCard className="p-4" accent="none">
            <p className="font-mono text-xs text-ink/60 uppercase">
              Hardware bans live in the{" "}
              <code className="bg-ink/10 px-1">banned_fingerprints</code> table.
              Auto-bans trigger after 2 strikes. Use the JUNK QUEUE tab for
              manual bans.
            </p>
          </BruteCard>
        </div>
      )}
    </div>
  );
}
