import { Heading, Text } from "@react-email/components";

import { EmailLayout } from "./EmailLayout";
import { headingStyle, mutedTextStyle, textStyle } from "./email-styles";

const outageBannerStyle = {
  backgroundColor: "#fef3c7",
  border: "2px solid #b45309",
  borderRadius: "8px",
  color: "#92400e",
  fontSize: "16px",
  fontWeight: 700,
  lineHeight: "1.4",
  margin: "0 0 20px",
  padding: "12px 16px",
} as const;

const preStyle = {
  backgroundColor: "#f4f4f5",
  borderRadius: "8px",
  color: "#18181b",
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  fontSize: "13px",
  lineHeight: "1.45",
  margin: "0 0 12px",
  padding: "12px 16px",
  whiteSpace: "pre-wrap" as const,
  wordBreak: "break-word" as const,
};

export type ReportFallbackEmailProps = {
  title: string;
  body: string;
  githubError: string;
};

export function ReportFallbackEmail({ title, body, githubError }: ReportFallbackEmailProps) {
  return (
    <EmailLayout preview="GitHub is down — user report issue was not opened">
      <Text style={outageBannerStyle}>
        GitHub is down / the issue was not opened. This email is the only copy of the report.
        Do not treat a later GitHub notification as this item.
      </Text>
      <Heading as="h1" style={headingStyle}>
        User report fallback
      </Heading>
      <Text style={textStyle}>{title}</Text>
      <Text style={mutedTextStyle}>GitHub error: {githubError}</Text>
      <Text style={preStyle}>{body}</Text>
    </EmailLayout>
  );
}
