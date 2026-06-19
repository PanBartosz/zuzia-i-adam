import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminRequest } from "@/lib/http";
import { toPhotoDto } from "@/lib/photo-dto";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const auth = await requireAdminRequest(request);
  if (auth.response) return auth.response;

  const status = request.nextUrl.searchParams.get("status");
  const where =
    status && status !== "ALL"
      ? { status: status as "NEW" | "SELECTED" | "PUBLISHED" | "HIDDEN" | "REJECTED" }
      : {};

  const photos = await prisma.photo.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  return NextResponse.json({ photos: photos.map(toPhotoDto) });
}
