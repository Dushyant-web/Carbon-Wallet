import { db } from "@/server/db";

/** A few starter notifications so the bell isn't empty in the demo (they're ordinary rows; mark them read freely). */
export async function seedNotifications() {
  const users = Object.fromEntries(
    (await db.user.findMany({ where: { email: { in: ["arjun.sharma@example.com", "admin@carbonwallet.in", "counter@demo-appliances.example.com"] } }, select: { id: true, email: true } })).map((u) => [u.email, u.id]),
  );
  const at = (h: number) => new Date(Date.now() - h * 3600_000);
  const rows = [
    ["arjun.sharma@example.com", "MOHALLA", "Today's Mohalla Samachar is out", "Knowledge Park II: green-home count, air quality and tomorrow's weather.", "/mohalla", 1],
    ["arjun.sharma@example.com", "SCHEME", "A scheme for you: PM Surya Ghar", "Your bills show a 2 kW rooftop system could cover much of your use, with up to ₹60,000 subsidy.", "/yojana", 5],
    ["arjun.sharma@example.com", "SHOP", "New item registered to your home", "Demo Appliances, Noida added a Coolwell 1.5 t 5-star inverter split AC. Not yours? Open Card & items.", "/assets", 26],
    ["arjun.sharma@example.com", "REMINDER", "Your electricity bill is due", "Add this month's bill so your numbers stay current.", "/bills/new", 50],
    ["admin@carbonwallet.in", "SYSTEM", "Daily seal ready to run", "Tonight's job will seal shop registrations, removal decisions and area totals on chain.", "/open-data", 2],
    ["counter@demo-appliances.example.com", "SYSTEM", "Your catalogue is live at the counter", "Pick products when you register a sale; homes see the photo and price.", "/merchant/catalogue", 3],
  ] as const;
  for (const [email, kind, title, body, url, hoursAgo] of rows) {
    const userId = users[email];
    if (!userId) continue;
    if (await db.notification.findFirst({ where: { userId, title } })) continue;
    await db.notification.create({ data: { userId, kind, title, body, url, createdAt: at(hoursAgo) } });
  }
}

if (process.argv[1]?.endsWith("notifications.ts")) {
  seedNotifications()
    .catch((e) => {
      console.error(e);
      process.exitCode = 1;
    })
    .finally(() => db.$disconnect());
}
