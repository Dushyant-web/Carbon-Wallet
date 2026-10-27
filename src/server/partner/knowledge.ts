/*
 * What Partner knows about Carbon Wallet: how each part works and the rules for each kind of account.
 * The same sections feed the system prompt (with Claude) and the offline answer finder (without it), so keep
 * them short, plain and true to the code.
 */

export type PartnerRole = "guest" | "household" | "merchant" | "admin";

export type Section = { id: string; title: string; roles: PartnerRole[]; keywords: string[]; text: string };

const ALL: PartnerRole[] = ["guest", "household", "merchant", "admin"];
const HOME: PartnerRole[] = ["household", "admin"];

export const SECTIONS: Section[] = [
  {
    id: "about",
    title: "What Carbon Wallet is",
    roles: ALL,
    keywords: ["what", "about", "carbon wallet", "government", "sarkari", "who", "free"],
    text: `Carbon Wallet is a free citizen service that keeps a carbon account for every home in India: how much CO₂ the home's electricity, fuel and big appliances cause each month. It is built from the bills people already pay, so nobody has to fill long forms. It is a citizen service, not a government website: it explains and points to government schemes but does not grant them.`,
  },
  {
    id: "gases",
    title: "Which greenhouse gases we count",
    roles: ALL,
    keywords: ["gas", "gases", "methane", "ch4", "n2o", "nitrous", "hfc", "refrigerant", "co2e", "greenhouse", "ghg", "carbon dioxide"],
    text: `All the greenhouse gases a home causes, not only carbon dioxide, each counted as CO₂e with its 100-year warming factor from the IPCC's Sixth Assessment Report: CO₂ (×1) from burning coal for electricity, petrol, diesel, CNG and LPG; methane, CH₄ (×29.8, or ×27 from rotting waste) from landfills and engines; nitrous oxide, N₂O (×273) from catalytic converters and coal burning; and HFCs, the AC refrigerant gases (R-32 ×771, R-410A ×2,256, R-22 ×1,960) when gas leaks and is refilled. Food and travel factors are published as CO₂e already. Every "kg" on the site is kg CO₂e. The home page shows this month's split by gas.`,
  },
  {
    id: "colours",
    title: "Green, amber and red: your allowance",
    roles: ALL,
    keywords: ["green", "amber", "red", "status", "colour", "color", "allowance", "limit", "average", "score"],
    text: `Each home gets a monthly allowance: the measured average CO₂ per person in its state, times the number of people in the home. When at least 20 homes in a state report, we use their real average; until then we use an official estimate and say so. Green means the home used up to 90% of its allowance, amber up to 110%, and red more than that. Red is not a fine or a punishment, just a sign that there is room to save.`,
  },
  {
    id: "carbon-card",
    title: "Carbon Card, Carbon ID and the card code",
    roles: ALL,
    keywords: ["card", "carbon id", "code", "barcode", "nfc", "chip", "qr", "share"],
    text: `Every home has a Carbon ID (like CW-UP-26-0001-7) and a Carbon Card with a barcode and an NFC chip. Show the card at a shop when you buy an AC, fridge, scooter or car, and the shop registers the item to your home. The card code inside the barcode is private: don't post photos of the card online. The share link (/p/…) shows only public numbers and cannot be used by shops to register items.`,
  },
  {
    id: "roles",
    title: "Who can do what in a home",
    roles: [...HOME, "guest"],
    keywords: ["owner", "family", "member", "view", "viewer", "permission", "invite", "role", "can't", "cannot"],
    text: `A home has three kinds of people. The Owner can do everything: change usage hours, ask to remove items, delete bills, invite people. Family can look at everything and add electricity bills, nothing else. View-only can only look. Ask the owner if you need something changed.`,
  },
  {
    id: "bills",
    title: "Adding an electricity bill",
    roles: [...HOME, "guest"],
    keywords: ["bill", "bijli", "electricity", "units", "kwh", "upload", "photo", "pdf", "add bill", "meter"],
    text: `Press "Add bill" at the top, then take a photo of the bill or upload its PDF. The app reads the units (kWh), dates and amount; you check them and save. If the reading is unsure you can let AI read it (you are asked first). A bill's units are shared across the months it covers. Owners and family can add bills; only the owner can delete one. Each kWh from the grid counts about 0.675 kg CO₂e (CEA, India's grid average).`,
  },
  {
    id: "fuel",
    title: "Adding fuel for a car or scooter",
    roles: [...HOME, "guest"],
    keywords: ["fuel", "petrol", "diesel", "cng", "pump", "fill", "litre", "vehicle", "car", "scooter"],
    text: `Open Card & items, then "Add fuel from a pump photo". Snap the pump display (Amount, Volume, Rate) or the receipt; check the numbers and save. Each litre of petrol makes 2.31 kg CO₂e, diesel 2.68 kg, and each kg of CNG 2.75 kg. The owner adds fuel.`,
  },
  {
    id: "items",
    title: "Items: who adds them and how to remove one",
    roles: ALL,
    keywords: ["item", "appliance", "ac", "fridge", "remove", "delete", "broken", "sold", "scrap", "not ours", "mistake", "never had"],
    text: `Big items (ACs, fridges, geysers, vehicles) are added by the shop when you show your Carbon Card at purchase, so the numbers are honest. You cannot add or delete them yourself; the owner can change how many hours a day they run. To remove an item the owner asks from Card & items → "Ask to remove": choose what happened. Broken, sold, given away or scrapped needs at least one photo and two lines. "We never had it" and "Shop added it by mistake" need no photo, and the note is optional. Our team decides, usually within 2 days; the item keeps counting until then, and you get a notification either way. Photos are stripped of location and deleted 90 days after the decision.`,
  },
  {
    id: "mohalla",
    title: "My mohalla",
    roles: [...HOME, "guest"],
    keywords: ["mohalla", "neighbour", "area", "locality", "map", "compare", "news", "samachar", "weather", "aqi", "air"],
    text: `Homes are grouped into mohallas by locality (for example Knowledge Park II, Greater Noida). A mohalla's numbers appear only when it has at least 20 homes, so no single family can be picked out. The Mohalla Samachar page reads like a local newspaper: today's weather and heat, air quality, how many homes are green, and tips. Set your home's location once from the mohalla page.`,
  },
  {
    id: "schemes",
    title: "Government schemes",
    roles: ALL,
    keywords: ["scheme", "yojana", "subsidy", "surya ghar", "solar", "ujjwala", "e-drive", "scrappage", "eesl", "benefit", "government"],
    text: `The Govt schemes page lists schemes your home may qualify for, worked out from your bills and items: PM Surya Ghar (rooftop solar), PM E-DRIVE (electric two-wheelers), the vehicle scrappage benefit, EESL efficient fans and cooktops, the Tata Power-DDL AC replacement offer and PM Ujjwala. Carbon Wallet explains each one and links to the official site; you apply there yourself. Shops can also explain a scheme at the counter. Rooftop solar helpline: 15555. National Consumer Helpline: 1915.`,
  },
  {
    id: "privacy",
    title: "Privacy: what others can see",
    roles: ALL,
    keywords: ["privacy", "private", "data", "share", "see", "shop see", "delete account", "erase"],
    text: `A shop that scans your card sees only your Carbon ID, home name and city: never your members, emails, bills or totals. Your mohalla shows only totals of 20 or more homes. Photos have their location and camera details removed. The owner can ask for the home and its data to be deleted from Settings.`,
  },
  {
    id: "open-data",
    title: "Open data and sealed records",
    roles: ALL,
    keywords: ["open data", "seal", "blockchain", "verify", "proof", "record", "csv", "tamper"],
    text: `Every day the platform seals that day's shop registrations, removal decisions and area totals: their fingerprints are written to a public blockchain, so nobody (including us) can quietly change them later. The Open data page shows area totals anyone can download as CSV and lets anyone check a record.`,
  },
  {
    id: "notifications",
    title: "Notifications",
    roles: ALL,
    keywords: ["notification", "bell", "alert", "reminder", "push"],
    text: `The bell at the top shows your notifications: shop registrations, removal decisions, scheme matches, complaint replies, bill reminders and heat alerts. To get them on your phone or computer even when the site is closed, turn on notifications in Settings.`,
  },
  {
    id: "complaints",
    title: "Help and complaints",
    roles: ALL,
    keywords: ["complaint", "grievance", "help", "problem", "ticket", "support", "issue"],
    text: `Open "Help & complaints" (shops: Help in the top menu). Pick the topic, write what happened and send. You get a ticket number like CW-GRV-2026-000123 and a notification when our team replies.`,
  },
  {
    id: "language",
    title: "Languages and text size",
    roles: ALL,
    keywords: ["language", "bhasha", "hindi", "tamil", "bengali", "translate", "text size", "bigger", "font"],
    text: `Choose your language from the dropdown at the very top: English, Hindi and all 22 languages of the Eighth Schedule. English and Hindi are written by people; the others are translated by AI, so a word may sometimes be off. A, A+ and A++ next to it make the text bigger.`,
  },
  {
    id: "shop-signup",
    title: "Shops: signing up and approval",
    roles: ["merchant", "admin", "guest"],
    keywords: ["shop", "merchant", "dealer", "sign up", "register shop", "approval", "approve", "suspend", "gstin"],
    text: `A shop signs up at /merchant/signup with its name, city, state, what it sells (appliances, vehicles or both) and GSTIN if it has one. A Carbon Wallet admin approves the shop before it can scan cards. A shop whose items owners often reject as "not ours" can be suspended.`,
  },
  {
    id: "shop-counter",
    title: "Shops: registering a sale at the counter",
    roles: ["merchant", "admin"],
    keywords: ["counter", "scan", "register", "sale", "ticket", "customer", "barcode", "nfc"],
    text: `At Counter, scan the customer's Carbon Card (barcode gun, camera, phone NFC tap, or type the code). Only the private card code or a paired chip works, never the public share link. You see the customer's Carbon ID, home name and city to confirm it's them. A scan gives a 15-minute ticket for up to 10 items; pick each product from your catalogue (or type its details) and register it. The owner gets a notification and can reject an item that isn't theirs. Shops can only register the kinds of items they are approved to sell.`,
  },
  {
    id: "shop-catalogue",
    title: "Shops: the product catalogue",
    roles: ["merchant", "admin"],
    keywords: ["catalogue", "catalog", "csv", "product", "import", "upload", "photo", "image", "price", "hide", "delete", "template"],
    text: `Catalogue → download the template (it only has rows your shop can sell), fill one row per product (sku, brand, model, price, stars, rated power, annual kWh…) and upload it with product photos (JPEG or PNG, under 2 MB, file names matching the image column). Uploading the same SKU again updates it. Each product card has "Add photo" to add or change one photo. "Hide" keeps a product but takes it off the counter; the bin icon deletes it for good (past sales keep their record). Homes see the product photo and price on their item.`,
  },
  {
    id: "admin-work",
    title: "Admins: daily work",
    roles: ["admin"],
    keywords: ["admin", "approve", "removal", "queue", "grievance", "pending", "decide", "schemes", "map", "households"],
    text: `Admins approve or suspend shops (Shops), decide removal requests (Removals: a rejection needs a one-line reason to the owner), reply to complaints (Complaints), edit the scheme list (Schemes), watch the carbon map of India down to each mohalla (Carbon map), and look up households. Partner can read the database for admins (read only) but never changes anything: decisions are made with the buttons, so every change has an audit record.`,
  },
];

export function sectionsFor(role: PartnerRole) {
  return SECTIONS.filter((s) => s.roles.includes(role));
}

/** The whole rule book for a role, for the system prompt. */
export function knowledgeText(role: PartnerRole) {
  return sectionsFor(role)
    .map((s) => `## ${s.title}\n${s.text}`)
    .join("\n\n");
}

/** Without Claude: the best-matching sections for a question, by keyword overlap. */
export function offlineAnswer(role: PartnerRole, question: string): { title: string; text: string }[] {
  const q = question.toLowerCase();
  const words = q.split(/[^a-z0-9ऀ-ॿ]+/).filter((w) => w.length > 2);
  return sectionsFor(role)
    .map((s) => {
      let score = 0;
      for (const k of s.keywords) if (q.includes(k)) score += k.includes(" ") ? 3 : 2;
      for (const w of words) if (s.title.toLowerCase().includes(w)) score += 1;
      return { s, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 2)
    .map(({ s }) => ({ title: s.title, text: s.text }));
}
