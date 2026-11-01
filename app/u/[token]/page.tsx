import { notFound } from "next/navigation";
import GuestExperience from "@/components/GuestExperience";
import { toEventDto } from "@/lib/photo-dto";
import { findGuestEvent, getGalleryPage } from "@/lib/gallery";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ token: string }>;
};

export default async function GuestPage({ params }: Props) {
  const { token } = await params;
  const event = await findGuestEvent(token);

  if (!event) notFound();

  const gallery = event.galleryEnabled
    ? await getGalleryPage(event.id)
    : { photos: [], nextCursor: null, total: 0 };

  return (
    <GuestExperience
      event={toEventDto(event)}
      gallery={gallery}
      token={token}
    />
  );
}
