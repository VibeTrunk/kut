"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { IconChevronDown, IconCoin, IconMenu } from "@/components/icons";
import { LogoutButton } from "@/components/logout-button";
import { buildMoreNavItems, primaryNavItems, type NavItem } from "./nav-items";

type AppNavProps = {
  displayName: string;
  isAdmin: boolean;
  balance: number;
  unreadCount: number;
};

const focusRing = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass";

function MoreMenu({ items, displayName }: { items: NavItem[]; displayName: string }) {
  const pathname = usePathname();
  return (
    <div
      className="absolute right-0 top-full mt-2 w-64 rounded-2xl border border-line bg-panel p-2 shadow-2xl shadow-board/60"
      role="menu"
    >
      <p className="px-3 pb-1 pt-2 text-xs font-black uppercase tracking-[0.14em] text-ink-faint">{displayName}</p>
      {items.map((item) => {
        const active = item.isActive(pathname);
        return (
          <Link
            className={`flex min-h-11 items-center justify-between gap-3 rounded-lg px-3 text-sm font-bold ${focusRing} ${
              active ? "bg-brass/10 text-brass" : item.adminOnly ? "text-brick hover:bg-panel-2" : "text-ink-dim hover:bg-panel-2"
            }`}
            href={item.href}
            key={item.href}
            role="menuitem"
          >
            <span className="flex items-center gap-2.5">
              <item.Icon className="h-4 w-4" />
              {item.label}
            </span>
            {!!item.badgeCount && (
              <span className="rounded-full bg-brass px-2 py-0.5 text-xs font-black text-ink-on-accent">{item.badgeCount}</span>
            )}
          </Link>
        );
      })}
      <div className="my-1.5 h-px bg-panel-2" />
      <LogoutButton variant="menu-item" />
    </div>
  );
}

export function AppNav({ displayName, isAdmin, balance, unreadCount }: AppNavProps) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const [lastPathname, setLastPathname] = useState(pathname);
  const desktopMenuRef = useRef<HTMLDivElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);

  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    setMoreOpen(false);
  }

  useEffect(() => {
    if (!moreOpen) return;

    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (desktopMenuRef.current?.contains(target)) return;
      if (mobileMenuRef.current?.contains(target)) return;
      setMoreOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setMoreOpen(false);
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [moreOpen]);

  const moreItems = buildMoreNavItems(unreadCount).filter((item) => !item.adminOnly || isAdmin);
  const moreHasUnread = moreItems.some((item) => (item.badgeCount ?? 0) > 0);
  const initials = displayName.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();

  return (
    <>
      {/* Desktop / tablet top bar */}
      <header className="sticky top-0 z-30 hidden border-b border-panel-2 bg-board/95 backdrop-blur sm:block">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-6">
          <Link className={`flex items-center gap-2 rounded-lg text-lg font-black tracking-tight text-brass ${focusRing}`} href="/">
            <span aria-hidden="true" className="clip-pennant h-3 w-3 shrink-0 bg-brass" />
            KUT
          </Link>
          <nav aria-label="Primary" className="flex flex-1 items-center gap-1">
            {primaryNavItems.map((item) => {
              const active = item.isActive(pathname);
              return (
                <Link
                  aria-current={active ? "page" : undefined}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-bold transition-colors ${focusRing} ${
                    active ? "bg-brass/10 text-brass" : "text-ink-dim hover:text-ink"
                  }`}
                  href={item.href}
                  key={item.href}
                >
                  <item.Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 rounded-full border border-line bg-panel px-3 py-1.5 text-sm font-black tabular-nums text-brass">
              <IconCoin className="h-3.5 w-3.5" />
              {balance.toLocaleString()}
            </span>
            <div className="relative" ref={desktopMenuRef}>
              <button
                aria-expanded={moreOpen}
                aria-haspopup="menu"
                className={`flex min-h-10 items-center gap-1.5 rounded-lg px-3 text-sm font-bold text-ink-dim hover:text-ink ${focusRing}`}
                onClick={() => setMoreOpen((open) => !open)}
                type="button"
              >
                More
                {moreHasUnread && <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-brass" />}
                <IconChevronDown className="h-4 w-4" />
              </button>
              {moreOpen && <MoreMenu displayName={displayName} items={moreItems} />}
            </div>
            <span aria-hidden="true" className="flex h-9 w-9 items-center justify-center rounded-full bg-brass text-xs font-black text-ink-on-accent">
              {initials || "KUT"}
            </span>
          </div>
        </div>
      </header>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-panel-2 bg-board/95 px-4 backdrop-blur sm:hidden">
        <Link className={`flex items-center gap-1.5 rounded-lg text-base font-black text-brass ${focusRing}`} href="/">
          <span aria-hidden="true" className="clip-pennant h-2.5 w-2.5 shrink-0 bg-brass" />
          KUT
        </Link>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 rounded-full border border-line bg-panel px-2.5 py-1 text-xs font-black tabular-nums text-brass">
            <IconCoin className="h-3 w-3" />
            {balance.toLocaleString()}
          </span>
          <div className="relative" ref={mobileMenuRef}>
            <button
              aria-expanded={moreOpen}
              aria-haspopup="menu"
              aria-label="Open menu"
              className={`relative flex h-9 w-9 items-center justify-center rounded-full border border-line text-ink-dim ${focusRing}`}
              onClick={() => setMoreOpen((open) => !open)}
              type="button"
            >
              <IconMenu className="h-4 w-4" />
              {moreHasUnread && (
                <span aria-hidden="true" className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-board bg-brass" />
              )}
            </button>
            {moreOpen && <MoreMenu displayName={displayName} items={moreItems} />}
          </div>
        </div>
      </header>

      {/* Mobile bottom tab bar */}
      <nav aria-label="Primary" className="fixed inset-x-0 bottom-0 z-30 flex border-t border-panel-2 bg-board/95 backdrop-blur sm:hidden">
        {primaryNavItems.map((item) => {
          const active = item.isActive(pathname);
          return (
            <Link
              aria-current={active ? "page" : undefined}
              className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-bold ${focusRing} ${active ? "text-brass" : "text-ink-faint"}`}
              href={item.href}
              key={item.href}
            >
              <item.Icon className="h-5 w-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
