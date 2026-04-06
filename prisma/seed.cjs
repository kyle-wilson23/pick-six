/**
 * Dev-only convenience: upsert a user with a bcrypt password hash.
 * Run after migrations: `npm run db:seed` (loads `.env` / `.env.local` like other db scripts).
 */
const { config } = require("dotenv");
const { existsSync } = require("node:fs");
const path = require("node:path");

for (const file of [".env", ".env.local"]) {
  const p = path.join(process.cwd(), file);
  if (existsSync(p)) {
    config({ path: p, override: true });
  }
}

const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  const email = "dev@example.com";
  const password = "devpassword123";
  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.user.upsert({
    where: { email },
    update: { passwordHash, name: "Dev User" },
    create: {
      email,
      name: "Dev User",
      passwordHash,
    },
  });

  console.log(`Seeded user: ${email} (password: ${password})`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
