"use client";

import type { Lang } from "@/lib/languages";
import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, LayoutGrid, PanelLeftClose, PanelLeftOpen, ShieldCheck } from "lucide-react";
import { MAIN_NAV, MORE_NAV, SETTINGS_NAV, isItemActive, navLabel, type NavItem } from "@/lib/nav";
import { SIDEBAR_DEFAULT, SIDEBAR_MAX, SIDEBAR_MIN, SIDEBAR_RAIL } from "@/lib/uiPrefs";
import { useUiPrefs } from "@/components/providers/UiPrefsProvider";
import { usePermissions } from "@/hooks/usePermissions";

/**
 * Desktop sidebar: five big places first, the detailed pages folded under "More".
 * Drag its edge to resize, or fold it to an icon rail (button or Ctrl/⌘ + B). The choice is remembered.
 */
export function Sidebar({ isAdmin = false }: { isAdmin?: boolean }) {
  const pathname = usePathname();
  const { lang, t, collapsed, toggleCollapsed, width, setWidth } = useUiPrefs();
  const { isOwner } = usePermissions();
  const more = MORE_NAV.filter((i) => !i.ownerOnly || isOwner);
  const moreActive = more.some((i) => isItemActive(pathname, i));
  const [moreOpen, setMoreOpen] = useState(moreActive);
  const [dragWidth, setDragWidth] = useState<number | null>(null);
  const dragging = useRef(false);

  useEffect(() => {
    if (moreActive) setMoreOpen(true);
  }, [moreActive]);

  // Ctrl/⌘ + B folds the sidebar, except while typing
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName))) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        toggleCollapsed();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggleCollapsed]);

  const shown = collapsed ? SIDEBAR_RAIL : (dragWidth ?? width);
  const clamp = (w: number) => Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, Math.round(w)));

  function startDrag(e: React.PointerEvent<HTMLDivElement>) {
    if (collapsed) return;
    dragging.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    document.body.style.userSelect = "none";
  }
  function onDrag(e: React.PointerEvent<HTMLDivElement>) {
    if (dragging.current) setDragWidth(clamp(e.clientX));
  }
  function endDrag() {
    if (!dragging.current) return;
    dragging.current = false;
    document.body.style.userSelect = "";
    if (dragWidth !== null) setWidth(dragWidth);
    setDragWidth(null);
  }
  function onHandleKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowLeft") setWidth(clamp(width - 16));
    else if (e.key === "ArrowRight") setWidth(clamp(width + 16));
    else if (e.key === "Home") setWidth(SIDEBAR_MIN);
    else if (e.key === "End") setWidth(SIDEBAR_MAX);
    else return;
    e.preventDefault();
  }

  const other = (item: NavItem) => (lang === "hi" ? item.en : item.hi);

  return (
    <aside
      style={{ width: shown }}
      className={`sticky top-0 z-30 hidden h-screen shrink-0 flex-col border-r border-gov-deep bg-gov-navy text-white lg:flex print:hidden ${
        dragWidth === null ? "transition-[width] duration-200 ease-out" : ""
      }`}
      aria-label={t("Main menu", "मुख्य मेनू")}
    >
      {/* Wordmark + fold button */}
      <div className={`flex h-12 shrink-0 items-center border-b border-white/15 ${collapsed ? "justify-center" : "justify-between pl-5 pr-2"}`}>
        {!collapsed && (
          <span className="text-[12px] font-semibold uppercase tracking-[0.12em] text-white/70">
            {t("Menu", "मेनू")}
          </span>
        )}
        <button
          onClick={toggleCollapsed}
          className="flex h-9 w-9 items-center justify-center rounded-md text-white/75 hover:bg-white/10 hover:text-white"
          aria-label={collapsed ? t("Open menu", "मेनू खोलें") : t("Fold menu", "मेनू छोटा करें")}
          title={`${collapsed ? t("Open menu", "मेनू खोलें") : t("Fold menu", "मेनू छोटा करें")} (Ctrl/⌘ B)`}
          aria-expanded={!collapsed}
        >
          {collapsed ? <PanelLeftOpen className="h-[18px] w-[18px]" /> : <PanelLeftClose className="h-[18px] w-[18px]" />}
        </button>
      </div>

      <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overflow-x-hidden px-2 py-3">
        {MAIN_NAV.map((item) => (
          <MainLink key={item.href} item={item} active={isItemActive(pathname, item)} collapsed={collapsed} lang={lang} other={other(item)} />
        ))}

        <div className="my-2 border-t border-white/15" />

        {collapsed ? (
          <button
            onClick={() => {
              setMoreOpen(true);
              toggleCollapsed();
            }}
            className={`flex flex-col items-center gap-1 rounded-md px-1 py-2 text-[10.5px] leading-tight ${
              moreActive ? "bg-white/15 font-semibold text-white" : "text-white/75 hover:bg-white/10 hover:text-white"
            }`}
            title={t("More pages", "और पेज")}
          >
            <LayoutGrid className="h-5 w-5" />
            {t("More", "और")}
          </button>
        ) : (
          <>
            <button
              onClick={() => setMoreOpen((o) => !o)}
              aria-expanded={moreOpen}
              className="flex items-center justify-between rounded-md px-3 py-2 text-left text-[13px] font-semibold text-white/80 hover:bg-white/10 hover:text-white"
            >
              <span className="flex items-center gap-3">
                <LayoutGrid className="h-[18px] w-[18px]" />
                {t("More pages", "और पेज")}
              </span>
              <ChevronDown className={`h-4 w-4 transition-transform ${moreOpen ? "rotate-180" : ""}`} />
            </button>
            {moreOpen && (
              <div className="ml-3 flex flex-col border-l border-white/15 pl-2">
                {more.map((item) => {
                  const active = isItemActive(pathname, item);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      title={item.hint}
                      aria-current={active ? "page" : undefined}
                      className={`flex items-center gap-2.5 rounded-md px-2.5 py-[7px] text-[13px] ${
                        active ? "bg-white/15 font-semibold text-white" : "text-white/75 hover:bg-white/10 hover:text-white"
                      }`}
                    >
                      <Icon className={`h-4 w-4 shrink-0 ${active ? "text-gov-saffron" : ""}`} />
                      <span className="truncate">{navLabel(item, lang)}</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </>
        )}

        <div className="my-2 border-t border-white/15" />
        <MainLink item={SETTINGS_NAV} active={isItemActive(pathname, SETTINGS_NAV)} collapsed={collapsed} lang={lang} other={other(SETTINGS_NAV)} small />
        {isAdmin && (
          <Link
            href="/admin"
            title="Admin panel"
            className={`mt-1 flex items-center gap-3 rounded-md border border-white/40 px-3 py-2 text-[12px] font-semibold uppercase tracking-[0.06em] text-white hover:bg-white hover:text-gov-navy ${
              collapsed ? "justify-center px-0" : ""
            }`}
          >
            <ShieldCheck className="h-4 w-4 shrink-0" />
            {!collapsed && "Admin panel"}
          </Link>
        )}
      </nav>

      {/* Drag to resize; arrow keys work too */}
      {!collapsed && (
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label={t("Resize menu", "मेनू का आकार बदलें")}
          aria-valuemin={SIDEBAR_MIN}
          aria-valuemax={SIDEBAR_MAX}
          aria-valuenow={shown}
          tabIndex={0}
          onPointerDown={startDrag}
          onPointerMove={onDrag}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onDoubleClick={() => setWidth(SIDEBAR_DEFAULT)}
          onKeyDown={onHandleKey}
          title={t("Drag to resize · double-click to reset", "खींचकर आकार बदलें")}
          className="group absolute -right-1 top-0 z-10 h-full w-2 cursor-col-resize focus-visible:outline-none"
        >
          <span className="absolute left-1/2 top-0 h-full w-[2px] -translate-x-1/2 bg-transparent transition-colors group-hover:bg-gov-saffron/70 group-focus-visible:bg-gov-saffron group-active:bg-gov-saffron" />
        </div>
      )}
    </aside>
  );
}

function MainLink({
  item,
  active,
  collapsed,
  lang,
  other,
  small = false,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
  lang: Lang;
  other: string;
  small?: boolean;
}) {
  const Icon = item.icon;
  if (collapsed) {
    return (
      <Link
        href={item.href}
        title={`${navLabel(item, lang)} · ${item.hint}`}
        aria-current={active ? "page" : undefined}
        className={`flex flex-col items-center gap-1 rounded-md px-1 py-2 text-center text-[10.5px] leading-tight ${
          active ? "bg-white/15 font-semibold text-white shadow-[inset_0_-3px_0_0_#F28C28]" : "text-white/75 hover:bg-white/10 hover:text-white"
        }`}
      >
        <Icon className={`h-5 w-5 ${active ? "text-gov-saffron" : ""}`} />
        <span className="line-clamp-2">{navLabel(item, lang)}</span>
      </Link>
    );
  }
  return (
    <Link
      href={item.href}
      title={item.hint}
      aria-current={active ? "page" : undefined}
      className={`group flex items-center gap-3 rounded-md border-l-[3px] px-3 ${small ? "py-2" : "py-2.5"} ${
        active ? "border-gov-saffron bg-white/15 text-white" : "border-transparent text-white/80 hover:bg-white/10 hover:text-white"
      }`}
    >
      <span
        className={`flex shrink-0 items-center justify-center rounded-md ${small ? "h-7 w-7" : "h-9 w-9"} ${
          active ? "bg-gov-saffron text-white" : "bg-white/10 text-white/85 group-hover:text-white"
        }`}
      >
        <Icon className={small ? "h-4 w-4" : "h-[18px] w-[18px]"} />
      </span>
      <span className="flex min-w-0 flex-col leading-tight">
        <span className={`truncate ${small ? "text-[13px]" : "text-[14.5px]"} ${active ? "font-semibold" : "font-medium"}`}>{navLabel(item, lang)}</span>
        {!small && <span className="truncate text-[11.5px] text-white/55">{other}</span>}
      </span>
    </Link>
  );
}
