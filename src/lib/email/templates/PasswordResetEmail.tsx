import { Heading, Text } from "@react-email/components";

import { EmailLayout, PrimaryCta } from "./EmailLayout";
import { headingStyle, mutedTextStyle, textStyle } from "./email-styles";

export type PasswordResetEmailProps = {
  resetUrl: string;
};

export function PasswordResetEmail({ resetUrl }: PasswordResetEmailProps) {
  return (
    <EmailLayout preview="Reset your Pick Six password">
      <Heading as="h1" style={headingStyle}>
        Reset your password
      </Heading>
      <Text style={textStyle}>
        We received a request to reset your Pick Six password. Click the button below to choose a
        new password. This link expires in one hour and can only be used once.
      </Text>
      <PrimaryCta href={resetUrl} label="Reset password" />
      <Text style={mutedTextStyle}>
        If you did not request a password reset, you can ignore this email.
      </Text>
    </EmailLayout>
  );
}
