/**
 * Writes ACCOUNTS.md: every demo login, grouped by household, read from the database.
 * Run: npm run accounts   (after npm run prisma:seed)
 *
 * Only seeded demo accounts are listed (they share one password set in prisma/seed/index.ts).
 * Accounts real people created through sign-up are deliberately left out: they are personal data, and only a
 * scrypt hash of their password exists anyway.
 */
import { writeFileSync } from "fs";
import path from "path";
import { db } from "../src/server/db";

const DEMO_PASSWORD = "CarbonDemo#2026";
const ADMIN_PASSWORD = "AdminDemo#2026";
const ADMIN_INVITE = process.env.ADMIN_INVITE_CODE ?? "(see ADMIN_INVITE_CODE in .env)";
const ROLE_ORDER = ["OWNER", "MEMBER", "VIEWER"];
const SHOP_PASSWORD = "ShopDemo#2026";

async function main() {
  const households = await db.household.findMany({
    orderBy: [{ carbonId: "asc" }, { name: "asc" }],
    include: { memberships: { include: { user: true } } },
  });
  const admins = await db.user.findMany({ where: { platformRole: "ADMIN" }, orderBy: { email: "asc" } });
  const shops = await db.merchant.findMany({ include: { user: true }, orderBy: { createdAt: "asc" } });
  const demoShops = shops.filter((m) => m.user.email.endsWith(".example.com"));
  const sharma = households.find((h) => h.name === "Sharma Residence");

  const isSeeded = (email: string) => email.endsWith("@example.com");
  const lines: string[] = [];
  lines.push("# Demo accounts");
  lines.push("");
  lines.push("> **Demo data only.** These passwords are for the seeded demo database. Never reuse them in production;");
  lines.push("> reseeding (`npm run prisma:seed`) resets them. Regenerate this file with `npm run accounts`.");
  lines.push("");
  lines.push("| | |");
  lines.push("|---|---|");
  lines.push("| **Main demo login** | **`arjun.sharma@example.com`** / **`" + DEMO_PASSWORD + "`** (Sharma Residence, Owner) |");
  lines.push(`| Household members (all seeded users) | password **\`${DEMO_PASSWORD}\`** · log in at \`/login\` |`);
  lines.push(`| Platform admin | **\`admin@carbonwallet.in\`** / **\`${ADMIN_PASSWORD}\`** · log in at \`/admin/login\` |`);
  lines.push(`| New admin sign-up | \`/admin/signup\` with invite code **\`${ADMIN_INVITE}\`** |`);
  lines.push(`| Shop counter | **\`counter@demo-appliances.example.com\`** / **\`${SHOP_PASSWORD}\`** · log in at \`/merchant/login\` |`);
  if (sharma?.cardCode) {
    lines.push(`| Card code to try at the counter | \`${sharma.cardCode.replace(/^(CW1)(.{4})(.{4})(.{4})$/, "$1-$2-$3-$4")}\` (Sharma Residence; demo only, a real card's code is private) |`);
  }
  lines.push("");
  lines.push("Roles inside a household: **Owner** (everything) · **Family** (MEMBER: view, add electricity bills) · **View only** (VIEWER: read only). Appliances and vehicles bought at a registered shop are added by the merchant.");
  lines.push("");

  lines.push("## Platform admins");
  lines.push("");
  lines.push("| Name | Email | Password |");
  lines.push("|---|---|---|");
  for (const a of admins) {
    lines.push(`| ${a.name} | \`${a.email}\` | ${a.email === "admin@carbonwallet.in" ? `\`${ADMIN_PASSWORD}\`` : "_set at sign-up_"} |`);
  }
  lines.push("");

  lines.push("## Shops");
  lines.push("");
  lines.push("Shops scan a customer's Carbon Card and register what they bought onto that home. New shops sign up at `/merchant/signup`");
  lines.push("and wait for a platform admin to approve them at `/admin/merchants`.");
  lines.push("");
  lines.push("| Shop | Sells | Status | Email | Password |");
  lines.push("|---|---|---|---|---|");
  for (const m of demoShops) {
    lines.push(`| ${m.businessName}, ${m.city} | ${m.sells} | ${m.status} | \`${m.user.email}\` | \`${SHOP_PASSWORD}\` |`);
  }
  lines.push("");

  lines.push("## Households");
  for (const hh of households) {
    const members = [...hh.memberships]
      .filter((m) => m.status === "ACTIVE" && isSeeded(m.user.email))
      .sort((a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role));
    if (members.length === 0) continue;
    lines.push("");
    lines.push(`### ${hh.name} — ${hh.city}, ${hh.state}`);
    lines.push("");
    lines.push(
      `Carbon ID \`${hh.carbonId ?? "assigned on first visit"}\` · join code \`${hh.joinCode}\`${
        hh.publicToken ? ` · public record \`/p/${hh.publicToken}\`` : ""
      }`,
    );
    lines.push("");
    lines.push("| Name | Email | Role | Password |");
    lines.push("|---|---|---|---|");
    for (const m of members) {
      lines.push(`| ${m.user.name} | \`${m.user.email}\` | ${m.role} | \`${DEMO_PASSWORD}\` |`);
    }
  }
  lines.push("");
  lines.push("Accounts created through sign-up are not listed here: they belong to real people, and only a hash of their");
  lines.push("password is stored.");
  lines.push("");

  const out = path.resolve(__dirname, "../ACCOUNTS.md");
  writeFileSync(out, lines.join("\n"));
  console.log(`Wrote ${out} (${households.length} households, ${admins.length} admins, ${demoShops.length} shops)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
