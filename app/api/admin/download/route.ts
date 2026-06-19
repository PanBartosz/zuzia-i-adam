import { ZipArchive } from "archiver";
import { PassThrough, Readable } from "node:stream";
import { type NextRequest } from "next/server";
import { jsonError, requireAdminRequest } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { displayDownloadName, resolveStoragePath } from "@/lib/storage";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const auth = await requireAdminRequest(request);
  if (auth.response) return auth.response;

  const status = request.nextUrl.searchParams.get("status");
  const ids = request.nextUrl.searchParams.get("ids")?.split(",").filter(Boolean) ?? [];

  const photos = await prisma.photo.findMany({
    where: {
      ...(status && status !== "ALL" ? { status: status as never } : {}),
      ...(ids.length ? { id: { in: ids } } : {}),
    },
    orderBy: { createdAt: "asc" },
  });

  if (!photos.length) {
    return jsonError("Nie ma zdjęć do pobrania.", 404);
  }

  const archive = new ZipArchive({ zlib: { level: 5 } });
  const stream = new PassThrough();
  archive.pipe(stream);

  photos.forEach((photo, index) => {
    archive.file(resolveStoragePath(photo.originalPath), {
      name: `${String(index + 1).padStart(4, "0")}-${photo.id.slice(0, 8)}-${displayDownloadName(
        photo.id,
        photo.originalName,
      )}`,
    });
  });

  void archive.finalize();

  return new Response(Readable.toWeb(stream) as BodyInit, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": 'attachment; filename="zuzia-adam-zdjecia.zip"',
    },
  });
}
