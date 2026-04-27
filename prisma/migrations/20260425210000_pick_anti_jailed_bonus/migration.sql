-- Story 3.4: persist anti-jailed bonus intent for 1 vs 2 point scoring (Epic 5).
ALTER TABLE "picks" ADD COLUMN "anti_jailed_bonus" BOOLEAN NOT NULL DEFAULT false;
