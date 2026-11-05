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

  // Forward relevant headers but strip host
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const auth = req.headers.get("authorization");
  if (auth) headers["Authorization"] = auth;
  const cookie = req.headers.get("cookie");
  if (cookie) headers["Cookie"] = cookie;

  let body: BodyInit | undefined;
  if (method !== "GET" && method !== "DELETE") {
    try {
      const text = await req.text();
      if (text) body = text;
    } catch {
      // no body
    }
  }

  try {
    const res = await fetch(upstream, { method, headers, body });
    const data = await res.text();

    // Forward Set-Cookie from backend to browser
    const responseHeaders = new Headers({ "Content-Type": "application/json" });
    const setCookie = res.headers.get("set-cookie");
    if (setCookie) responseHeaders.set("set-cookie", setCookie);

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
