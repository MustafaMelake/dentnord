import {
  Body,
  Button,
  Container,
  Head,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import type { CSSProperties, ReactNode } from "react";

// Shared frame for every Dentnord email. Inline styles only (email clients ignore stylesheets).
// Colours mirror the design tokens in globals.css.

const colors = {
  canvas: "#f4f7fa",
  surface: "#ffffff",
  ink: "#0b1b2b",
  inkMuted: "#546577",
  line: "#dce4ec",
  brand: "#1e5aa8",
};

const font =
  '"Geist", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

export function EmailLayout({
  lang,
  preview,
  footer,
  children,
}: {
  lang: string;
  preview: string;
  footer: string;
  children: ReactNode;
}) {
  return (
    <Html lang={lang}>
      <Head />
      <Preview>{preview}</Preview>
      <Body
        style={{ backgroundColor: colors.canvas, fontFamily: font, margin: 0, padding: "32px 0" }}
      >
        <Container
          style={{
            backgroundColor: colors.surface,
            border: `1px solid ${colors.line}`,
            borderRadius: 16,
            maxWidth: 560,
            padding: "36px 40px",
          }}
        >
          <Text
            style={{
              color: colors.ink,
              fontSize: 20,
              fontWeight: 500,
              letterSpacing: "-0.03em",
              margin: 0,
            }}
          >
            Dentnord
          </Text>
          <Section style={{ marginTop: 28 }}>{children}</Section>
          <Hr style={{ borderColor: colors.line, margin: "32px 0 16px" }} />
          <Text style={{ color: colors.inkMuted, fontSize: 12, lineHeight: "18px", margin: 0 }}>
            {footer}
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export const emailText = {
  heading: {
    color: colors.ink,
    fontSize: 24,
    fontWeight: 400,
    letterSpacing: "-0.02em",
    lineHeight: "30px",
    margin: "0 0 16px",
  } satisfies CSSProperties,
  body: {
    color: colors.ink,
    fontSize: 15,
    lineHeight: "24px",
    margin: "0 0 16px",
  } satisfies CSSProperties,
  muted: {
    color: colors.inkMuted,
    fontSize: 13,
    lineHeight: "20px",
    margin: "0 0 12px",
  } satisfies CSSProperties,
  label: { color: colors.inkMuted, fontSize: 12, margin: 0 } satisfies CSSProperties,
  value: { color: colors.ink, fontSize: 15, margin: "0 0 12px" } satisfies CSSProperties,
  quote: {
    borderLeft: `3px solid ${colors.line}`,
    color: colors.ink,
    fontSize: 15,
    lineHeight: "24px",
    margin: "0 0 16px",
    padding: "4px 0 4px 14px",
    whiteSpace: "pre-line",
  } satisfies CSSProperties,
};

export function EmailButton({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Section style={{ margin: "8px 0 24px" }}>
      <Button
        href={href}
        style={{
          backgroundColor: colors.brand,
          borderRadius: 999,
          color: "#ffffff",
          fontSize: 15,
          fontWeight: 500,
          padding: "12px 22px",
        }}
      >
        {children}
      </Button>
    </Section>
  );
}

/** The raw URL under the button, for clients that block buttons. */
export function EmailLinkFallback({ href, label }: { href: string; label: string }) {
  return (
    <Text style={emailText.muted}>
      {label}
      <br />
      <Link href={href} style={{ color: colors.brand, wordBreak: "break-all" }}>
        {href}
      </Link>
    </Text>
  );
}
