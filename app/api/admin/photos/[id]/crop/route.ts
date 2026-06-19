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
  const validCrop =
    crop &&
    ["x", "y", "width", "height"].every((key) => Number.isFinite(crop[key])) &&
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

  const publishedPath = await cropPublishedImage(source, id, crop);
  const updated = await prisma.photo.update({
    where: { id },
    data: {
      status: "PUBLISHED",
      publishedPath,
      crop,
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: auth.session?.id,
      action: "PHOTO_CROP_PUBLISH",
      entity: "Photo",
      entityId: id,
      metadata: { crop },
    },
  });

  return NextResponse.json({ photo: toPhotoDto(updated) });
}
