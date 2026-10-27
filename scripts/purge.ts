/**
 * Erases accounts and households whose 30 days are up (privacy.service.ts), and removal-request photos 90 days after
 * the decision (removal.service.ts). Run daily (cron/launchd):
 *   npm run purge
 * Safe to run as often as you like. Needs the proof service running, so statement salts are destroyed too.
 */
import { purgeDue } from "@/server/services/privacy.service";
import { purgeOldPhotos } from "@/server/services/removal.service";

Promise.all([purgeDue(), purgeOldPhotos()])
  .then(([out, photos]) =>
    console.log(`${new Date().toISOString()} purge: ${out.users} accounts, ${out.households} households, ${out.statements} sealed statements, ${photos} removal photos erased`),
  )
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
