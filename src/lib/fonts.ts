import { Geist, Geist_Mono } from "next/font/google";

// Swap typefaces here only. Components use the Tailwind utilities `font-sans` / `font-display`
// (Geist) and `font-mono` (Geist Mono, for small index labels like "01" and "Services /").
// The `latin` subset covers Danish (æ ø å). next/font self-hosts the files, so visitors never
// request anything from Google.

const sans = Geist({
  subsets: ["latin"],
  variable: "--ff-sans",
  display: "swap",
});

const mono = Geist_Mono({
  subsets: ["latin"],
  variable: "--ff-mono",
  display: "swap",
});

export const fontVariables = [sans.variable, mono.variable].join(" ");
