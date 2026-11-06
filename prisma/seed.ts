import "dotenv/config";
import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { seedEvent } from "./seed-event";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({ adapter });

async function main() {
  const email = process.env.ADMIN_EMAIL ?? "admin@zuziaiadam.pl";
  const password = process.env.ADMIN_PASSWORD ?? "zmien-to-przed-weselem";

  const event = await seedEvent(prisma);

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
  console.log("Guest access codes are available in the admin panel.");
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
