/**
 * Nightly job (cron): group homes into mohallas and recompute monthly totals per mohalla, city, state and India.
 *   npm run areas
 */
import { runAreaJob } from "@/server/services/mohalla.service";
import { db } from "@/server/db";

runAreaJob()
  .then((r) => console.log(`[areas] ${r.areas} area totals for ${r.months.join(", ")}`))
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
