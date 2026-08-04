import {
  Body,
  Button,
  Container,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import type { ReactNode } from "react";

import {
  bodyStyle,
  brandHeaderStyle,
  brandTextStyle,
  containerStyle,
  ctaSectionStyle,
  fallbackLinkStyle,
  fallbackTextStyle,
  primaryButtonStyle,
} from "./email-styles";

export type EmailLayoutProps = {
  children: ReactNode;
  preview?: string;
  brandLabel?: string;
};

export function EmailLayout({
  children,
  preview,
  brandLabel = "Pigskin Pick'Em",
}: EmailLayoutProps) {
  return (
    <Html>
      {preview ? <Preview>{preview}</Preview> : null}
      <Body style={bodyStyle}>
        <Container style={containerStyle}>
          <Section style={brandHeaderStyle}>
            <Text style={brandTextStyle}>{brandLabel}</Text>
          </Section>
          {children}
        </Container>
      </Body>
    </Html>
  );
}

export type PrimaryCtaProps = {
  href: string;
  label: string;
};

/** Emerald primary button + muted plaintext URL fallback for button-stripping clients. */
export function PrimaryCta({ href, label }: PrimaryCtaProps) {
  return (
    <Section style={ctaSectionStyle}>
      <Button href={href} style={primaryButtonStyle}>
        {label}
      </Button>
      <Text style={fallbackTextStyle}>
        Or paste this link:{" "}
        <Link href={href} style={fallbackLinkStyle}>
          {href}
        </Link>
      </Text>
    </Section>
  );
}
