import { type NextRequest, NextResponse } from "next/server";
import { findGuestEvent, getGalleryPage } from "@/lib/gallery";
import { jsonError } from "@/lib/http";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const event = await findGuestEvent(token);
  if (!event?.galleryEnabled)
    return jsonError("Galeria nie jest teraz dostępna.", 403);
  return NextResponse.json(
    await getGalleryPage(event.id, request.nextUrl.searchParams.get("cursor")),
    {
      headers: { "Cache-Control": "private, no-store" },
    },
  );
}
