/**
 * Push reminders. Run once (from cron/launchd, e.g. every hour) or keep it running with --loop:
 *   npm run reminders            one pass
 *   npm run reminders -- --loop  a pass every hour
 * Safe to run as often as you like: each reminder is sent at most once per person and period.
 */
import { runReminders } from "@/server/services/reminders.service";
import { pushConfigured } from "@/server/services/notify.service";

async function pass() {
  const out = await runReminders();
  console.log(`${new Date().toISOString()} reminders: ${out.sent} sent, ${out.considered} due`);
}

async function main() {
  if (!pushConfigured()) console.warn("VAPID keys aren't set (npm run vapid), so nothing will be pushed; in-app reminders still work.");
  await pass();
  if (process.argv.includes("--loop")) setInterval(() => pass().catch((e) => console.error(e)), 60 * 60 * 1000);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
