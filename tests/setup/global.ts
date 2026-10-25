import { execSync } from "child_process";
import { rmSync } from "fs";
import path from "path";

// Tests run against their own SQLite file (prisma/test.db), rebuilt from migrations + seed on every run,
// so they never touch the developer's prisma/dev.db.
export default function setup() {
  const root = path.resolve(__dirname, "../..");
  const env = { ...process.env, DATABASE_URL: "file:./test.db" };
  rmSync(path.join(root, "prisma/test.db"), { force: true });
  rmSync(path.join(root, "prisma/test.db-journal"), { force: true });
  execSync("npx prisma migrate deploy", { cwd: root, env, stdio: "ignore" });
  execSync("npx tsx prisma/seed/index.ts", { cwd: root, env, stdio: "ignore" });
}
