import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function Home() {
  const event = await prisma.event.findFirst({ orderBy: { createdAt: "asc" } });
  if (event) redirect(`/u/${event.uploadToken}`);

  return (
    <main className="grid min-h-screen place-items-center bg-[#f7f1e7] px-6 text-[#3c2c22]">
      <div className="max-w-md text-center">
        <p className="font-serif text-4xl">Zuzia & Adam</p>
        <p className="mt-4 text-sm text-[#6b4f3c]">
          Aplikacja czeka na konfigurację bazy danych.
        </p>
      </div>
    </main>
  );
}
