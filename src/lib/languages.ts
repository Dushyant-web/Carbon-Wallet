/**
 * English plus the 22 languages of the Eighth Schedule of the Constitution, each shown in its own script.
 * English and Hindi are written by hand; the rest are machine translated (see PageTranslator).
 */
export const LANGUAGES = [
  { code: "en", name: "English", native: "English" },
  { code: "hi", name: "Hindi", native: "हिन्दी" },
  { code: "as", name: "Assamese", native: "অসমীয়া" },
  { code: "bn", name: "Bengali", native: "বাংলা" },
  { code: "brx", name: "Bodo", native: "बड़ो" },
  { code: "doi", name: "Dogri", native: "डोगरी" },
  { code: "gu", name: "Gujarati", native: "ગુજરાતી" },
  { code: "kn", name: "Kannada", native: "ಕನ್ನಡ" },
  { code: "ks", name: "Kashmiri", native: "کٲشُر", rtl: true },
  { code: "kok", name: "Konkani", native: "कोंकणी" },
  { code: "mai", name: "Maithili", native: "मैथिली" },
  { code: "ml", name: "Malayalam", native: "മലയാളം" },
  { code: "mni", name: "Manipuri", native: "ꯃꯤꯇꯩꯂꯣꯟ", script: "Meitei Mayek" },
  { code: "mr", name: "Marathi", native: "मराठी" },
  { code: "ne", name: "Nepali", native: "नेपाली" },
  { code: "or", name: "Odia", native: "ଓଡ଼ିଆ" },
  { code: "pa", name: "Punjabi", native: "ਪੰਜਾਬੀ", script: "Gurmukhi" },
  { code: "sa", name: "Sanskrit", native: "संस्कृतम्" },
  { code: "sat", name: "Santali", native: "ᱥᱟᱱᱛᱟᱲᱤ", script: "Ol Chiki" },
  { code: "sd", name: "Sindhi", native: "سنڌي", rtl: true, script: "Perso-Arabic" },
  { code: "ta", name: "Tamil", native: "தமிழ்" },
  { code: "te", name: "Telugu", native: "తెలుగు" },
  { code: "ur", name: "Urdu", native: "اردو", rtl: true },
] as const satisfies readonly { code: string; name: string; native: string; rtl?: boolean; script?: string }[];

export type Lang = (typeof LANGUAGES)[number]["code"];
export type LanguageInfo = { code: Lang; name: string; native: string; rtl?: boolean; script?: string };

const BY_CODE = new Map<string, LanguageInfo>(LANGUAGES.map((l) => [l.code, l]));

export const isLang = (v: unknown): v is Lang => typeof v === "string" && BY_CODE.has(v);
export const languageInfo = (code: Lang): LanguageInfo => BY_CODE.get(code)!;
/** Languages not written by hand: their text comes from the translation service. */
export const isMachineTranslated = (code: Lang) => code !== "en" && code !== "hi";
/** For dates and numbers: "ta" → "ta-IN". */
export const localeFor = (code: Lang) => `${code}-IN`;
