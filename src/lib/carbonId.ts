/**
 * Carbon ID: a permanent, human-readable household identifier, in the spirit of DigiLocker / PAN.
 *
 *   CW-UP-26-0001-7
 *   │  │  │  │    └ check digit (Luhn over the alphanumeric body, letters A=10…Z=35)
 *   │  │  │  └ serial within state + year
 *   │  │  └ year of registration
 *   │  └ state code
 *   └ issuer
 *
 * Any single mistyped digit is caught by the check digit, as are most other typos.
 */

const STATE_CODES: Record<string, string> = {
  "andhra pradesh": "AP", "arunachal pradesh": "AR", assam: "AS", bihar: "BR", chhattisgarh: "CG",
  goa: "GA", gujarat: "GJ", haryana: "HR", "himachal pradesh": "HP", jharkhand: "JH", karnataka: "KA",
  kerala: "KL", "madhya pradesh": "MP", maharashtra: "MH", manipur: "MN", meghalaya: "ML", mizoram: "MZ",
  nagaland: "NL", odisha: "OD", punjab: "PB", rajasthan: "RJ", sikkim: "SK", "tamil nadu": "TN",
  telangana: "TS", tripura: "TR", "uttar pradesh": "UP", uttarakhand: "UK", "west bengal": "WB",
  delhi: "DL", "new delhi": "DL", "jammu and kashmir": "JK", ladakh: "LA", chandigarh: "CH", puducherry: "PY",
};

export function stateCode(state: string): string {
  const s = state.trim();
  if (/^[A-Za-z]{2}$/.test(s)) return s.toUpperCase();
  const known = STATE_CODES[s.toLowerCase()];
  if (known) return known;
  const letters = s.replace(/[^A-Za-z]/g, "").toUpperCase();
  return (letters + "XX").slice(0, 2);
}

function expand(body: string): string {
  return body
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, "")
    .split("")
    .map((c) => (c >= "0" && c <= "9" ? c : String(c.charCodeAt(0) - 55)))
    .join("");
}

export function checkDigit(body: string): number {
  const digits = expand(body);
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let d = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 0) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return (10 - (sum % 10)) % 10;
}

export function buildCarbonId(state: string, year: number, serial: number): string {
  const body = `CW-${stateCode(state)}-${String(year % 100).padStart(2, "0")}-${String(serial).padStart(4, "0")}`;
  return `${body}-${checkDigit(body)}`;
}

export function carbonIdPrefix(state: string, year: number): string {
  return `CW-${stateCode(state)}-${String(year % 100).padStart(2, "0")}-`;
}

export function isValidCarbonId(id: string): boolean {
  const m = /^(CW-[A-Z]{2}-\d{2}-\d{4})-(\d)$/.exec(id.trim().toUpperCase());
  return !!m && checkDigit(m[1]) === Number(m[2]);
}
