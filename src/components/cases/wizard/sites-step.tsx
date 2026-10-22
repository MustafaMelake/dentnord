"use client";

import { Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";

import {
  FormAlert,
  FormField,
  SelectInput,
  TextInput,
  useFieldError,
} from "@/components/shared/form-controls";
import { sortTeeth, toggleTooth } from "@/lib/fdi";
import { sitesSchema } from "@/lib/validation/case";

import { formatMm } from "../format";
import { ToothChart } from "../tooth-chart";
import type { WizardCatalog, WizardSite } from "./types";
import { WizardNav } from "./wizard-nav";

const OTHER = "__other";

/** Step 2: pick teeth on the chart; configure system, size and kit per site. */
export function SitesStep({
  locale,
  sites,
  catalog,
  defaults,
  onChange: onSitesChange,
  onBack,
  onNext,
  serverErrors,
}: {
  locale: string;
  sites: WizardSite[];
  catalog: WizardCatalog;
  defaults: { implantSystemId: string | null; surgicalKitId: string | null };
  onChange: (sites: WizardSite[]) => void;
  onBack: () => void;
  onNext: (sites: WizardSite[]) => Promise<void>;
  serverErrors: Record<string, string> | null;
}) {
  const t = useTranslations("cases.wizard.sites");
  const tv = useTranslations("validation");
  const [clientErrors, setClientErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const errors = { ...(serverErrors ?? {}), ...clientErrors };
  const teeth = sites.map((s) => s.fdiTooth);

  // Errors from the last "Next" are re-checked on the next one; drop them once the dentist edits.
  function onChange(next: WizardSite[]) {
    setClientErrors({});
    onSitesChange(next);
  }

  function toggle(tooth: number) {
    const nextTeeth = toggleTooth(teeth, tooth);
    if (nextTeeth.length < teeth.length) {
      onChange(sites.filter((s) => s.fdiTooth !== tooth));
      return;
    }
    // New site: same system and kit as the previous one in this case, else the dentist's last used.
    const previous = sites.at(-1);
    const systemId = previous?.implantSystemId ?? validSystem(defaults.implantSystemId);
    const kitId = previous
      ? previous.surgicalKitId
      : compatibleKit(defaults.surgicalKitId, systemId);
    const site: WizardSite = {
      fdiTooth: tooth,
      implantSystemId: systemId,
      implantSystemOther: previous?.other ? previous.implantSystemOther : "",
      diameter: null,
      length: null,
      surgicalKitId: kitId,
      other: previous?.other ?? false,
    };
    onChange(
      sortTeeth([...teeth, tooth]).map((n) =>
        n === tooth ? site : sites.find((s) => s.fdiTooth === n)!,
      ),
    );
  }

  const validSystem = (id: string | null) =>
    id && catalog.systems.some((s) => s.id === id) ? id : null;
  function compatibleKit(kitId: string | null, systemId: string | null) {
    const kit = kitId ? catalog.kits.find((k) => k.id === kitId) : null;
    if (!kit) return null;
    return !systemId || kit.systemIds.includes(systemId) ? kit.id : null;
  }

  function update(tooth: number, patch: Partial<WizardSite>) {
    onChange(sites.map((s) => (s.fdiTooth === tooth ? { ...s, ...patch } : s)));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const parsed = sitesSchema.safeParse({ sites });
    if (!parsed.success) {
      const map: Record<string, string> = {};
      for (const issue of parsed.error.issues)
        map[issue.path.map(String).join(".")] ??= issue.message;
      setClientErrors(map);
      document
        .getElementById(
          Object.keys(map)[0] === "sites" ? "sites-empty" : `site-${Object.keys(map)[0]}`,
        )
        ?.focus();
      return;
    }
    setClientErrors({});
    setSubmitting(true);
    await onNext(sites);
    setSubmitting(false);
  }

  return (
    <form
      onSubmit={submit}
      noValidate
      className="flex flex-col gap-8"
      aria-labelledby="wizard-step-title"
    >
      <div className="grid grid-cols-1 gap-8 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] xl:items-start">
        <div className="flex min-w-0 flex-col gap-3">
          <p className="text-sm text-ink-muted">{t("chartHint")}</p>
          <ToothChart
            selected={teeth}
            onToggle={toggle}
            className="rounded-card border border-line bg-surface p-3 sm:p-5"
          />
        </div>

        <section aria-labelledby="sites-heading" className="flex flex-col gap-3 xl:sticky xl:top-6">
          <h3
            id="sites-heading"
            className="flex items-baseline justify-between font-mono text-label text-ink-muted"
          >
            <span>{t("listTitle")}</span>
            <span>{t("count", { count: sites.length })}</span>
          </h3>
          {sites.length === 0 ? (
            <p
              id="sites-empty"
              tabIndex={-1}
              className="rounded-card border border-dashed border-line bg-surface p-6 text-center text-sm text-ink-muted outline-none"
            >
              {t("empty")}
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {sites.map((site, i) => (
                <SiteCard
                  key={site.fdiTooth}
                  index={i}
                  site={site}
                  catalog={catalog}
                  locale={locale}
                  errors={errors}
                  onUpdate={(patch) => update(site.fdiTooth, patch)}
                  onRemove={() => toggle(site.fdiTooth)}
                />
              ))}
            </ul>
          )}
          {errors.sites && <FormAlert>{tv(errors.sites as "siteRequired")}</FormAlert>}
        </section>
      </div>
      <WizardNav step={2} onBack={onBack} submitting={submitting} />
    </form>
  );
}

function SiteCard({
  index,
  site,
  catalog,
  locale,
  errors,
  onUpdate,
  onRemove,
}: {
  index: number;
  site: WizardSite;
  catalog: WizardCatalog;
  locale: string;
  errors: Record<string, string>;
  onUpdate: (patch: Partial<WizardSite>) => void;
  onRemove: () => void;
}) {
  const t = useTranslations("cases.wizard.sites");
  const tTeeth = useTranslations("cases.teeth");
  const fieldError = useFieldError();
  const err = (field: string) => fieldError({ message: errors[`sites.${index}.${field}`] });
  const system = catalog.systems.find((s) => s.id === site.implantSystemId) ?? null;
  const otherMode = !site.implantSystemId && site.other;
  const kits = catalog.kits.filter((k) => !system || k.systemIds.includes(system.id));
  const brands = [...new Set(catalog.systems.map((s) => s.brand))];
  const id = (field: string) => `site-sites.${index}.${field}`;
  const tooth = site.fdiTooth;

  function chooseSystem(value: string) {
    if (value === OTHER) {
      onUpdate({ implantSystemId: null, other: true, diameter: null, length: null });
      return;
    }
    const next = catalog.systems.find((s) => s.id === value) ?? null;
    const kit = site.surgicalKitId ? catalog.kits.find((k) => k.id === site.surgicalKitId) : null;
    onUpdate({
      implantSystemId: next?.id ?? null,
      implantSystemOther: "",
      other: false,
      // Keep sizes and kit only when they still fit the new system.
      diameter:
        next && site.diameter !== null && next.diameters.includes(site.diameter)
          ? site.diameter
          : null,
      length:
        next && site.length !== null && next.lengths.includes(site.length) ? site.length : null,
      surgicalKitId: kit && (!next || kit.systemIds.includes(next.id)) ? kit.id : null,
    });
  }

  const numberOrNull = (v: string) => (v === "" ? null : Number(v.replace(",", ".")));

  return (
    <li className="flex flex-col gap-4 rounded-card border border-line bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-full bg-brand font-mono text-sm font-medium text-white">
            {tooth}
          </span>
          <span className="text-sm text-ink-muted">
            {tTeeth("short", {
              quadrant: tTeeth(`quadrants.${Math.floor(tooth / 10)}` as "quadrants.1"),
              name: tTeeth(`names.${tooth % 10}` as "names.1"),
            })}
          </span>
        </div>
        <button
          type="button"
          onClick={onRemove}
          aria-label={t("remove", { tooth })}
          className="rounded-full p-2 text-ink-muted transition-colors hover:bg-surface-2 hover:text-destructive"
        >
          <Trash2 aria-hidden className="size-4" />
        </button>
      </div>

      <FormField id={id("implantSystemId")} label={t("system")} error={err("implantSystemId")}>
        <SelectInput
          id={id("implantSystemId")}
          value={site.implantSystemId ?? (otherMode ? OTHER : "")}
          onChange={(e) => chooseSystem(e.target.value)}
          aria-invalid={!!err("implantSystemId") || undefined}
        >
          <option value="">{t("systemChoose")}</option>
          {brands.map((brand) => (
            <optgroup key={brand} label={brand}>
              {catalog.systems
                .filter((s) => s.brand === brand)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.brand} {s.line}
                  </option>
                ))}
            </optgroup>
          ))}
          <option value={OTHER}>{t("systemOther")}</option>
        </SelectInput>
      </FormField>

      {otherMode && (
        <FormField
          id={id("implantSystemOther")}
          label={t("systemOtherName")}
          error={err("implantSystemOther")}
        >
          <TextInput
            id={id("implantSystemOther")}
            value={site.implantSystemOther}
            maxLength={120}
            onChange={(e) => onUpdate({ implantSystemOther: e.target.value })}
          />
        </FormField>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {(["diameter", "length"] as const).map((dim) => (
          <FormField key={dim} id={id(dim)} label={t(dim)} error={err(dim)}>
            {system ? (
              <SelectInput
                id={id(dim)}
                value={site[dim] === null ? "" : String(site[dim])}
                onChange={(e) => onUpdate({ [dim]: numberOrNull(e.target.value) })}
              >
                <option value="">{t("suggest")}</option>
                {(dim === "diameter" ? system.diameters : system.lengths).map((v) => (
                  <option key={v} value={v}>
                    {formatMm(v, locale)} mm
                  </option>
                ))}
              </SelectInput>
            ) : (
              <TextInput
                id={id(dim)}
                inputMode="decimal"
                placeholder={t("suggest")}
                defaultValue={site[dim] === null ? "" : formatMm(site[dim]!, locale)}
                onBlur={(e) => {
                  const n = numberOrNull(e.target.value.trim());
                  onUpdate({ [dim]: n === null || Number.isNaN(n) ? null : n });
                }}
              />
            )}
          </FormField>
        ))}
      </div>

      <FormField id={id("surgicalKitId")} label={t("kit")} error={err("surgicalKitId")}>
        <SelectInput
          id={id("surgicalKitId")}
          value={site.surgicalKitId ?? ""}
          onChange={(e) => onUpdate({ surgicalKitId: e.target.value || null })}
        >
          <option value="">{t("kitNone")}</option>
          {kits.map((k) => (
            <option key={k.id} value={k.id}>
              {k.name}
            </option>
          ))}
        </SelectInput>
      </FormField>
    </li>
  );
}
