"use client";

import { useLocale, useTranslations } from "next-intl";
import { useMemo, type ComponentProps } from "react";

import { SelectInput } from "@/components/shared/form-controls";
import { COUNTRIES, DEFAULT_COUNTRY, LOCALES } from "@/lib/validation/auth";

/** Country names come from the browser/Node `Intl` data, in the page language. Denmark first. */
export function CountrySelect(props: ComponentProps<"select">) {
  const locale = useLocale();
  const options = useMemo(() => {
    const names = new Intl.DisplayNames([locale], { type: "region" });
    const label = (code: string) => names.of(code) ?? code;
    const rest = COUNTRIES.filter((c) => c !== DEFAULT_COUNTRY).sort((a, b) =>
      label(a).localeCompare(label(b), locale),
    );
    return [DEFAULT_COUNTRY, ...rest].map((code) => ({ code, label: label(code) }));
  }, [locale]);
  return (
    <SelectInput autoComplete="country" {...props}>
      {options.map(({ code, label }) => (
        <option key={code} value={code}>
          {label}
        </option>
      ))}
    </SelectInput>
  );
}

export function LanguageSelect(props: ComponentProps<"select">) {
  const t = useTranslations("localeSwitcher");
  return (
    <SelectInput {...props}>
      {LOCALES.map((l) => (
        <option key={l} value={l}>
          {t(l)}
        </option>
      ))}
    </SelectInput>
  );
}
