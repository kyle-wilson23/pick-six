import { Heading, Section, Text } from "@react-email/components";
import { formatInTimeZone } from "date-fns-tz";

import { TEST_LEAGUE_EMAIL_BODY_NOTICE } from "@/lib/email/test-league-labeling";
import { LEAGUE_BUSINESS_TIMEZONE } from "@/lib/league/league-rules";

import { EmailLayout, PrimaryCta } from "./EmailLayout";
import {
  headingStyle,
  sectionStyle,
  subheadingStyle,
  testNoticeStyle,
  textStyle,
} from "./email-styles";

export type ReminderEmailProps = {
  leagueName: string;
  weekNumber: number;
  recipientDisplayName: string;
  jailedTeamName: string | null;
  jailedTeamAbbreviation: string | null;
  picksUrl: string;
  /** 1 = heads-up (~48h out), 2 = last call (~12h out). Deadline-anchored, not weekday-anchored. */
  slot: 1 | 2;
  /** FR26 lock instant; omitted when the week has no schedule data to anchor on. */
  pickDeadlineUtc?: Date | null;
  isTestLeague?: boolean;
};

export function ReminderEmail({
  leagueName,
  weekNumber,
  recipientDisplayName,
  jailedTeamName,
  jailedTeamAbbreviation,
  picksUrl,
  slot,
  pickDeadlineUtc = null,
  isTestLeague = false,
}: ReminderEmailProps) {
  const jailedLabel =
    jailedTeamName != null && jailedTeamAbbreviation != null
      ? `${jailedTeamName} (${jailedTeamAbbreviation})`
      : "Not yet announced for this week";

  // Weeks lock on whatever day their first game falls on, so the copy states the real lock instant
  // rather than naming a weekday.
  const lockLabel =
    pickDeadlineUtc == null
      ? null
      : formatInTimeZone(
          pickDeadlineUtc,
          LEAGUE_BUSINESS_TIMEZONE,
          "EEEE, MMMM d 'at' h:mm a 'ET'",
        );

  const bodyCopy =
    slot === 1
      ? `Friendly reminder — you haven't submitted your pick for this week yet. ${
          lockLabel != null
            ? `Picks lock ${lockLabel}.`
            : "Lock in your choice before this week's deadline."
        }`
      : `Last call — ${
          lockLabel != null ? `picks lock ${lockLabel}` : "picks lock soon"
        }. Submit your pick now so you don't miss this week.`;

  const previewText =
    slot === 1
      ? `You haven't submitted your Week ${weekNumber} pick yet — don't forget!`
      : `Last call — submit your Week ${weekNumber} pick before it locks`;

  const ctaLabel = slot === 2 ? "Submit your pick now" : "Make your picks";

  return (
    <EmailLayout preview={previewText}>
      {isTestLeague ? <Text style={testNoticeStyle}>{TEST_LEAGUE_EMAIL_BODY_NOTICE}</Text> : null}
      <Heading as="h1" style={headingStyle}>
        {leagueName} — Week {weekNumber}
      </Heading>

      <Section style={sectionStyle}>
        <Text style={textStyle}>Hi {recipientDisplayName},</Text>
        <Text style={textStyle}>{bodyCopy}</Text>
      </Section>

      <Section style={sectionStyle}>
        <Heading as="h2" style={subheadingStyle}>
          Jailed team
        </Heading>
        <Text style={textStyle}>{jailedLabel}</Text>
      </Section>

      <PrimaryCta href={picksUrl} label={ctaLabel} />
    </EmailLayout>
  );
}
