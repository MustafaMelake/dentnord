// Plain module (not "use client"), so server pages can call these too.

const intlLocale = (locale: string) => (locale === "en" ? "en-GB" : "da-DK");

export function formatBytes(bytes: number, locale: string) {
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${new Intl.NumberFormat(intlLocale(locale), { maximumFractionDigits: unit ? 1 : 0 }).format(value)} ${units[unit]}`;
}

export function formatMm(value: number, locale: string) {
  return new Intl.NumberFormat(intlLocale(locale), { maximumFractionDigits: 2 }).format(value);
}
