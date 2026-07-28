import {
  Body,
  Button,
  Container,
  Heading,
  Html,
  Text,
} from "@react-email/components";

export type PasswordResetEmailProps = {
  resetUrl: string;
};

export function PasswordResetEmail({ resetUrl }: PasswordResetEmailProps) {
  return (
    <Html>
      <Body>
        <Container>
          <Heading as="h1">Reset your password</Heading>
          <Text>
            We received a request to reset your Pick Six password. Click the button below to choose
            a new password. This link expires in one hour and can only be used once.
          </Text>
          <Button href={resetUrl}>Reset password</Button>
          <Text>
            If you did not request a password reset, you can ignore this email.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
