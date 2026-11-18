import { NextResponse, type NextRequest } from "next/server";

const HOP_BY_HOP_HEADERS = [
  "connection",
  "content-length",
  "content-encoding",
  "host",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "accept-encoding",
];

function getApiBaseUrl() {
  const configuredUrl = process.env.NEXT_PUBLIC_API_URL ??
    (process.env.NODE_ENV === "production" ? undefined : "http://localhost:4000");
  if (!configuredUrl) throw new Error("NEXT_PUBLIC_API_URL must be configured for the API proxy.");

  const url = new URL(configuredUrl);
  url.pathname = `${url.pathname.replace(/\/+$/, "")}/`;
  url.search = "";
  url.hash = "";
  return url;
}

function clearFrontendSessionCookie(response: Response, request: NextRequest) {
  const secure = request.nextUrl.protocol === "https:";
  response.headers.append(
    "set-cookie",
    `hms_session=; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=${secure ? "None" : "Lax"}${secure ? "; Secure" : ""}`,
  );
}

async function forward(request: NextRequest, context: RouteContext<"/api/[...path]">) {
  const { path } = await context.params;
  const isLogout = request.method === "POST" && path.join("/") === "v1/auth/logout";
  let upstreamUrl: URL;
  try {
    // This route catches /api/{...path}; restore the /api prefix because the
    // Nest controllers are mounted under /api/v1/... on the upstream service.
    upstreamUrl = new URL(`api/${path.map(encodeURIComponent).join("/")}${request.nextUrl.search}`, getApiBaseUrl());
  } catch {
    const response = NextResponse.json({ message: "API proxy is not configured." }, { status: 503 });
    if (isLogout) clearFrontendSessionCookie(response, request);
    return response;
  }

  const requestHeaders = new Headers(request.headers);
  for (const header of HOP_BY_HOP_HEADERS) requestHeaders.delete(header);

  let upstream: Response;
  try {
    upstream = await fetch(upstreamUrl, {
      method: request.method,
      headers: requestHeaders,
      body: request.body ? await request.arrayBuffer() : undefined,
      cache: "no-store",
      redirect: "manual",
      signal: request.signal,
    });
  } catch {
    const response = NextResponse.json({ message: "The API service is unavailable." }, { status: 502 });
    if (isLogout) clearFrontendSessionCookie(response, request);
    return response;
  }

  const responseHeaders = new Headers(upstream.headers);
  for (const header of HOP_BY_HOP_HEADERS) responseHeaders.delete(header);
  responseHeaders.delete("set-cookie");
  for (const cookie of isLogout ? [] : upstream.headers.getSetCookie()) {
    // A backend Domain attribute would scope the cookie to the unrelated API host.
    // Removing it makes this browser-facing response set a host-only frontend cookie.
    responseHeaders.append("set-cookie", cookie.replace(/;\s*domain=[^;]*/gi, ""));
  }

  const body = request.method === "HEAD" || upstream.status === 204 || upstream.status === 304
    ? null
    : await upstream.arrayBuffer();
  const response = new Response(body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });
  if (isLogout) clearFrontendSessionCookie(response, request);
  return response;
}

export const GET = forward;
export const HEAD = forward;
export const POST = forward;
export const PUT = forward;
export const PATCH = forward;
export const DELETE = forward;
export const OPTIONS = forward;
