"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { SETTINGS_TABS, type SettingsTab } from "./tabs";

/** Tabs for /admin/settings. The tab is kept in `?tab=` so checklist links open the right one. */
export function SettingsTabs({
  defaultTab,
  panels,
}: {
  defaultTab: SettingsTab;
  panels: Record<SettingsTab, ReactNode>;
}) {
  const t = useTranslations("admin.settings.tabs");
  return (
    <Tabs
      defaultValue={defaultTab}
      onValueChange={(tab) => window.history.replaceState(null, "", `?tab=${tab}`)}
    >
      <TabsList className="w-full justify-start overflow-x-auto">
        {SETTINGS_TABS.map((tab) => (
          <TabsTrigger key={tab} value={tab}>
            {t(tab)}
          </TabsTrigger>
        ))}
      </TabsList>
      {SETTINGS_TABS.map((tab) => (
        // forceMount keeps every form mounted, so unsaved input survives switching tabs.
        <TabsContent key={tab} value={tab} forceMount className="pt-4 data-[state=inactive]:hidden">
          {panels[tab]}
        </TabsContent>
      ))}
    </Tabs>
  );
}
