import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { ContactInbox } from "@/components/admin/contact-inbox";
import { ShellPageHeader } from "@/components/shared/app-shell/app-shell";
import { PageSkeleton } from "@/components/shared/app-shell/page-skeleton";
import { listContactMessages } from "@/server/queries/admin-messages";

export const metadata: Metadata = { title: "Messages" };

// Messages sent through the public contact form (/contact).
export default async function AdminMessagesPage() {
  const t = await getTranslations({ locale: "en", namespace: "admin.inbox" });
  return (
    <>
      <ShellPageHeader title={t("title")} intro={t("intro")} />
      <Suspense fallback={<PageSkeleton />}>
        <Inbox />
      </Suspense>
    </>
  );
}

async function Inbox() {
  // listContactMessages re-checks the admin session.
  return <ContactInbox messages={await listContactMessages()} />;
}
