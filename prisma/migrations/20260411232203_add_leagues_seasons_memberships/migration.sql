-- CreateEnum
CREATE TYPE "league_membership_role" AS ENUM ('ADMIN', 'MEMBER');

-- CreateTable
CREATE TABLE "leagues" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "leagues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seasons" (
    "id" TEXT NOT NULL,
    "league_id" TEXT NOT NULL,
    "nfl_season_year" INTEGER NOT NULL,
    "first_competition_week" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "seasons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "league_memberships" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "league_id" TEXT NOT NULL,
    "role" "league_membership_role" NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "league_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "leagues_name_key" ON "leagues"("name");

-- CreateIndex
CREATE UNIQUE INDEX "seasons_league_id_nfl_season_year_key" ON "seasons"("league_id", "nfl_season_year");

-- CreateIndex
CREATE UNIQUE INDEX "league_memberships_user_id_league_id_key" ON "league_memberships"("user_id", "league_id");

-- AddForeignKey
ALTER TABLE "seasons" ADD CONSTRAINT "seasons_league_id_fkey" FOREIGN KEY ("league_id") REFERENCES "leagues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "league_memberships" ADD CONSTRAINT "league_memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "league_memberships" ADD CONSTRAINT "league_memberships_league_id_fkey" FOREIGN KEY ("league_id") REFERENCES "leagues"("id") ON DELETE CASCADE ON UPDATE CASCADE;
