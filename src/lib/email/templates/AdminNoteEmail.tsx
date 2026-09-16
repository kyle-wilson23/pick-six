import { Heading, Text } from "@react-email/components";

import { TEST_LEAGUE_EMAIL_BODY_NOTICE } from "@/lib/email/test-league-labeling";

import { EmailLayout, PrimaryCta } from "./EmailLayout";
import { headingStyle, subheadingStyle, testNoticeStyle, textStyle } from "./email-styles";

export type AdminNoteEmailProps = {
  leagueName: string;
  note: string;
  leagueUrl: string;
  isTestLeague?: boolean;
};

export function AdminNoteEmail({
  leagueName,
  note,
  leagueUrl,
  isTestLeague = false,
}: AdminNoteEmailProps) {
  return (
    <EmailLayout preview={`A note from your ${leagueName} commissioner`}>
      {isTestLeague ? <Text style={testNoticeStyle}>{TEST_LEAGUE_EMAIL_BODY_NOTICE}</Text> : null}
      <Heading as="h1" style={headingStyle}>
        {leagueName}
      </Heading>
      <Heading as="h2" style={subheadingStyle}>
        Note from your commissioner
      </Heading>
      <Text style={{ ...textStyle, whiteSpace: "pre-wrap" }}>{note}</Text>
      <PrimaryCta href={leagueUrl} label="Open league" />
    </EmailLayout>
  );
}
