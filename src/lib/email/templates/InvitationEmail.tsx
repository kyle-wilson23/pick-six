import {
  Body,
  Button,
  Container,
  Heading,
  Html,
  Text,
} from "@react-email/components";

export type InvitationEmailProps = {
  leagueName: string;
  signupUrl: string;
};

export function InvitationEmail({ leagueName, signupUrl }: InvitationEmailProps) {
  return (
    <Html>
      <Body>
        <Container>
          <Heading as="h1">{leagueName}</Heading>
          <Text>You&apos;ve been invited to join {leagueName}</Text>
          <Button href={signupUrl}>Accept invitation</Button>
        </Container>
      </Body>
    </Html>
  );
}
