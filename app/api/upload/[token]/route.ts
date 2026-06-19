import { NextResponse, type NextRequest } from "next/server";
import { fileTypeFromBuffer } from "file-type";
import { allowedImageMimeTypes, appConfig } from "@/lib/config";
import { getClientIp, jsonError } from "@/lib/http";
import { processUploadedImage, placeholderThumb } from "@/lib/image-processing";
import { prisma } from "@/lib/prisma";
import {
  createPhotoId,
  ensureStorageDirs,
  getRelativePhotoPath,
  safeFileName,
  writeStorageFile,
} from "@/lib/storage";
import { toPhotoDto } from "@/lib/photo-dto";

export const runtime = "nodejs";

type Params = {
  params: Promise<{ token: string }>;
};

export async function POST(request: NextRequest, { params }: Params) {
  const { token } = await params;
  const event = await prisma.event.findUnique({
    where: { uploadToken: token },
  });

  if (!event || !event.uploadEnabled) {
    return jsonError("Wrzucanie zdjęć jest teraz zamknięte.", 403);
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const guestNameRaw = formData.get("guestName");
  const guestName =
    typeof guestNameRaw === "string" && guestNameRaw.trim()
      ? guestNameRaw.trim().slice(0, 80)
      : null;

  if (!(file instanceof File)) {
    return jsonError("Nie znaleziono pliku zdjęcia.", 400);
  }

  if (file.size <= 0) {
    return jsonError("Plik jest pusty.", 400);
  }

  if (file.size > appConfig.maxUploadBytes) {
    return jsonError("Zdjęcie jest za duże. Limit to 40 MB.", 413);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const detected = await fileTypeFromBuffer(buffer);
  const mimeType = detected?.mime ?? file.type;

  if (!mimeType || !allowedImageMimeTypes.has(mimeType)) {
    return jsonError("Ten format pliku nie wygląda jak obsługiwane zdjęcie.", 415);
  }

  await ensureStorageDirs();

  const photoId = createPhotoId();
  const extension =
    detected?.ext ??
    safeFileName(file.name).split(".").pop()?.toLowerCase() ??
    "jpg";
  const originalPath = getRelativePhotoPath("originals", photoId, extension);
  await writeStorageFile(originalPath, buffer);

  const processed = await processUploadedImage(photoId, buffer);
  const thumbPath = processed.thumbPath ?? (await placeholderThumb(photoId));

  const photo = await prisma.photo.create({
    data: {
      id: photoId,
      eventId: event.id,
      originalPath,
      thumbPath,
      webPath: processed.webPath,
      originalName: file.name ? safeFileName(file.name) : null,
      mimeType,
      size: file.size,
      width: processed.width,
      height: processed.height,
      guestName,
      uploadedIp: getClientIp(request),
      error: processed.error,
    },
  });

  return NextResponse.json({
    ok: true,
    photo: toPhotoDto(photo),
  });
}
