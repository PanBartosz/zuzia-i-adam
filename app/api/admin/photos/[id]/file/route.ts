import { NextResponse, type NextRequest } from "next/server";
import { jsonError, requireAdminRequest } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { displayDownloadName, readStorageFile } from "@/lib/storage";

export const runtime = "nodejs";

type Params = {
  params: Promise<{ id: string }>;
};

export async function GET(request: NextRequest, { params }: Params) {
  const auth = await requireAdminRequest(request);
  if (auth.response) return auth.response;

  const { id } = await params;
  const photo = await prisma.photo.findUnique({ where: { id } });
  if (!photo) return jsonError("Nie znaleziono zdjęcia.", 404);

  const variant = request.nextUrl.searchParams.get("variant") ?? "thumb";
  const path =
    variant === "original"
      ? photo.originalPath
      : variant === "web"
        ? photo.webPath ?? photo.thumbPath ?? photo.originalPath
        : variant === "published"
          ? photo.publishedPath ?? photo.webPath ?? photo.thumbPath ?? photo.originalPath
          : photo.thumbPath ?? photo.webPath ?? photo.originalPath;

  if (!path) return jsonError("Zdjęcie nie ma pliku dla tego wariantu.", 404);

  const file = await readStorageFile(path).catch(() => null);
  if (!file) return jsonError("Nie znaleziono pliku na dysku.", 404);

  const download = request.nextUrl.searchParams.get("download") === "1";
  const contentType = variant === "original" ? photo.mimeType : "image/webp";
  const response = new NextResponse(file, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "private, max-age=120",
    },
  });

  if (download) {
    response.headers.set(
      "Content-Disposition",
      `attachment; filename="${displayDownloadName(photo.id, photo.originalName)}"`,
    );
  }

  return response;
}
