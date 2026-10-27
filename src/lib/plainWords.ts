import type { Lang } from "@/lib/languages";

/** Category names in everyday words, English and Hindi. */
const CATEGORY: [RegExp, string, string][] = [
  [/refrigerant|ac gas/i, "AC gas leak", "एसी गैस"],
  [/electric|energy|cooling|ac\b/i, "Electricity", "बिजली"],
  [/transport|vehicle|fuel|car/i, "Vehicles", "गाड़ी"],
  [/cook|lpg|gas/i, "Cooking gas", "खाना पकाने की गैस"],
  [/flight|travel/i, "Travel", "सफ़र"],
  [/food|diet/i, "Food", "खाना"],
  [/waste/i, "Waste", "कूड़ा"],
];

export function categoryWords(category: string, lang: Lang) {
  const hit = CATEGORY.find(([re]) => re.test(category));
  if (!hit) return category;
  return lang === "hi" ? hit[2] : hit[1];
}

const MONTHS_HI = ["जनवरी", "फ़रवरी", "मार्च", "अप्रैल", "मई", "जून", "जुलाई", "अगस्त", "सितंबर", "अक्टूबर", "नवंबर", "दिसंबर"];
const MONTHS_EN = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** "2026-03" → "March 2026" / "मार्च 2026" */
export function monthWords(month: string, lang: Lang, withYear = true) {
  const [y, m] = month.split("-").map(Number);
  const name = (lang === "hi" ? MONTHS_HI : MONTHS_EN)[m - 1] ?? month;
  return withYear ? `${name} ${y}` : name;
}

export function shortMonth(month: string, lang: Lang) {
  const m = Number(month.slice(5)) - 1;
  return lang === "hi" ? MONTHS_HI[m] : MONTHS_EN[m]?.slice(0, 3);
}

export const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
