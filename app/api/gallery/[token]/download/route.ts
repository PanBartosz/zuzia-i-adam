import { type NextRequest, NextResponse } from "next/server";
import { findGuestEvent } from "@/lib/gallery";
import { jsonError } from "@/lib/http";
import {
  archiveFilesExist,
  photoArchiveResponse,
  readDownloadOptions,
} from "@/lib/photo-download";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

async function download(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const event = await findGuestEvent(token);
  if (!event?.galleryEnabled)
    return jsonError("Galeria nie jest teraz dostępna.", 403);
  const options = await readDownloadOptions(request);
  if (!options) return jsonError("Wybierz zdjęcia do pobrania.", 400);
  const photos = await prisma.photo.findMany({
    where: {
      eventId: event.id,
      status: "PUBLISHED",
      publishedPath: { not: null },
      ...(options.ids ? { id: { in: options.ids } } : {}),
    },
    select: { id: true, publishedPath: true },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
  if (!photos.length || (options.ids && photos.length !== options.ids.length))
    return jsonError(
      "Niektóre zdjęcia nie są już dostępne. Odśwież galerię i wybierz ponownie.",
      404,
    );
  const files = photos.map((photo) => ({
    path: photo.publishedPath!,
    name: `zuzanna-adam-${photo.id}.jpg`,
    jpeg: true,
  }));
  if (!(await archiveFilesExist(files)))
    return jsonError(
      "Nie udało się odnaleźć wszystkich zdjęć. Spróbuj później.",
      404,
    );
  if (options.check)
    return NextResponse.json(
      { count: photos.length },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  return photoArchiveResponse(
    files,
    "zuzanna-adam-wspomnienia.zip",
    request.signal,
  );
}

export { download as GET, download as POST };
