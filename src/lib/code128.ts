/**
 * Code 128 (set B) barcode encoder: text → bar/space module widths → SVG rectangles.
 * Pure and deterministic, so it renders identically on the server and in the browser.
 *
 * Each symbol is 6 alternating widths (bar, space, …) summing to 11 modules; the stop symbol has 7
 * (13 modules). Checksum = (104 + Σ value × position) mod 103.
 */

// Patterns for values 0–106 (103 = Start A, 104 = Start B, 105 = Start C, 106 = Stop)
const PATTERNS = [
  "212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312", "132212", "221213",
  "221312", "231212", "112232", "122132", "122231", "113222", "123122", "123221", "223211", "221132",
  "221231", "213212", "223112", "312131", "311222", "321122", "321221", "312212", "322112", "322211",
  "212123", "212321", "232121", "111323", "131123", "131321", "112313", "132113", "132311", "211313",
  "231113", "231311", "112133", "112331", "132131", "113123", "113321", "133121", "313121", "211331",
  "231131", "213113", "213311", "213131", "311123", "311321", "331121", "312113", "312311", "332111",
  "314111", "221411", "431111", "111224", "111422", "121124", "121421", "141122", "141221", "112214",
  "112412", "122114", "122411", "142112", "142211", "241211", "221114", "413111", "241112", "134111",
  "111242", "121142", "121241", "114212", "124112", "124211", "411212", "421112", "421211", "212141",
  "214121", "412121", "111143", "111341", "131141", "114113", "114311", "411113", "411311", "113141",
  "114131", "311141", "411131", "211412", "211214", "211232", "2331112",
];
const START_B = 104;
const STOP = 106;
export const QUIET_ZONE = 10; // modules of white on each side

export function code128Values(text: string): number[] {
  const values = [START_B];
  for (const ch of text) {
    const code = ch.charCodeAt(0);
    if (code < 32 || code > 126) throw new Error(`Code 128-B can't encode ${JSON.stringify(ch)}`);
    values.push(code - 32);
  }
  const check = values.reduce((sum, v, i) => sum + v * (i === 0 ? 1 : i), 0) % 103;
  return [...values, check, STOP];
}

/** Module widths, alternating bar/space, starting with a bar (quiet zones not included). */
export function code128Widths(text: string): number[] {
  return code128Values(text).flatMap((v) => PATTERNS[v].split("").map(Number));
}

export function code128Modules(text: string): number {
  return code128Widths(text).reduce((a, b) => a + b, 0);
}

/** SVG path for the bars, fitted into width × height at (x, y), including quiet zones. */
export function code128Path(text: string, x: number, y: number, width: number, height: number): string {
  const widths = code128Widths(text);
  const total = widths.reduce((a, b) => a + b, 0) + 2 * QUIET_ZONE;
  const m = width / total;
  let cursor = x + QUIET_ZONE * m;
  let d = "";
  widths.forEach((w, i) => {
    if (i % 2 === 0) d += `M${cursor.toFixed(3)} ${y.toFixed(3)}h${(w * m).toFixed(3)}v${height.toFixed(3)}h-${(w * m).toFixed(3)}z`;
    cursor += w * m;
  });
  return d;
}

export const PATTERN_TABLE = PATTERNS; // exported for tests
