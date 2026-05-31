-- CreateTable
CREATE TABLE "audit_log_entries" (
    "id" TEXT NOT NULL,
    "league_id" TEXT NOT NULL,
    "admin_membership_id" TEXT NOT NULL,
    "target_membership_id" TEXT NOT NULL,
    "nfl_week_number" INTEGER NOT NULL,
    "before_team_id" TEXT,
    "after_team_id" TEXT NOT NULL,
    "before_anti_jailed" BOOLEAN,
    "after_anti_jailed" BOOLEAN NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "audit_log_entries_league_id_created_at_idx" ON "audit_log_entries"("league_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "audit_log_entries" ADD CONSTRAINT "audit_log_entries_league_id_fkey" FOREIGN KEY ("league_id") REFERENCES "leagues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log_entries" ADD CONSTRAINT "audit_log_entries_admin_membership_id_fkey" FOREIGN KEY ("admin_membership_id") REFERENCES "league_memberships"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log_entries" ADD CONSTRAINT "audit_log_entries_target_membership_id_fkey" FOREIGN KEY ("target_membership_id") REFERENCES "league_memberships"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log_entries" ADD CONSTRAINT "audit_log_entries_before_team_id_fkey" FOREIGN KEY ("before_team_id") REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log_entries" ADD CONSTRAINT "audit_log_entries_after_team_id_fkey" FOREIGN KEY ("after_team_id") REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
