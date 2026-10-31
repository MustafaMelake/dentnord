"use client";

import { Check, Copy, KeyRound } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useId, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createResetLink } from "@/server/actions/admin-dentists";

// "Create password-reset link" (server/services/password-reset-link.ts): a one-time link, valid for
// 1 hour, for the admin to send by hand (e.g. WhatsApp) when the reset email doesn't arrive. The
// link lives only in this component's state: it is never stored, and gone after a reload.

export function DentistResetLink({
  dentistId,
  disabled,
}: {
  dentistId: string;
  disabled: boolean;
}) {
  const t = useTranslations("admin.dentists.resetLink");
  const tErrors = useTranslations("admin.dentists.errors");
  const format = useFormatter();
  const inputId = useId();
  const [link, setLink] = useState<{ url: string; expiresAt: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  function create() {
    startTransition(async () => {
      const result = await createResetLink({ dentistId }).catch(() => null);
      if (!result?.ok) {
        toast.error(tErrors(result?.error ?? "generic"));
        return;
      }
      setCopied(false);
      setLink({ url: result.url, expiresAt: result.expiresAt });
    });
  }

  async function copy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link.url);
      setCopied(true);
      toast.success(t("copied"));
    } catch {
      // No clipboard access (e.g. an insecure origin): the field is selected for copying by hand.
      document.getElementById(inputId)?.focus();
      toast.error(t("copyFailed"));
    }
  }

  return (
    <section
      aria-labelledby="reset-link-heading"
      data-reset-link=""
      className="flex flex-col gap-3 rounded-card border border-line bg-surface p-5 sm:p-6"
    >
      <h2 id="reset-link-heading" className="font-mono text-label text-ink-muted">
        {t("title")}
      </h2>
      <p className="max-w-3xl text-sm text-ink-muted">{disabled ? t("disabled") : t("intro")}</p>
      {!disabled && (
        <Button variant="outline" className="w-fit" onClick={create} disabled={pending}>
          <KeyRound aria-hidden data-icon="inline-start" />
          {pending ? t("working") : link ? t("again") : t("button")}
        </Button>
      )}
      {link && (
        <div className="flex flex-col gap-2 rounded-lg border border-brand/20 bg-brand-ice p-4">
          <Label htmlFor={inputId}>{t("linkLabel")}</Label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              id={inputId}
              readOnly
              value={link.url}
              spellCheck={false}
              onFocus={(event) => event.currentTarget.select()}
              className="bg-surface font-mono text-xs"
            />
            <Button type="button" onClick={copy} className="shrink-0">
              {copied ? (
                <Check aria-hidden data-icon="inline-start" />
              ) : (
                <Copy aria-hidden data-icon="inline-start" />
              )}
              {copied ? t("copiedButton") : t("copy")}
            </Button>
          </div>
          <p className="text-sm text-brand-deep">
            {t("validUntil", {
              time: format.dateTime(new Date(link.expiresAt), {
                timeStyle: "short",
                timeZone: "Europe/Copenhagen",
              }),
            })}
          </p>
        </div>
      )}
    </section>
  );
}
