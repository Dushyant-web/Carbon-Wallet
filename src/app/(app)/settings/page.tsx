"use client";

import React from "react";
import { PageIntro } from "@/components/ui/PageIntro";
import { ReminderSettings } from "@/components/settings/ReminderSettings";
import { PrivacySettings } from "@/components/settings/PrivacySettings";

export default function SettingsPage() {
  return (
    <div className="flex max-w-3xl flex-col gap-8">
      <PageIntro section="Account" title="Settings & privacy" what="Reminders, and what happens to your data." />
      <ReminderSettings />
      <PrivacySettings />
    </div>
  );
}
