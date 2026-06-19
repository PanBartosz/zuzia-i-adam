import { NextResponse, type NextRequest } from "next/server";
import { jsonError } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { readStorageFile } from "@/lib/storage";

export const runtime = "nodejs";

type Params = {
  params: Promise<{ token: string; id: string }>;
};

export async function GET(_request: NextRequest, { params }: Params) {
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

  return new NextResponse(file, {
    headers: {
      "Content-Type": "image/webp",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
