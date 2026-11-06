import { prisma } from "@/lib/prisma";

export type GalleryPhoto = { id: string; updatedAt: string };
export type GalleryPage = {
  photos: GalleryPhoto[];
  nextCursor: string | null;
  total: number;
};

export { findGuestEvent } from "@/lib/guest-access";

export async function getGalleryPage(
  eventId: string,
  cursor?: string | null,
): Promise<GalleryPage> {
  const where = {
    eventId,
    status: "PUBLISHED" as const,
    publishedPath: { not: null },
  };
  const [photos, total] = await Promise.all([
    prisma.photo.findMany({
      where,
      select: { id: true, updatedAt: true },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 49,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    }),
    prisma.photo.count({ where }),
  ]);
  return {
    photos: photos
      .slice(0, 48)
      .map((photo) => ({
        id: photo.id,
        updatedAt: photo.updatedAt.toISOString(),
      })),
    nextCursor: photos.length > 48 ? photos[47].id : null,
    total,
  };
}
