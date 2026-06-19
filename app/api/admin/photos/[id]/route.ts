import { NextResponse, type NextRequest } from "next/server";
import { PhotoStatus } from "@/generated/prisma/enums";
import { createPublishedImage } from "@/lib/image-processing";
import { jsonError, requireAdminRequest } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { storageFileExists } from "@/lib/storage";
import { toPhotoDto } from "@/lib/photo-dto";

export const runtime = "nodejs";

type Params = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: NextRequest, { params }: Params) {
  const auth = await requireAdminRequest(request);
  if (auth.response) return auth.response;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const action = typeof body?.action === "string" ? body.action : "";

  const photo = await prisma.photo.findUnique({ where: { id } });
  if (!photo) return jsonError("Nie znaleziono zdjęcia.", 404);

  let data: {
    status?: keyof typeof PhotoStatus;
    publishedPath?: string | null;
  } = {};

  if (action === "publish") {
    const source = photo.webPath ?? photo.originalPath;
    if (!(await storageFileExists(source))) {
      return jsonError("Nie znaleziono pliku źródłowego.", 404);
    }

    const publishedPath = await createPublishedImage(source, photo.id);
    data = { status: "PUBLISHED", publishedPath };
  } else if (action === "select") {
    data = { status: "SELECTED" };
  } else if (action === "hide") {
    data = { status: "HIDDEN" };
  } else if (action === "reject") {
    data = { status: "REJECTED" };
  } else if (action === "new") {
    data = { status: "NEW" };
  } else if (action === "unpublish") {
    data = { status: "SELECTED" };
  } else {
    return jsonError("Nieznana akcja.", 400);
  }

  const updated = await prisma.photo.update({
    where: { id },
    data,
  });

  await prisma.auditLog.create({
    data: {
      userId: auth.session?.id,
      action: `PHOTO_${action.toUpperCase()}`,
      entity: "Photo",
      entityId: id,
    },
  });

  return NextResponse.json({ photo: toPhotoDto(updated) });
}
