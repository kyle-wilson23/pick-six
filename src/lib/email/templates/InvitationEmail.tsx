import {
  Body,
  Button,
  Container,
  Heading,
  Html,
  Text,
} from "@react-email/components";

import { TEST_LEAGUE_EMAIL_BODY_NOTICE } from "@/lib/email/test-league-labeling";

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
    <Html>
      <Body>
        <Container>
          {isTestLeague ? <Text>{TEST_LEAGUE_EMAIL_BODY_NOTICE}</Text> : null}
          <Heading as="h1">{leagueName}</Heading>
          <Text>You&apos;ve been invited to join {leagueName}</Text>
          <Button href={signupUrl}>Accept invitation</Button>
        </Container>
      </Body>
    </Html>
  );
}
