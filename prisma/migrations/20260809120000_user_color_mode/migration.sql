-- CreateEnum
CREATE TYPE "color_mode" AS ENUM ('DARK', 'LIGHT');

-- AlterTable
ALTER TABLE "users" ADD COLUMN "color_mode" "color_mode" NOT NULL DEFAULT 'DARK';
