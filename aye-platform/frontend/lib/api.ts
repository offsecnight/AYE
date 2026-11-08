// All API calls go directly to the backend from the browser.
// For production on Slate, we need direct calls since there's no Next.js server for proxy.
// CORS is configured on the backend to allow the Slate domain.
//
// Set BACKEND_URL in .env.local (server-side) or NEXT_PUBLIC_API_URL for browser direct calls.
function getApiBase(): string {
  // In the browser: use NEXT_PUBLIC_API_URL if set, otherwise fallback to same-origin proxy (for local dev)
  if (typeof window !== "undefined") {
    return process.env.NEXT_PUBLIC_API_URL ?? "/api/proxy";
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
  // Direct multipart upload for crowd proof (files + comment in one request)
  crowdProofUpload: (id: string, files: File[], commentText: string | undefined, token: string) => {
    const formData = new FormData();
    files.forEach((f) => formData.append("files", f));
    if (commentText) formData.append("comment_text", commentText);
    return requestMultipart(`/experiences/${id}/crowd-proof`, formData, token);
  },
  proposeFix: (id: string, body: object, token: string) =>
    request(`/experiences/${id}/propose-fix`, { method: "POST", body: JSON.stringify(body), token }),
  voteFix: (id: string, vote: "YES" | "NO", token: string) =>
    request(`/experiences/${id}/vote-fix`, { method: "POST", body: JSON.stringify({ vote }), token }),
};

// Multipart request helper (no JSON Content-Type header)
async function requestMultipart<T>(
  path: string,
  formData: FormData,
  token?: string
): Promise<T> {
  const base = getApiBase();
  const res = await fetch(`${base}${path}`, {
    method: "POST",
    credentials: "include",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message ?? "API error");
  }
  return res.json() as T;
}

// ── Chat ─────────────────────────────────────────────────────
export const chatApi = {
  rooms: (token: string) => request("/chat/rooms", { token }),
  messages: (roomId: string, token: string) =>
    request(`/chat/rooms/${roomId}/messages`, { token }),
  sendMessage: (
    roomId: string,
    body: { content: string; send_as_ghost: boolean; media_url?: string | null },
    token: string
  ) =>
    request(`/chat/rooms/${roomId}/messages`, {
      method: "POST",
      body: JSON.stringify(body),
      token,
    }),
  // Returns { url, key, token } for Supabase Realtime subscriptions.
  realtimeToken: (token: string) =>
    request("/chat/realtime-token", { token }),
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
  viewer_has_ayed?: boolean;
}
