import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { ImageResponse } from "next/og";

import { routing } from "@/i18n/routing";

// Default Open Graph image for every marketing page (link previews in mail, LinkedIn, Slack …), one
// per locale, rendered at build time. Brand colours from globals.css; text from messages `metadata`.

export const alt = "Dentnord";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function OpenGraphImage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: param } = await params;
  const locale = hasLocale(routing.locales, param) ? param : routing.defaultLocale;
  const t = await getTranslations({ locale, namespace: "metadata" });

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "72px 80px",
        color: "#ffffff",
        // The auth panel's gradient, as a linear one (next/og supports a subset of CSS).
        backgroundImage:
          "linear-gradient(135deg, #2f6cb5 0%, #1a4a80 38%, #0f2e4c 72%, #0a2138 100%)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
        <svg width="64" height="64" viewBox="0 0 32 32" fill="none">
          <path
            d="M6 9c0 9.5 4.4 16 10 16s10-6.5 10-16"
            stroke="#ffffff"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
          <circle cx="9.4" cy="17.5" r="2" fill="#ffffff" />
          <circle cx="16" cy="21.6" r="2" fill="#ffffff" />
          <circle cx="22.6" cy="17.5" r="2" fill="#ffffff" />
        </svg>
        <div style={{ fontSize: 44, fontWeight: 500, letterSpacing: "-0.03em" }}>Dentnord</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 24, maxWidth: 940 }}>
        <div style={{ fontSize: 72, lineHeight: 1.05, letterSpacing: "-0.03em" }}>
          {t("ogHeadline")}
        </div>
        <div style={{ fontSize: 30, lineHeight: 1.35, color: "rgba(255,255,255,0.8)" }}>
          {t("description")}
        </div>
      </div>
    </div>,
    size,
  );
}
