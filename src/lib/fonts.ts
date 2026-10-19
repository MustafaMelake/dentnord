import { Geist_Mono, Inter, Schibsted_Grotesk } from "next/font/google";

// Swap typefaces here only. Components use the Tailwind utilities `font-display`, `font-sans`
// and `font-mono`, which globals.css maps onto these CSS variables.

const display = Schibsted_Grotesk({
  subsets: ["latin"],
  variable: "--ff-display",
  display: "swap",
});

const body = Inter({
  subsets: ["latin"],
  variable: "--ff-body",
  display: "swap",
});

const mono = Geist_Mono({
  subsets: ["latin"],
  variable: "--ff-mono",
  display: "swap",
});

export const fontVariables = [display.variable, body.variable, mono.variable].join(" ");
