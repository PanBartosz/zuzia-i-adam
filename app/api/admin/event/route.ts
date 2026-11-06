import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError, requireAdminRequest } from "@/lib/http";
import { toEventDto } from "@/lib/photo-dto";
import { randomBytes } from "node:crypto";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const auth = await requireAdminRequest(request);
  if (auth.response) return auth.response;

  const event = await prisma.event.findFirst({
    orderBy: { createdAt: "asc" },
  });
  if (!event) return jsonError("Brak skonfigurowanego wydarzenia.", 404);

  const counts = await prisma.photo.groupBy({
    by: ["status"],
    where: { eventId: event.id },
    _count: { status: true },
  });

  return NextResponse.json({
    event: toEventDto(event),
    counts: Object.fromEntries(counts.map((row) => [row.status, row._count.status])),
  });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdminRequest(request);
  if (auth.response) return auth.response;

  const body = await request.json().catch(() => null);
  const event = await prisma.event.findFirst({
    orderBy: { createdAt: "asc" },
  });
  if (!event) return jsonError("Brak skonfigurowanego wydarzenia.", 404);

  const uploadEnabled =
    typeof body?.uploadEnabled === "boolean" ? body.uploadEnabled : event.uploadEnabled;
  const galleryEnabled =
    typeof body?.galleryEnabled === "boolean" ? body.galleryEnabled : event.galleryEnabled;
  const accessRotated = body?.rotateAccess === true;

  const updated = await prisma.event.update({
    where: { id: event.id },
    data: {
      uploadEnabled,
      galleryEnabled,
      ...(accessRotated
        ? {
            uploadToken: randomBytes(18).toString("base64url"),
            galleryToken: randomBytes(18).toString("base64url"),
          }
        : {}),
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: auth.session?.id,
      action: "UPDATE_EVENT_SETTINGS",
      entity: "Event",
      entityId: event.id,
      metadata: { uploadEnabled, galleryEnabled, accessRotated },
    },
  });

  return NextResponse.json({ event: toEventDto(updated) });
}
