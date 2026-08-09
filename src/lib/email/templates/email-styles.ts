import type { CSSProperties } from "react";

/** Light email-safe canvas — do not port app dark chrome. */
export const emailColors = {
  bodyBg: "#f4f4f5",
  cardBg: "#ffffff",
  text: "#18181b",
  muted: "#71717a",
  border: "#e4e4e7",
  heading: "#09090b",
  primary: "#2ECC71",
  primaryContrast: "#FFFFFF",
  testNotice: "#b45309",
} as const;

export const bodyStyle: CSSProperties = {
  backgroundColor: emailColors.bodyBg,
  color: emailColors.text,
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  margin: 0,
  padding: "24px 12px",
};

export const containerStyle: CSSProperties = {
  backgroundColor: emailColors.cardBg,
  borderRadius: "8px",
  margin: "0 auto",
  maxWidth: "600px",
  padding: "32px 28px",
};

export const brandHeaderStyle: CSSProperties = {
  borderBottom: `1px solid ${emailColors.border}`,
  marginBottom: "24px",
  paddingBottom: "16px",
};

export const brandTextStyle: CSSProperties = {
  color: emailColors.primary,
  fontSize: "14px",
  fontWeight: 700,
  letterSpacing: "0.04em",
  margin: 0,
  textTransform: "uppercase" as const,
};

export const headingStyle: CSSProperties = {
  color: emailColors.heading,
  fontSize: "24px",
  fontWeight: 700,
  lineHeight: "1.3",
  margin: "0 0 16px",
};

export const subheadingStyle: CSSProperties = {
  color: emailColors.heading,
  fontSize: "16px",
  fontWeight: 700,
  lineHeight: "1.4",
  margin: "0 0 12px",
};

export const textStyle: CSSProperties = {
  color: emailColors.text,
  fontSize: "16px",
  lineHeight: "1.55",
  margin: "0 0 12px",
};

export const mutedTextStyle: CSSProperties = {
  color: emailColors.muted,
  fontSize: "14px",
  lineHeight: "1.5",
  margin: "0 0 8px",
};

export const sectionStyle: CSSProperties = {
  marginBottom: "24px",
};

export const ctaSectionStyle: CSSProperties = {
  margin: "28px 0 8px",
  textAlign: "center" as const,
};

export const primaryButtonStyle: CSSProperties = {
  backgroundColor: emailColors.primary,
  border: `1px solid ${emailColors.primary}`,
  borderRadius: "8px",
  color: emailColors.primaryContrast,
  display: "inline-block",
  fontSize: "16px",
  fontWeight: 700,
  lineHeight: "100%",
  padding: "14px 24px",
  textAlign: "center" as const,
  textDecoration: "none",
};

export const fallbackTextStyle: CSSProperties = {
  color: emailColors.muted,
  fontSize: "13px",
  lineHeight: "1.5",
  margin: "16px 0 0",
  textAlign: "center" as const,
  wordBreak: "break-all" as const,
};

export const fallbackLinkStyle: CSSProperties = {
  color: emailColors.muted,
  textDecoration: "underline",
};

export const testNoticeStyle: CSSProperties = {
  color: emailColors.testNotice,
  fontSize: "13px",
  fontWeight: 600,
  lineHeight: "1.4",
  margin: "0 0 16px",
};

export const tableStyle: CSSProperties = {
  borderCollapse: "collapse" as const,
  width: "100%",
};

export const thStyle: CSSProperties = {
  borderBottom: `2px solid ${emailColors.border}`,
  color: emailColors.heading,
  fontSize: "13px",
  fontWeight: 700,
  padding: "10px 8px",
  textAlign: "left" as const,
};

export const thRightStyle: CSSProperties = {
  ...thStyle,
  textAlign: "right" as const,
};

export const tdStyle: CSSProperties = {
  borderBottom: `1px solid ${emailColors.border}`,
  color: emailColors.text,
  fontSize: "15px",
  padding: "10px 8px",
};

export const tdRightStyle: CSSProperties = {
  ...tdStyle,
  textAlign: "right" as const,
};

/** Nested identity table inside the standings Name cell. */
export const nameCellInnerTableStyle: CSSProperties = {
  borderCollapse: "collapse" as const,
};

export const nameCellAvatarTdStyle: CSSProperties = {
  padding: "0 8px 0 0",
  verticalAlign: "middle" as const,
  width: 28,
};

export const nameCellAvatarImgStyle: CSSProperties = {
  borderRadius: "4px",
  display: "block",
  height: 28,
  width: 28,
};

export const nameCellInitialsStyle: CSSProperties = {
  backgroundColor: emailColors.border,
  borderRadius: "4px",
  color: emailColors.heading,
  display: "block",
  fontSize: "11px",
  fontWeight: 700,
  height: 28,
  lineHeight: "28px",
  textAlign: "center" as const,
  width: 28,
};

export const nameCellTextTdStyle: CSSProperties = {
  padding: 0,
  verticalAlign: "middle" as const,
};
