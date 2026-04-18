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

const crypto = require("node:crypto");

const { PrismaPg } = require("@prisma/adapter-pg");
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

/** Keep in sync with `src/lib/normalize-pg-connection-string.ts`. */
function normalizePgConnectionString(connectionString) {
  try {
    const url = new URL(connectionString);
    const sslmode = url.searchParams.get("sslmode");
    if (sslmode === "require" || sslmode === "prefer" || sslmode === "verify-ca") {
      url.searchParams.set("sslmode", "verify-full");
      return url.toString();
    }
    return connectionString;
  } catch {
    return connectionString;
  }
}

const rawUrl = process.env.DATABASE_URL?.trim();
if (!rawUrl) {
  throw new Error("DATABASE_URL is not set");
}
const connectionString = normalizePgConnectionString(rawUrl);
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

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

  const inviteEmail = "invited@example.com";
  await prisma.invitation.deleteMany({ where: { invitedEmail: inviteEmail } });

  const rawToken = crypto.randomBytes(32).toString("base64url");
  const tokenHash = crypto.createHash("sha256").update(rawToken, "utf8").digest("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await prisma.invitation.create({
    data: {
      tokenHash,
      invitedEmail: inviteEmail.trim().toLowerCase(),
      expiresAt,
    },
  });

  const base = (process.env.NEXTAUTH_URL || process.env.AUTH_URL || "http://localhost:3000").replace(
    /\/$/,
    "",
  );
  console.log(`Seeded invitation for ${inviteEmail} (expires ${expiresAt.toISOString()})`);
  console.log(`Invite signup URL: ${base}/signup/${rawToken}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
