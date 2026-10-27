import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  {
    ignores: [
      ".next/**",
      ".next-prod/**",
      ".next-verify/**",
      "next-env.d.ts",
      "node_modules/**",
      "dist/**",
      "coverage/**",
      "prisma/migrations/**",
      "prisma/postgres/**", // generated schema, migrations and copy client
      ".tmp/**",
      "backend/.venv/**",
    ],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    settings: {
      next: {
        rootDir: ["./"],
      },
    },
    rules: {
      "@next/next/no-html-link-for-pages": "off",
    },
  },
];

export default eslintConfig;
