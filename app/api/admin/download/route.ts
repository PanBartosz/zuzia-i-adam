import { type NextRequest, NextResponse } from "next/server";
import { jsonError, requireAdminRequest } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { displayDownloadName } from "@/lib/storage";
import {
  archiveFilesExist,
  photoArchiveResponse,
  readDownloadOptions,
} from "@/lib/photo-download";
import type { PhotoStatus } from "@/generated/prisma/enums";

export const runtime = "nodejs";

async function download(request: NextRequest) {
  const auth = await requireAdminRequest(request);
  if (auth.response) return auth.response;
  const options = await readDownloadOptions(request);
  if (!options) return jsonError("Nieprawidłowy wybór zdjęć.", 400);
  const photos = await prisma.photo.findMany({
    where: {
      ...(options.status && options.status !== "ALL"
        ? { status: options.status as PhotoStatus }
        : {}),
      ...(options.ids ? { id: { in: options.ids } } : {}),
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
  if (!photos.length || (options.ids && photos.length !== options.ids.length))
    return jsonError("Nie znaleziono wybranych zdjęć. Odśwież listę.", 404);
  const files = photos.map((photo, index) => ({
    path: photo.originalPath,
    name: `${String(index + 1).padStart(4, "0")}-${photo.id.slice(0, 8)}-${displayDownloadName(photo.id, photo.originalName)}`,
  }));
  if (!(await archiveFilesExist(files)))
    return jsonError("Nie znaleziono wszystkich plików na dysku.", 404);
  if (options.check)
    return NextResponse.json(
      { count: photos.length },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  return photoArchiveResponse(
    files,
    "zuzanna-adam-oryginaly.zip",
    request.signal,
  );
}

export { download as GET, download as POST };
