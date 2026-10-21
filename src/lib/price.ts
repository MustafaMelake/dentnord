// Prices: the admin types kroner the Danish way ("1 250,00"); the DB stores whole øre (Int) + currency.
// Pure functions, unit-tested in tests/unit/price.test.ts.

/** Upper bound for a single price: 10 000 000 kr. */
export const MAX_PRICE_ORE = 10_000_000_00;

/**
 * Parses a kroner amount into whole øre, or null if it isn't a valid price.
 *
 * Accepted: "1250", "1 250", "1.250", "1 250,00", "1.250,5", "1250,50", "1250.50", "kr 1.250,00",
 * "1 250 kr.", "DKK 1250". Danish first: a comma is always the decimal separator, and then dots and
 * spaces group thousands. Without a comma, a dot followed by one or two final digits is a decimal
 * point ("1250.50"), and a dot followed by groups of three digits groups thousands ("1.250").
 */
export function parseKroner(input: string): number | null {
  const s = input
    .trim()
    .replace(/^(kr\.?|dkk)\s*/i, "")
    .replace(/\s*(kr\.?|dkk|,-)$/i, "")
    .replace(/[\s  ]/g, "");
  if (!s || s.startsWith("-")) return null;

  let whole: string;
  let fraction = "";
  if (s.includes(",")) {
    const parts = s.split(",");
    if (parts.length !== 2) return null;
    [whole, fraction] = parts;
    if (!/^\d{1,3}(\.\d{3})*$|^\d+$/.test(whole)) return null;
    whole = whole.replace(/\./g, "");
  } else if (/^\d+\.\d{1,2}$/.test(s)) {
    [whole, fraction] = s.split(".");
  } else {
    if (!/^\d{1,3}(\.\d{3})+$|^\d+$/.test(s)) return null;
    whole = s.replace(/\./g, "");
  }
  if (!/^\d+$/.test(whole) || !/^\d{0,2}$/.test(fraction)) return null;

  const ore = Number(whole) * 100 + Number(fraction.padEnd(2, "0") || "0");
  return Number.isSafeInteger(ore) && ore <= MAX_PRICE_ORE ? ore : null;
}

/** Øre → the admin input format: "1 250,00" (no currency, non-breaking spaces avoided). */
export function formatKronerInput(ore: number): string {
  const kroner = Math.floor(ore / 100);
  const decimals = String(ore % 100).padStart(2, "0");
  const grouped = String(kroner).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${grouped},${decimals}`;
}

/** Øre → a display price for the public site, e.g. "1.250 kr." (da) / "DKK 1,250" (en). */
export function formatPrice(ore: number, currency: string, locale: string): string {
  const hasDecimals = ore % 100 !== 0;
  return new Intl.NumberFormat(locale === "en" ? "en-GB" : "da-DK", {
    style: "currency",
    currency,
    minimumFractionDigits: hasDecimals ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(ore / 100);
}
