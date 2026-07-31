import { Heading, Section, Text } from "@react-email/components";

import { TEST_LEAGUE_EMAIL_BODY_NOTICE } from "@/lib/email/test-league-labeling";

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
  reminderType: "wednesday" | "thursday";
  isTestLeague?: boolean;
};

export function ReminderEmail({
  leagueName,
  weekNumber,
  recipientDisplayName,
  jailedTeamName,
  jailedTeamAbbreviation,
  picksUrl,
  reminderType,
  isTestLeague = false,
}: ReminderEmailProps) {
  const jailedLabel =
    jailedTeamName != null && jailedTeamAbbreviation != null
      ? `${jailedTeamName} (${jailedTeamAbbreviation})`
      : "Not yet announced for this week";

  const bodyCopy =
    reminderType === "wednesday"
      ? "Friendly reminder — you haven't submitted your pick for this week yet. Don't forget to lock in your choice before Thursday's deadline."
      : "Final reminder — the pick deadline is in about one hour. Submit your pick now so you don't miss this week.";

  const previewText =
    reminderType === "wednesday"
      ? `You haven't submitted your Week ${weekNumber} pick yet — don't forget!`
      : `Pick deadline in 1 hour — submit your Week ${weekNumber} pick now`;

  const ctaLabel =
    reminderType === "thursday" ? "Submit your pick now" : "Make your picks";

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
