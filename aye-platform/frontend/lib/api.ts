// All API calls go through Next.js's own /api/proxy route.
// This means the browser always calls the same origin (whatever IP/domain
// the frontend is served from — localhost, Tailscale IP, custom domain, etc.)
// and Next.js forwards the request to the backend server-side.
// No CORS issues. No hardcoded IPs in the browser.
//
// To point at a different backend, set BACKEND_URL in the server .env:
//   BACKEND_URL=http://100.103.77.64:4000   (Tailscale)
//   BACKEND_URL=https://api.yourdomain.com  (custom domain)
// The frontend .env only needs NEXT_PUBLIC_API_URL if you want to bypass
// the proxy entirely (e.g. same-machine dev without Tailscale).

function getApiBase(): string {
  // In the browser: always use the same-origin proxy
  if (typeof window !== "undefined") {
    return "/api/proxy";
  }
  // Server-side (SSR / RSC): call backend directly
  return (process.env.BACKEND_URL ?? "http://localhost:4000") + "/api/v1";
}

async function request<T>(
  path: string,
  options?: RequestInit & { token?: string }
): Promise<T> {
  const { token, ...rest } = options ?? {};
  const base = getApiBase();
  const res = await fetch(`${base}${path}`, {
    ...rest,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(rest.headers ?? {}),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message ?? "API error");
  }
  return res.json() as T;
}

// ── Auth ─────────────────────────────────────────────────────
export const authApi = {
  register: (body: object) =>
    request("/auth/register", { method: "POST", body: JSON.stringify(body) }),
  login: (body: object) =>
    request("/auth/login", { method: "POST", body: JSON.stringify(body) }),
  me: (token: string) =>
    request("/auth/me", { token }),
  generateOtp: (token: string) =>
    request("/auth/generate-otp", { method: "POST", token }),
  verifyGps: (body: { college_id: string; lat: number; lng: number }) =>
    request("/auth/verify-gps", { method: "POST", body: JSON.stringify(body) }),
  recover: (body: object) =>
    request("/auth/recover", { method: "POST", body: JSON.stringify(body) }),
};

// ── Colleges ─────────────────────────────────────────────────
export const collegesApi = {
  list: () => request<{ colleges: CollegePublic[] }>("/colleges"),
  scoreboard: (slug: string) =>
    request<CollegeScoreboard>(`/public/scoreboard/${slug}`),
};

// ── Experiences ──────────────────────────────────────────────
export const experiencesApi = {
  list: (params: Record<string, string>, token: string) =>
    request(`/experiences?${new URLSearchParams(params)}`, { token }),
  get: (id: string, token: string) =>
    request(`/experiences/${id}`, { token }),
  create: (body: object, token: string) =>
    request("/experiences", { method: "POST", body: JSON.stringify(body), token }),
  aye: (id: string, token: string) =>
    request(`/experiences/${id}/aye`, { method: "POST", token }),
  flagJunk: (id: string, token: string) =>
    request(`/experiences/${id}/flag-junk`, { method: "POST", token }),
  crowdProof: (id: string, body: object, token: string) =>
    request(`/experiences/${id}/crowd-proof`, { method: "POST", body: JSON.stringify(body), token }),
  proposeFix: (id: string, body: object, token: string) =>
    request(`/experiences/${id}/propose-fix`, { method: "POST", body: JSON.stringify(body), token }),
  voteFix: (id: string, vote: "YES" | "NO", token: string) =>
    request(`/experiences/${id}/vote-fix`, { method: "POST", body: JSON.stringify({ vote }), token }),
};

// ── Chat ─────────────────────────────────────────────────────
export const chatApi = {
  rooms: (token: string) => request("/chat/rooms", { token }),
  messages: (roomId: string, token: string) =>
    request(`/chat/rooms/${roomId}/messages`, { token }),
};

// ── Types ─────────────────────────────────────────────────────
export interface CollegePublic {
  college_id: string;
  name: string;
  slug: string;
  city: string;
  reality_grade: string;
  resolution_rate: number;
  total_experiences: number;
  total_resolved: number;
}

export interface CollegeScoreboard extends CollegePublic {
  longest_ignored: ExperiencePublic[];
  trending: ExperiencePublic[];
}

export interface ExperiencePublic {
  post_id: string;
  college_id: string;
  ghost_handle: string;
  hide_handle: boolean;
  title: string;
  what_is_wrong: string;
  exact_location: string;
  impact_scope: string;
  category: string;
  severity: string;
  media_urls: string[];
  aye_count: number;
  junk_flag_count: number;
  status: string;
  created_at: string;
  resolved_at?: string;
}
