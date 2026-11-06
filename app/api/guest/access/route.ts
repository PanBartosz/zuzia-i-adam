import { NextResponse, type NextRequest } from "next/server";
import { findGuestEvent } from "@/lib/guest-access";
import { jsonError } from "@/lib/http";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const code = typeof body?.code === "string" ? body.code.trim() : "";
  const event = await findGuestEvent(code);

  if (!event) return jsonError("Nieprawidłowy kod dostępu.", 403);

  // Return only the credential the guest already supplied, never the other key.
  return NextResponse.json(
    { url: `/u/${encodeURIComponent(code)}` },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
