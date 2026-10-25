"use client";

import { ChevronDown, Inbox, Mail, MailOpen, Reply, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { deleteContactMessage, setContactMessageRead } from "@/server/actions/admin/messages";
import type { InboxMessage } from "@/server/queries/admin-messages";

import { useActionErrorToast } from "./form-kit";

// The contact-form inbox. Messages are plain text, shown as typed (never as HTML).

const dateFormat = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Europe/Copenhagen",
});

export function ContactInbox({ messages }: { messages: InboxMessage[] }) {
  const t = useTranslations("admin.inbox");
  if (messages.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-card border border-dashed border-line bg-surface px-6 py-16 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-brand-ice text-brand">
          <Inbox aria-hidden className="size-5" />
        </span>
        <p className="font-medium text-ink">{t("empty")}</p>
        <p className="max-w-sm text-sm text-muted-foreground">{t("emptyHint")}</p>
      </div>
    );
  }
  const unread = messages.filter((m) => !m.read).length;
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        {t("summary", { total: messages.length, unread })}
      </p>
      <ul className="flex flex-col gap-2">
        {messages.map((m) => (
          <MessageItem key={m.id} message={m} />
        ))}
      </ul>
    </div>
  );
}

function MessageItem({ message: m }: { message: InboxMessage }) {
  const t = useTranslations("admin.inbox");
  const router = useRouter();
  const errorToast = useActionErrorToast();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const bodyId = `message-${m.id}`;

  function run(action: () => Promise<{ ok: boolean; error?: string }>, done: string) {
    startTransition(async () => {
      const result = await action().catch(() => null);
      if (!result?.ok) {
        errorToast(result?.error ?? "generic");
        return;
      }
      toast.success(done);
      router.refresh();
    });
  }

  return (
    <li
      data-contact-message={m.id}
      data-read={m.read ? "true" : "false"}
      className={cn(
        "rounded-card border bg-surface transition-colors",
        m.read ? "border-line" : "border-brand/30 bg-brand-ice/40",
      )}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start gap-3 rounded-card px-4 py-3.5 text-left sm:px-5"
      >
        <span
          aria-hidden
          className={cn(
            "mt-2 size-2 shrink-0 rounded-full",
            m.read ? "bg-transparent" : "bg-brand",
          )}
        />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex flex-wrap items-baseline gap-x-2">
            <span className={cn("text-ink", !m.read && "font-semibold")}>{m.name}</span>
            <span className="text-sm text-muted-foreground">{m.clinic}</span>
            {!m.read && <span className="sr-only">{t("unread")}</span>}
          </span>
          <span className="truncate text-sm text-muted-foreground">{m.message}</span>
        </span>
        <span className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
          <time dateTime={m.createdAt}>{dateFormat.format(new Date(m.createdAt))}</time>
          <ChevronDown
            aria-hidden
            className={cn("size-4 transition-transform", open && "rotate-180")}
          />
        </span>
      </button>

      <div id={bodyId} hidden={!open} className="border-t border-line px-4 py-4 sm:px-5">
        <dl className="mb-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-muted-foreground">{t("email")}</dt>
            <dd>
              <a href={`mailto:${m.email}`} className="text-brand hover:underline">
                {m.email}
              </a>
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t("phone")}</dt>
            <dd>
              {m.phone ? (
                <a
                  href={`tel:${m.phone.replace(/\s/g, "")}`}
                  className="text-brand hover:underline"
                >
                  {m.phone}
                </a>
              ) : (
                "–"
              )}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t("language")}</dt>
            <dd className="uppercase">{m.locale}</dd>
          </div>
        </dl>
        <p data-message-body="" className="text-[0.9375rem] whitespace-pre-wrap text-ink">
          {m.message}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button asChild size="sm">
            <a href={`mailto:${m.email}`}>
              <Reply data-icon="inline-start" />
              {t("reply")}
            </a>
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() =>
              run(
                () => setContactMessageRead({ id: m.id, read: !m.read }),
                m.read ? t("markedUnread") : t("markedRead"),
              )
            }
          >
            {m.read ? <Mail data-icon="inline-start" /> : <MailOpen data-icon="inline-start" />}
            {m.read ? t("markUnread") : t("markRead")}
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button type="button" size="sm" variant="ghost" disabled={pending}>
                <Trash2 data-icon="inline-start" />
                {t("delete")}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t("deleteTitle")}</AlertDialogTitle>
                <AlertDialogDescription>
                  {t("deleteDescription", { name: m.name })}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => run(() => deleteContactMessage({ id: m.id }), t("deleted"))}
                >
                  {t("delete")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </li>
  );
}
