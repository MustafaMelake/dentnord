"use client";

import { Lock, Pencil, Send, Trash2 } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { MESSAGE_EDIT_WINDOW_MS, MESSAGE_MAX_LENGTH } from "@/lib/validation/messages";
import {
  deleteMessageAction,
  editMessageAction,
  markMessagesReadAction,
  sendMessageAction,
} from "@/server/actions/case-lifecycle";
import type { CaseMessageView } from "@/server/services/case-messages";

// One message thread on a case: the case thread (dentist ↔ Dentnord) or, for the admin, the
// internal notes. Plain text only: bodies render as text (whitespace kept), never as HTML/markdown.
// The author can edit or delete a message for 5 minutes. Opening the case thread marks the other
// side's messages as read.

export type ThreadLabels = {
  title: string;
  description?: string;
  empty: string;
  placeholder: string;
};

export function CaseThread({
  caseId,
  messages,
  viewer,
  internal = false,
  labels,
}: {
  caseId: string;
  messages: CaseMessageView[];
  /** Whose page this is: decides how authors are named. */
  viewer: "DENTIST" | "ADMIN";
  internal?: boolean;
  labels: ThreadLabels;
}) {
  const t = useTranslations("cases.messages");
  const format = useFormatter();
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [editing, setEditing] = useState<{ id: string; body: string } | null>(null);
  const [now, setNow] = useState(() => Date.now());

  // Re-evaluate the 5-minute edit window every 20 seconds.
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 20_000);
    return () => clearInterval(timer);
  }, []);

  const hasUnread = messages.some((m) => !m.mine && !m.readAt && m.authorRole !== viewer);
  useEffect(() => {
    if (!internal && hasUnread) void markMessagesReadAction({ caseId });
  }, [caseId, internal, hasUnread]);

  const errorText = (code: string) =>
    t.has(`errors.${code}` as "errors.generic")
      ? t(`errors.${code}` as "errors.generic")
      : t("errors.generic");

  async function send(e?: FormEvent) {
    e?.preventDefault();
    if (!body.trim() || sending) return;
    setSending(true);
    const result = await sendMessageAction({ caseId, body, internal }).catch(() => null);
    setSending(false);
    if (!result?.ok) {
      toast.error(errorText(result?.error ?? "generic"));
      return;
    }
    setBody("");
  }

  async function saveEdit() {
    if (!editing) return;
    const result = await editMessageAction({ messageId: editing.id, body: editing.body }).catch(
      () => null,
    );
    if (!result?.ok) toast.error(errorText(result?.error ?? "generic"));
    else setEditing(null);
  }

  async function remove(id: string) {
    const result = await deleteMessageAction({ messageId: id }).catch(() => null);
    if (!result?.ok) toast.error(errorText(result?.error ?? "generic"));
  }

  const authorName = (m: CaseMessageView) => {
    if (m.mine) return t("you");
    if (m.authorRole === "ADMIN")
      return viewer === "DENTIST" ? t("dentnord") : (m.authorName ?? t("dentnord"));
    return m.authorName ?? t("clinic");
  };

  return (
    <section
      aria-labelledby={`thread-${internal ? "internal" : "case"}`}
      data-thread={internal ? "internal" : "case"}
      className={cn(
        "flex flex-col gap-4 rounded-card border bg-surface p-5 sm:p-6",
        internal ? "border-[#e6d3a8] bg-[#fffaf0]" : "border-line",
      )}
    >
      <div className="flex flex-col gap-1">
        <h2
          id={`thread-${internal ? "internal" : "case"}`}
          className="flex items-center gap-2 font-medium text-ink"
        >
          {internal && <Lock aria-hidden className="size-4 text-[#a16a12]" />}
          {labels.title}
        </h2>
        {labels.description && <p className="text-sm text-ink-muted">{labels.description}</p>}
      </div>

      {messages.length === 0 ? (
        <p className="text-sm text-ink-muted">{labels.empty}</p>
      ) : (
        <ol className="flex flex-col gap-3">
          {messages.map((m) => {
            const editable =
              m.mine && now - new Date(m.createdAt).getTime() < MESSAGE_EDIT_WINDOW_MS;
            const unread = !m.mine && !m.readAt && m.authorRole !== viewer && !internal;
            return (
              <li
                key={m.id}
                data-message={m.id}
                className={cn(
                  "flex max-w-[52rem] flex-col gap-1.5 rounded-xl px-4 py-3",
                  m.mine ? "self-end bg-brand-ice" : "self-start bg-surface-2",
                  unread && "ring-2 ring-brand/40",
                )}
              >
                <div className="flex flex-wrap items-baseline gap-x-2 text-xs text-ink-muted">
                  <span className="font-medium text-ink">{authorName(m)}</span>
                  <time dateTime={m.createdAt}>
                    {format.dateTime(new Date(m.createdAt), {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </time>
                  {m.editedAt && <span>· {t("edited")}</span>}
                  {unread && <span className="font-medium text-brand">· {t("new")}</span>}
                </div>
                {editing?.id === m.id ? (
                  <div className="flex flex-col gap-2">
                    <textarea
                      value={editing.body}
                      onChange={(e) => setEditing({ id: m.id, body: e.target.value })}
                      maxLength={MESSAGE_MAX_LENGTH}
                      rows={3}
                      aria-label={t("editLabel")}
                      className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink"
                    />
                    <div className="flex gap-2 text-sm">
                      <button type="button" onClick={saveEdit} className="font-medium text-brand">
                        {t("save")}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditing(null)}
                        className="text-ink-muted"
                      >
                        {t("cancel")}
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm [overflow-wrap:anywhere] whitespace-pre-wrap text-ink">
                    {m.body}
                  </p>
                )}
                {editable && editing?.id !== m.id && (
                  <div className="flex gap-3 text-xs">
                    <button
                      type="button"
                      onClick={() => setEditing({ id: m.id, body: m.body })}
                      className="inline-flex items-center gap-1 text-ink-muted hover:text-ink"
                    >
                      <Pencil aria-hidden className="size-3" />
                      {t("edit")}
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(m.id)}
                      className="inline-flex items-center gap-1 text-ink-muted hover:text-destructive"
                    >
                      <Trash2 aria-hidden className="size-3" />
                      {t("delete")}
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}

      <form onSubmit={send} className="flex flex-col gap-2">
        <label className="sr-only" htmlFor={`compose-${internal ? "internal" : "case"}`}>
          {labels.placeholder}
        </label>
        <textarea
          id={`compose-${internal ? "internal" : "case"}`}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) void send();
          }}
          maxLength={MESSAGE_MAX_LENGTH}
          rows={3}
          placeholder={labels.placeholder}
          className="w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-[0.9375rem] text-ink placeholder:text-ink-muted/70 focus-visible:border-brand focus-visible:outline-none"
        />
        <div className="flex items-center justify-between gap-3 text-xs text-ink-muted">
          <span>{t("hint", { count: MESSAGE_MAX_LENGTH - body.length })}</span>
          <button
            type="submit"
            disabled={!body.trim() || sending}
            className="inline-flex h-9 items-center gap-2 rounded-full bg-brand px-4 text-sm font-medium text-white transition-colors hover:bg-brand-deep disabled:opacity-50"
          >
            <Send aria-hidden className="size-4" />
            {t("send")}
          </button>
        </div>
      </form>
    </section>
  );
}
