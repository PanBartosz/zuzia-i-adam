import "dotenv/config";
import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({ adapter });

function optionalDate(value?: string) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

async function main() {
  const email = process.env.ADMIN_EMAIL ?? "admin@zuziaiadam.pl";
  const password = process.env.ADMIN_PASSWORD ?? "zmien-to-przed-weselem";

  const event = await prisma.event.upsert({
    where: { uploadToken: process.env.UPLOAD_TOKEN ?? "zuzia-adam-2026-wrzucamy" },
    create: {
      coupleName: process.env.COUPLE_NAME ?? "Zuzia & Adam",
      weddingDate: optionalDate(process.env.WEDDING_DATE),
      uploadToken: process.env.UPLOAD_TOKEN ?? "zuzia-adam-2026-wrzucamy",
      galleryToken: process.env.GALLERY_TOKEN ?? "zuzia-adam-2026-galeria",
      theme: {
        palette: ["#f7f1e7", "#7b8b5f", "#b46f47", "#6b4f3c", "#d8bd85"],
      },
    },
    update: {
      coupleName: process.env.COUPLE_NAME ?? "Zuzia & Adam",
      weddingDate: optionalDate(process.env.WEDDING_DATE),
      galleryToken: process.env.GALLERY_TOKEN ?? "zuzia-adam-2026-galeria",
    },
  });

  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.adminUser.upsert({
    where: { email },
    create: {
      email,
      name: "Zuzia i Adam",
      passwordHash,
    },
    update: {
      passwordHash,
    },
  });

  console.log(`Seeded event ${event.coupleName}`);
  console.log(`Guest upload: /u/${event.uploadToken}`);
  console.log(`Admin email: ${email}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
