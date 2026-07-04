-- AlterTable
ALTER TABLE "league_week_email_configs" ADD COLUMN     "thursday_reminder_sent_at" TIMESTAMPTZ,
ADD COLUMN     "wednesday_reminder_sent_at" TIMESTAMPTZ;
