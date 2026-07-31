import { Heading, Text } from "@react-email/components";

import { TEST_LEAGUE_EMAIL_BODY_NOTICE } from "@/lib/email/test-league-labeling";

import { EmailLayout, PrimaryCta } from "./EmailLayout";
import { headingStyle, testNoticeStyle, textStyle } from "./email-styles";

export type InvitationEmailProps = {
  leagueName: string;
  signupUrl: string;
  isTestLeague?: boolean;
};

export function InvitationEmail({
  leagueName,
  signupUrl,
  isTestLeague = false,
}: InvitationEmailProps) {
  return (
    <EmailLayout preview={`You're invited to join ${leagueName}`}>
      {isTestLeague ? <Text style={testNoticeStyle}>{TEST_LEAGUE_EMAIL_BODY_NOTICE}</Text> : null}
      <Heading as="h1" style={headingStyle}>
        {leagueName}
      </Heading>
      <Text style={textStyle}>You&apos;ve been invited to join {leagueName}</Text>
      <PrimaryCta href={signupUrl} label="Accept invitation" />
    </EmailLayout>
  );
}
