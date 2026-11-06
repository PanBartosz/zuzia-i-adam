import { prisma } from "@/lib/prisma";

// Both existing QR codes are equivalent guest credentials. Admin switches,
// checked separately on every request, decide which operations are available.
export async function findGuestEvent(token: string) {
  if (!token || token.length > 256) return null;

  return prisma.event.findFirst({
    where: { OR: [{ uploadToken: token }, { galleryToken: token }] },
  });
}
