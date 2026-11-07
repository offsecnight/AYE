import { NextRequest, NextResponse } from "next/server";

// Backend URL is only ever read server-side — safe to use process.env here
const BACKEND = process.env.BACKEND_URL ?? "http://localhost:4000";

export async function GET(
  req: NextRequest,
  { params }: { params: { path: string[] } }
) {
  return proxy(req, params.path, "GET");
}

export async function POST(
  req: NextRequest,
  { params }: { params: { path: string[] } }
) {
  return proxy(req, params.path, "POST");
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { path: string[] } }
) {
  return proxy(req, params.path, "PUT");
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { path: string[] } }
) {
  return proxy(req, params.path, "PATCH");
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { path: string[] } }
) {
  return proxy(req, params.path, "DELETE");
}

async function proxy(
  req: NextRequest,
  pathSegments: string[],
  method: string
): Promise<NextResponse> {
  const upstream = `${BACKEND}/api/v1/${pathSegments.join("/")}${req.nextUrl.search}`;

  const contentType = req.headers.get("content-type") ?? "";
  const isMultipart = contentType.includes("multipart/form-data");

  // Build forwarded headers
  const headers: Record<string, string> = {};

  // For multipart: forward the original Content-Type (includes boundary).
  // For everything else: force application/json.
  if (isMultipart) {
    headers["Content-Type"] = contentType;
  } else {
    headers["Content-Type"] = "application/json";
  }

  const auth = req.headers.get("authorization");
  if (auth) headers["Authorization"] = auth;
  const cookie = req.headers.get("cookie");
  if (cookie) headers["Cookie"] = cookie;

  let body: BodyInit | undefined;
  if (method !== "GET" && method !== "DELETE") {
    if (isMultipart) {
      // Stream the raw bytes — do NOT read as text, that corrupts binary files
      body = await req.arrayBuffer();
    } else {
      try {
        const text = await req.text();
        if (text) body = text;
      } catch {
        // no body
      }
    }
  }

  try {
    const res = await fetch(upstream, { method, headers, body });
    const data = await res.arrayBuffer(); // read as binary to handle both JSON and file downloads

    // Forward Set-Cookie from backend to browser
    const responseHeaders = new Headers();
    const backendCT = res.headers.get("content-type");
    if (backendCT) responseHeaders.set("Content-Type", backendCT);
    const setCookie = res.headers.get("set-cookie");
    if (setCookie) responseHeaders.set("set-cookie", setCookie);
    // Forward Content-Disposition for file downloads
    const cd = res.headers.get("content-disposition");
    if (cd) responseHeaders.set("Content-Disposition", cd);

    return new NextResponse(data, {
      status: res.status,
      headers: responseHeaders,
    });
  } catch (err) {
    return NextResponse.json(
      { message: "Backend unreachable", detail: String(err) },
      { status: 503 }
    );
  }
}

// Disable Next.js body parsing — we forward the raw stream to the backend.
// Without this, Next.js consumes the multipart body before our handler sees it.
export const dynamic = "force-dynamic";
export const revalidate = 0;
