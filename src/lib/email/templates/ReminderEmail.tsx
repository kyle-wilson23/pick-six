import {
  Body,
  Button,
  Container,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";

import { TEST_LEAGUE_EMAIL_BODY_NOTICE } from "@/lib/email/test-league-labeling";

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

  return (
    <Html>
      <Preview>{previewText}</Preview>
      <Body style={{ fontFamily: "sans-serif", color: "#111" }}>
        <Container>
          {isTestLeague ? <Text>{TEST_LEAGUE_EMAIL_BODY_NOTICE}</Text> : null}
          <Heading as="h1">
            {leagueName} — Week {weekNumber}
          </Heading>

          <Section>
            <Text>Hi {recipientDisplayName},</Text>
            <Text>{bodyCopy}</Text>
          </Section>

          <Section style={{ marginTop: "24px" }}>
            <Heading as="h2" style={{ fontSize: "18px" }}>
              Jailed team
            </Heading>
            <Text>{jailedLabel}</Text>
          </Section>

          <Section style={{ marginTop: "32px" }}>
            <Button href={picksUrl}>
              {reminderType === "thursday" ? "Submit your pick now" : "Make your picks"}
            </Button>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
