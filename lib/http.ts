import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getRequestSession } from "@/lib/session";

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function requireAdminRequest(request: NextRequest) {
  const session = await getRequestSession(request);
  if (!session) {
    return { session: null, response: jsonError("Brak autoryzacji.", 401) };
  }

  return { session, response: null };
}

export function getClientIp(request: NextRequest) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}
