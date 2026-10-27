/**
 * Per-browser display preferences: language, text size and the sidebar.
 * Kept in a plain cookie (not localStorage) so the server renders the right layout on the first paint.
 * Nothing private: it's only how the screen looks.
 */
import { isLang, type Lang } from "@/lib/languages";

export type { Lang };
export type TextSize = 0 | 1 | 2; // normal, large, larger

export type UiPrefs = {
  lang: Lang;
  size: TextSize;
  collapsed: boolean;
  width: number;
};

export const UI_COOKIE = "cw_ui";
export const SIDEBAR_MIN = 216;
export const SIDEBAR_MAX = 360;
export const SIDEBAR_DEFAULT = 248;
export const SIDEBAR_RAIL = 84;
export const TEXT_ZOOM = [1, 1.125, 1.25] as const;

export const DEFAULT_PREFS: UiPrefs = { lang: "en", size: 0, collapsed: false, width: SIDEBAR_DEFAULT };

export function parseUiPrefs(raw: string | undefined): UiPrefs {
  if (!raw) return DEFAULT_PREFS;
  try {
    const p = JSON.parse(decodeURIComponent(raw));
    const width = Number(p.width);
    return {
      lang: isLang(p.lang) ? p.lang : "en",
      size: p.size === 1 || p.size === 2 ? p.size : 0,
      collapsed: p.collapsed === true,
      width: Number.isFinite(width) ? Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, Math.round(width))) : SIDEBAR_DEFAULT,
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function writeUiPrefs(prefs: UiPrefs) {
  const value = encodeURIComponent(JSON.stringify(prefs));
  document.cookie = `${UI_COOKIE}=${value}; Path=/; Max-Age=${60 * 60 * 24 * 365}; SameSite=Lax`;
}
