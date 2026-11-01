import { NextResponse, type NextRequest } from "next/server";
import { cropPublishedImage } from "@/lib/image-processing";
import { jsonError, requireAdminRequest } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { storageFileExists } from "@/lib/storage";
import { toPhotoDto } from "@/lib/photo-dto";

export const runtime = "nodejs";

type Params = {
  params: Promise<{ id: string }>;
};

export async function POST(request: NextRequest, { params }: Params) {
  const auth = await requireAdminRequest(request);
  if (auth.response) return auth.response;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const crop = body?.crop;
  const zoom = Number(body?.zoom);
  const point = body?.point;
  const pointX = Number(point?.x);
  const pointY = Number(point?.y);
  const validCrop =
    crop &&
    ["x", "y", "width", "height"].every((key) => Number.isFinite(crop[key])) &&
    crop.x >= 0 &&
    crop.y >= 0 &&
    crop.width > 0 &&
    crop.height > 0;

  if (!validCrop) {
    return jsonError("Nieprawidłowe dane kadrowania.", 400);
  }

  const photo = await prisma.photo.findUnique({ where: { id } });
  if (!photo) return jsonError("Nie znaleziono zdjęcia.", 404);

  const source = photo.webPath ?? photo.originalPath;
  if (!(await storageFileExists(source))) {
    return jsonError("Nie znaleziono pliku źródłowego.", 404);
  }

  const publishedPath = await cropPublishedImage(source, id, crop).catch(
    () => null,
  );
  if (!publishedPath)
    return jsonError(
      "Kadr wykracza poza zdjęcie lub plik jest nieprawidłowy.",
      400,
    );
  const cropSettings = {
    area: crop,
    zoom: Number.isFinite(zoom) ? Math.min(3, Math.max(1, zoom)) : 1,
    point: {
      x: Number.isFinite(pointX) ? pointX : 0,
      y: Number.isFinite(pointY) ? pointY : 0,
    },
    aspect: 4 / 3,
  };
  const updated = await prisma.photo.update({
    where: { id },
    data: {
      publishedPath,
      crop: cropSettings,
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: auth.session?.id,
      action: "PHOTO_CROP_SAVE",
      entity: "Photo",
      entityId: id,
      metadata: cropSettings,
    },
  });

  return NextResponse.json({ photo: toPhotoDto(updated) });
}
