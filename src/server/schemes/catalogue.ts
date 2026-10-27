/**
 * Starting entries for the Sarkari Yojana catalogue, checked on 26 Oct 2026 against the sources below.
 * They are copied into the `schemes` table once (scheme.service.ts → ensureSchemes); after that admins keep
 * them current from /admin/schemes. We never pay anything ourselves: every entry points to the official portal.
 * Entries marked CHECK show a "confirm on the official site" note until an admin re-checks the terms.
 */
export type SchemeSeed = {
  slug: string;
  category: "SOLAR" | "EV" | "SCRAPPAGE" | "AC" | "EFFICIENT" | "LPG";
  name: string;
  nameHi: string;
  summary: string;
  summaryHi: string;
  benefit: string;
  benefitHi: string;
  whoQualifies: string;
  steps: string[];
  documents?: string[];
  link: string;
  helpline?: string;
  states?: string; // "ALL" or "DL,HR"
  discoms?: string;
  validUntil?: string;
  sourceUrl: string;
  status?: "ACTIVE" | "CHECK";
};

export const LAST_CHECKED = "2026-10-26";

export const SCHEME_CATALOGUE: SchemeSeed[] = [
  {
    slug: "pm-surya-ghar",
    category: "SOLAR",
    name: "PM Surya Ghar: Muft Bijli Yojana",
    nameHi: "पीएम सूर्य घर: मुफ़्त बिजली योजना",
    summary: "Government money to put solar panels on your roof, so your electricity bill drops.",
    summaryHi: "छत पर सोलर पैनल लगाने के लिए सरकारी पैसा, जिससे बिजली बिल कम हो।",
    benefit: "₹30,000 per kW for the first 2 kW and ₹18,000 for the 3rd kW: up to ₹78,000.",
    benefitHi: "पहले 2 किलोवाट पर ₹30,000 प्रति किलोवाट, तीसरे पर ₹18,000: कुल ₹78,000 तक।",
    whoQualifies:
      "You own the house, the electricity connection is in your name, and the roof has space for panels. One subsidy per house. Some states add their own top-up.",
    steps: [
      "Register on pmsuryaghar.gov.in with your electricity consumer number and mobile number.",
      "Choose a registered vendor on the portal and apply for the rooftop system.",
      "After installation, your electricity company inspects it and fits a net meter.",
      "Add your bank details on the portal. The subsidy is paid into your bank account.",
    ],
    documents: ["Latest electricity bill", "Aadhaar", "Bank passbook or cancelled cheque", "Proof the house is yours"],
    link: "https://pmsuryaghar.gov.in",
    helpline: "15555",
    sourceUrl: "https://m.thewire.in/article/ptiprnews/pm-surya-ghar-yojana-2026-how-to-get-rs-78000-solar-subsidy-cut-your-electricity-bill",
  },
  {
    slug: "pm-e-drive",
    category: "EV",
    name: "PM E-DRIVE (electric two-wheelers)",
    nameHi: "पीएम ई-ड्राइव (इलेक्ट्रिक दोपहिया)",
    summary: "A discount when you buy an approved electric scooter or motorbike.",
    summaryHi: "मान्य इलेक्ट्रिक स्कूटर या बाइक ख़रीदने पर छूट।",
    benefit: "₹2,500 per kWh of battery, up to ₹5,000 per vehicle, taken off the price at the dealer.",
    benefitHi: "बैटरी के हर kWh पर ₹2,500, एक गाड़ी पर ₹5,000 तक, डीलर बिल में ही घटा देता है।",
    whoQualifies:
      "Approved electric two-wheelers with an ex-factory price up to ₹1.5 lakh. Runs till 31 March 2028 or until the money runs out.",
    steps: [
      "Pick an approved electric scooter or bike at the dealer.",
      "The dealer makes an e-voucher in your name; confirm it with your Aadhaar as the dealer shows you.",
      "The discount is taken off your bill at the time of purchase.",
    ],
    documents: ["Aadhaar"],
    link: "https://heavyindustries.gov.in",
    validUntil: "2028-03-31",
    sourceUrl: "https://www.angelone.in/news/economy/government-reduces-electric-2-wheeler-subsidy-to-5-000-extends-pm-e-drive-to-march-2028",
  },
  {
    slug: "vehicle-scrappage",
    category: "SCRAPPAGE",
    name: "Vehicle scrappage benefit",
    nameHi: "पुरानी गाड़ी स्क्रैप करने का लाभ",
    summary: "Scrap an old vehicle at a registered centre and pay less tax on the new one.",
    summaryHi: "पुरानी गाड़ी मान्य केंद्र पर स्क्रैप करें और नई गाड़ी पर कम टैक्स दें।",
    benefit: "Up to 25% off road tax on a new private vehicle, no registration fee, and makers may give up to 5% off.",
    benefitHi: "नई निजी गाड़ी के रोड टैक्स में 25% तक छूट, रजिस्ट्रेशन फ़ीस माफ़, कंपनी से 5% तक छूट।",
    whoQualifies:
      "You scrapped a vehicle at a Registered Vehicle Scrapping Facility and have its Certificate of Deposit. The new vehicle must be of the same kind; each state sets its own rebate.",
    steps: [
      "Take the old vehicle to a Registered Vehicle Scrapping Facility.",
      "Collect the Certificate of Deposit.",
      "Show the certificate when you buy and register the new vehicle.",
    ],
    documents: ["Registration certificate (RC) of the old vehicle", "Certificate of Deposit", "Aadhaar"],
    link: "https://parivahan.gov.in",
    sourceUrl: "https://www.tribuneindia.com/news/chandigarh/scrap-save-25-road-tax-rebate-on-new-private-vehicles-in-chandigarh-498697",
  },
  {
    slug: "tpddl-ac-replacement",
    category: "AC",
    name: "AC replacement offer (Tata Power-DDL)",
    nameHi: "एसी बदलने का ऑफ़र (टाटा पावर-डीडीएल)",
    summary: "Swap an old AC for an efficient one at a discount, through your electricity company.",
    summaryHi: "बिजली कंपनी के ज़रिए पुराना एसी देकर छूट पर नया कुशल एसी लें।",
    benefit: "Up to 53% off the price of efficient ACs, and ₹4,000 for your old AC (April 2026 catalogue).",
    benefitHi: "कुशल एसी पर 53% तक छूट और पुराने एसी के ₹4,000 (अप्रैल 2026 सूची)।",
    whoQualifies: "Home (domestic) customers of Tata Power-DDL in North and North-West Delhi.",
    steps: [
      "Open the Tata Power-DDL website or app and find the AC replacement scheme.",
      "Pick a model from the catalogue and book it with your consumer number.",
      "The old AC is collected when the new one is installed.",
    ],
    documents: ["Latest electricity bill (consumer number)"],
    link: "https://www.tatapower-ddl.com",
    states: "DL",
    discoms: "TPDDL,Tata Power-DDL,Tata Power Delhi Distribution",
    sourceUrl: "https://www.tatapower-ddl.com/Editor_UploadedDocuments/Content/Product_Catalogue_-_20.04.2026.pdf",
  },
  {
    slug: "eesl-efficient-appliances",
    category: "EFFICIENT",
    name: "EESL efficient fans and induction cooktops",
    nameHi: "ईईएसएल बिजली-बचत पंखे और इंडक्शन चूल्हा",
    summary: "Energy-saving BLDC fans and induction cooktops at lower prices from the government's energy company.",
    summaryHi: "सरकारी ऊर्जा कंपनी से कम दाम पर बिजली-बचत पंखे और इंडक्शन चूल्हा।",
    benefit: "Efficient BLDC fans and induction cookstoves sold through EESL and its partners.",
    benefitHi: "ईईएसएल और उसके साझेदारों से कुशल पंखे और इंडक्शन चूल्हा।",
    whoQualifies: "All households, where EESL or its partners sell them.",
    steps: ["Check the EESL website or a partner outlet near you for current models and prices."],
    link: "https://eeslindia.org",
    sourceUrl: "https://planet2.outlookindia.com/news/eesl-to-distribute-1-cr-energy-efficient-fans-20-lakh-induction-cookstoves-news-416254",
    status: "CHECK",
  },
  {
    slug: "pm-ujjwala",
    category: "LPG",
    name: "Pradhan Mantri Ujjwala Yojana",
    nameHi: "प्रधानमंत्री उज्ज्वला योजना",
    summary: "A free LPG connection for poor households, so families can stop cooking on wood or coal.",
    summaryHi: "ग़रीब परिवारों के लिए मुफ़्त एलपीजी कनेक्शन, ताकि लकड़ी या कोयले पर खाना न पकाना पड़े।",
    benefit: "Free LPG connection; eligible families also get a subsidy on refills (check the current amount).",
    benefitHi: "मुफ़्त एलपीजी कनेक्शन; पात्र परिवारों को रिफ़िल पर सब्सिडी (मौजूदा राशि जाँचें)।",
    whoQualifies: "An adult woman from a poor household that has no LPG connection.",
    steps: [
      "Apply at the nearest LPG distributor or on pmuy.gov.in.",
      "Complete the KYC with Aadhaar and your ration card.",
    ],
    documents: ["Aadhaar", "Ration card", "Bank account details"],
    link: "https://pmuy.gov.in",
    sourceUrl: "https://pmuy.gov.in",
  },
];

/** Which schemes a shop brings up at the counter, by what it sells. */
export const COUNTER_SCHEMES: Record<"APPLIANCES" | "VEHICLES", string[]> = {
  APPLIANCES: ["tpddl-ac-replacement", "pm-surya-ghar", "eesl-efficient-appliances"],
  VEHICLES: ["pm-e-drive", "vehicle-scrappage"],
};
