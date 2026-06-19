import { notFound } from "next/navigation";
import GuestExperience from "@/components/GuestExperience";
import { prisma } from "@/lib/prisma";
import { toEventDto, toPhotoDto } from "@/lib/photo-dto";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ token: string }>;
};

export default async function GuestPage({ params }: Props) {
  const { token } = await params;
  const event = await prisma.event.findFirst({
    where: {
      OR: [{ uploadToken: token }, { galleryToken: token }],
    },
  });

  if (!event) notFound();

  const photos = event.galleryEnabled
    ? await prisma.photo.findMany({
        where: {
          eventId: event.id,
          status: "PUBLISHED",
        },
        orderBy: { updatedAt: "desc" },
        take: 300,
      })
    : [];

  return (
    <GuestExperience
      event={toEventDto(event)}
      photos={photos.map(toPhotoDto)}
      token={token}
    />
  );
}
