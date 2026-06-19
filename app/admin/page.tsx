import { redirect } from "next/navigation";
import AdminDashboard from "@/components/AdminDashboard";
import { appConfig } from "@/lib/config";
import { prisma } from "@/lib/prisma";
import { toEventDto, toPhotoDto } from "@/lib/photo-dto";
import { getPageSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await getPageSession();
  if (!session) redirect("/admin/login");

  const event = await prisma.event.findFirst({
    orderBy: { createdAt: "asc" },
  });
  if (!event) redirect("/");

  const photos = await prisma.photo.findMany({
    where: { eventId: event.id },
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  return (
    <AdminDashboard
      appBaseUrl={appConfig.baseUrl}
      event={toEventDto(event)}
      initialPhotos={photos.map(toPhotoDto)}
      sessionEmail={session.email}
    />
  );
}
