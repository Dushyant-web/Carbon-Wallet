/**
 * Erases accounts and households whose 30 days are up (privacy.service.ts). Run daily (cron/launchd):
 *   npm run purge
 * Safe to run as often as you like. Needs the proof service running, so statement salts are destroyed too.
 */
import { purgeDue } from "@/server/services/privacy.service";

purgeDue()
  .then((out) => console.log(`${new Date().toISOString()} purge: ${out.users} accounts, ${out.households} households, ${out.statements} sealed statements erased`))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
