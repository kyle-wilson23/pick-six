import { Heading, Text } from "@react-email/components";

import { EmailLayout } from "./EmailLayout";
import { headingStyle, mutedTextStyle, textStyle } from "./email-styles";

export function ReportReceiptEmail() {
  return (
    <EmailLayout preview="We received your Pigskin Pick'Em report">
      <Heading as="h1" style={headingStyle}>
        We received your report
      </Heading>
      <Text style={textStyle}>
        Thanks for taking the time to tell us what went wrong. We&apos;ve logged it and will look
        at it when we can.
      </Text>
      <Text style={mutedTextStyle}>
        This is an automated receipt. You won&apos;t get a reply to this email.
      </Text>
    </EmailLayout>
  );
}
