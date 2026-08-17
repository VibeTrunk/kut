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

const focusRing = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400";

function MoreMenu({ items, displayName }: { items: NavItem[]; displayName: string }) {
  const pathname = usePathname();
  return (
    <div
      className="absolute right-0 top-full mt-2 w-64 rounded-2xl border border-slate-700 bg-slate-900 p-2 shadow-2xl shadow-slate-950/60"
      role="menu"
    >
      <p className="px-3 pb-1 pt-2 text-xs font-black uppercase tracking-[0.14em] text-slate-500">{displayName}</p>
      {items.map((item) => {
        const active = item.isActive(pathname);
        return (
          <Link
            className={`flex min-h-11 items-center justify-between gap-3 rounded-lg px-3 text-sm font-bold ${focusRing} ${
              active ? "bg-amber-400/10 text-amber-300" : item.adminOnly ? "text-rose-300 hover:bg-slate-800" : "text-slate-200 hover:bg-slate-800"
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
              <span className="rounded-full bg-amber-400 px-2 py-0.5 text-xs font-black text-slate-950">{item.badgeCount}</span>
            )}
          </Link>
        );
      })}
      <div className="my-1.5 h-px bg-slate-800" />
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
      <header className="sticky top-0 z-30 hidden border-b border-slate-800 bg-slate-950/95 backdrop-blur sm:block">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-6">
          <Link className={`flex items-center gap-2 rounded-lg text-lg font-black tracking-tight text-amber-400 ${focusRing}`} href="/">
            KUT
          </Link>
          <nav aria-label="Primary" className="flex flex-1 items-center gap-1">
            {primaryNavItems.map((item) => {
              const active = item.isActive(pathname);
              return (
                <Link
                  aria-current={active ? "page" : undefined}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-bold transition-colors ${focusRing} ${
                    active ? "bg-amber-400/10 text-amber-300" : "text-slate-300 hover:text-slate-50"
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
            <span className="flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm font-black tabular-nums text-amber-300">
              <IconCoin className="h-3.5 w-3.5" />
              {balance.toLocaleString()}
            </span>
            <div className="relative" ref={desktopMenuRef}>
              <button
                aria-expanded={moreOpen}
                aria-haspopup="menu"
                className={`flex min-h-10 items-center gap-1.5 rounded-lg px-3 text-sm font-bold text-slate-300 hover:text-slate-50 ${focusRing}`}
                onClick={() => setMoreOpen((open) => !open)}
                type="button"
              >
                More
                {moreHasUnread && <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-amber-400" />}
                <IconChevronDown className="h-4 w-4" />
              </button>
              {moreOpen && <MoreMenu displayName={displayName} items={moreItems} />}
            </div>
            <span aria-hidden="true" className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-400 text-xs font-black text-slate-950">
              {initials || "KUT"}
            </span>
          </div>
        </div>
      </header>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-slate-800 bg-slate-950/95 px-4 backdrop-blur sm:hidden">
        <Link className={`rounded-lg text-base font-black text-amber-400 ${focusRing}`} href="/">KUT</Link>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 rounded-full border border-slate-700 bg-slate-900 px-2.5 py-1 text-xs font-black tabular-nums text-amber-300">
            <IconCoin className="h-3 w-3" />
            {balance.toLocaleString()}
          </span>
          <div className="relative" ref={mobileMenuRef}>
            <button
              aria-expanded={moreOpen}
              aria-haspopup="menu"
              aria-label="Open menu"
              className={`relative flex h-9 w-9 items-center justify-center rounded-full border border-slate-700 text-slate-300 ${focusRing}`}
              onClick={() => setMoreOpen((open) => !open)}
              type="button"
            >
              <IconMenu className="h-4 w-4" />
              {moreHasUnread && (
                <span aria-hidden="true" className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-slate-950 bg-amber-400" />
              )}
            </button>
            {moreOpen && <MoreMenu displayName={displayName} items={moreItems} />}
          </div>
        </div>
      </header>

      {/* Mobile bottom tab bar */}
      <nav aria-label="Primary" className="fixed inset-x-0 bottom-0 z-30 flex border-t border-slate-800 bg-slate-950/95 backdrop-blur sm:hidden">
        {primaryNavItems.map((item) => {
          const active = item.isActive(pathname);
          return (
            <Link
              aria-current={active ? "page" : undefined}
              className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-bold ${focusRing} ${active ? "text-amber-300" : "text-slate-400"}`}
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
