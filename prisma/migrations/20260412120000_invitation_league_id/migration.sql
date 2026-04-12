-- AlterTable
ALTER TABLE "invitations" ADD COLUMN "league_id" TEXT;

-- CreateIndex
CREATE INDEX "invitations_league_id_invited_email_idx" ON "invitations"("league_id", "invited_email");

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_league_id_fkey" FOREIGN KEY ("league_id") REFERENCES "leagues"("id") ON DELETE CASCADE ON UPDATE CASCADE;
