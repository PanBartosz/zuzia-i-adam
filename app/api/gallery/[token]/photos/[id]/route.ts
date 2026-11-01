import { NextResponse, type NextRequest } from "next/server";
import { jsonError } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { readStorageFile } from "@/lib/storage";
import sharp from "sharp";

export const runtime = "nodejs";

type Params = {
  params: Promise<{ token: string; id: string }>;
};

export async function GET(request: NextRequest, { params }: Params) {
  const { token, id } = await params;
  const event = await prisma.event.findFirst({
    where: {
      OR: [{ uploadToken: token }, { galleryToken: token }],
    },
  });

  if (!event || !event.galleryEnabled) {
    return jsonError("Galeria nie jest jeszcze dostępna.", 403);
  }

  const photo = await prisma.photo.findFirst({
    where: {
      id,
      eventId: event.id,
      status: "PUBLISHED",
    },
  });

  if (!photo?.publishedPath) {
    return jsonError("Nie znaleziono zdjęcia.", 404);
  }

  const file = await readStorageFile(photo.publishedPath).catch(() => null);
  if (!file) return jsonError("Nie znaleziono pliku na dysku.", 404);

  const download = request.nextUrl.searchParams.get("download") === "1";
  const thumb = request.nextUrl.searchParams.get("variant") === "thumb";
  const output = download
    ? await sharp(file).jpeg({ quality: 94 }).toBuffer()
    : thumb
      ? await sharp(file)
          .resize({
            width: 640,
            height: 640,
            fit: "inside",
            withoutEnlargement: true,
          })
          .webp({ quality: 78 })
          .toBuffer()
      : file;

  return new NextResponse(new Uint8Array(output), {
    headers: {
      "Content-Type": download ? "image/jpeg" : "image/webp",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      ...(download
        ? {
            "Content-Disposition": `attachment; filename="zuzanna-adam-${photo.id}.jpg"`,
          }
        : {}),
    },
  });
}
