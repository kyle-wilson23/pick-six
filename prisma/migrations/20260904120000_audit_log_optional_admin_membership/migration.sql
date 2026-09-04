-- AlterTable
ALTER TABLE "audit_log_entries" ALTER COLUMN "admin_membership_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "audit_log_entries" ADD COLUMN "admin_user_id" TEXT;

-- Backfill actor user from existing admin memberships
UPDATE "audit_log_entries" AS a
SET "admin_user_id" = m."user_id"
FROM "league_memberships" AS m
WHERE a."admin_membership_id" = m."id"
  AND a."admin_user_id" IS NULL;

-- AddForeignKey
ALTER TABLE "audit_log_entries" ADD CONSTRAINT "audit_log_entries_admin_user_id_fkey" FOREIGN KEY ("admin_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
