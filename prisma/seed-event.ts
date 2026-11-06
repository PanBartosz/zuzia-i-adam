import { randomBytes } from "node:crypto";
import type { PrismaClient } from "../generated/prisma/client";

function optionalDate(value?: string) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function seedEvent(prisma: PrismaClient, env: Record<string, string | undefined> = process.env) {
  const existingEvent = await prisma.event.findFirst({ orderBy: { createdAt: "asc" } });
  return prisma.event.upsert({
    where: { id: existingEvent?.id ?? "initial-event" },
    create: {
      coupleName: env.COUPLE_NAME ?? "Zuzia & Adam",
      weddingDate: optionalDate(env.WEDDING_DATE),
      uploadToken: env.UPLOAD_TOKEN?.trim() || randomBytes(18).toString("base64url"),
      galleryToken: env.GALLERY_TOKEN?.trim() || randomBytes(18).toString("base64url"),
      theme: {
        palette: ["#f7f1e7", "#7b8b5f", "#b46f47", "#6b4f3c", "#d8bd85"],
      },
    },
    update: {
      coupleName: env.COUPLE_NAME ?? "Zuzia & Adam",
      weddingDate: optionalDate(env.WEDDING_DATE),
    },
  });
}
