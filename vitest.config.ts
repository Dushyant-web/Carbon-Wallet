import { defineConfig } from "vitest/config";
import os from "os";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    fileParallelism: false,
    globalSetup: ["./tests/setup/global.ts"],
    env: {
      // Isolated test database (rebuilt each run); never the developer's dev.db.
      DATABASE_URL: "file:./test.db",
      // Legacy header identity for the phase 0-9 suites. Never set this in a real run.
      DEMO_AUTH: "1",
      ADMIN_INVITE_CODE: "test-invite-code",
      // Point the passbook's engine lookup at a closed port so tests never depend on a running engine.
      PY_API_URL: "http://127.0.0.1:9",
      // Encrypted bill storage goes to a throwaway folder with a fixed test key.
      STORAGE_DIR: path.join(os.tmpdir(), "cw-test-storage"),
      STORAGE_KEY: Buffer.alloc(32, 7).toString("base64"),
      ENGINE_API_KEY: "test-engine-key",
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
