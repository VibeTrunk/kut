"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { IconChevronDown, IconCoin, IconMessages } from "@/components/icons";
import { LogoutButton } from "@/components/logout-button";
import { BottomSheet } from "@/components/bottom-sheet";
import { activeEntryKey, ariaCurrent, formatBadgeCount, isSegmentPrefix } from "@/lib/nav/routes";
import { buildAccountMenuItems, buildPrimaryNavItems, type NavItem } from "./nav-items";

type AppNavProps = {
  displayName: string;
  isAdmin: boolean;
  balance: number;
  unreadCount: number;
  incomingOfferCount: number;
};

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass";

/**
 * The badge on a desktop tab: in flow, inside the row's existing `gap-2`.
 * The count is repeated as an `sr-only` noun so the link reads as
 * "Market 2 incoming trade offers" rather than a bare number.
 */
function TabBadge({ item }: { item: NavItem }) {
  const text = formatBadgeCount(item.badgeCount ?? 0);
  if (!text) return null;
  return (
    <span className="grid h-[1.125rem] min-w-[1.125rem] place-items-center rounded-full bg-brass px-1.5 text-[0.7rem] font-black leading-none tabular-nums text-ink-on-accent">
      {text}
      {item.badgeNoun && <span className="sr-only"> {item.badgeNoun}</span>}
    </span>
  );
}

/**
 * The badge on a bottom-bar tab. It MUST be absolutely positioned against the
 * icon: in flow it widens the column's intrinsic size, which breaks the five
 * equal `flex-1` tracks, and it grows the row, which breaks the touch target.
 * The `border-2` matches the bar's own ground and notches the digit away from
 * the glyph underneath.
 */
function TabBarBadge({ item }: { item: NavItem }) {
  const text = formatBadgeCount(item.badgeCount ?? 0);
  if (!text) return null;
  return (
    <span className="absolute -right-2.5 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full border-2 border-board-deep bg-brass px-1 text-[0.625rem] font-black leading-none tabular-nums text-ink-on-accent">
      {text}
      {item.badgeNoun && <span className="sr-only"> {item.badgeNoun}</span>}
    </span>
  );
}

/**
 * Messages, with a real count rather than the undifferentiated dot the old
 * "More" button carried. The badge is `aria-hidden` because the number is
 * already in the link's accessible name — otherwise it announces twice.
 */
function MessagesLink({ unreadCount, className }: { unreadCount: number; className: string }) {
  const pathname = usePathname();
  const active = isSegmentPrefix("/messages", pathname);
  const text = formatBadgeCount(unreadCount);
  return (
    <Link
      aria-current={active ? "page" : undefined}
      aria-label={unreadCount > 0 ? `Messages, ${unreadCount} unread` : "Messages"}
      className={`relative grid shrink-0 place-items-center rounded-full border transition-colors ${focusRing} ${className} ${
        active ? "border-brass/60 bg-brass/10 text-brass" : "border-line text-ink-dim hover:text-ink"
      }`}
      href="/messages"
    >
      <IconMessages className="h-4 w-4" />
      {!!text && (
        <span
          aria-hidden="true"
          className="absolute -right-1 -top-1 grid h-[1.125rem] min-w-[1.125rem] place-items-center rounded-full border-2 border-board bg-brass px-1 text-[0.625rem] font-black leading-none tabular-nums text-ink-on-accent"
        >
          {text}
        </span>
      )}
    </Link>
  );
}

/**
 * The account panel. Deliberately NOT `role="menu"`: the old More menu claimed
 * that role while containing a heading, a divider and a button — none of them
 * valid menu children — and implemented none of the roving focus or focus
 * management the role promises. A dropdown of navigation links is a `nav` with
 * links, which is also what `LensMenu` already does.
 */
function AccountLinks({ items, size }: { items: NavItem[]; size: "dropdown" | "sheet" }) {
  const pathname = usePathname();
  const activeKey = activeEntryKey(items, pathname);
  const rowClass = size === "sheet" ? "min-h-13 gap-3 px-3 text-[0.95rem]" : "min-h-11 gap-2.5 px-3 text-sm";
  return (
    <nav aria-label="Account">
      {items.map((item) => {
        const active = item.key === activeKey;
        return (
          <Link
            aria-current={ariaCurrent(item, pathname, activeKey)}
            className={`flex items-center rounded-lg font-bold ${rowClass} ${focusRing} ${
              active ? "bg-brass/10 text-brass" : item.adminOnly ? "text-brick hover:bg-panel-2" : "text-ink-dim hover:bg-panel-2"
            }`}
            href={item.href}
            key={item.key}
          >
            <item.Icon className={size === "sheet" ? "h-5 w-5" : "h-4 w-4"} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Desktop only. The phone gets a sheet — see BottomSheet's own note on why. */
function AccountMenu({ items, displayName }: { items: NavItem[]; displayName: string }) {
  return (
    <div className="absolute right-0 top-full mt-2 w-64 rounded-2xl border border-line bg-panel p-2 shadow-2xl shadow-board/60">
      <p className="px-3 pb-1 pt-2 text-xs font-black uppercase tracking-[0.14em] text-ink-faint">{displayName}</p>
      <AccountLinks items={items} size="dropdown" />
      <div className="my-1.5 h-px bg-panel-2" />
      <LogoutButton variant="menu-item" />
    </div>
  );
}

export function AppNav({ displayName, isAdmin, balance, unreadCount, incomingOfferCount }: AppNavProps) {
  const pathname = usePathname();
  const [accountOpen, setAccountOpen] = useState(false);
  const [lastPathname, setLastPathname] = useState(pathname);
  const desktopMenuRef = useRef<HTMLDivElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const desktopTriggerRef = useRef<HTMLButtonElement>(null);
  const mobileTriggerRef = useRef<HTMLButtonElement>(null);

  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    setAccountOpen(false);
  }

  useEffect(() => {
    if (!accountOpen) return;

    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node;
      // The account sheet renders outside both header refs and closes itself via
      // its scrim, so a tap inside it is not a tap outside the menu.
      if (target instanceof Element && target.closest('[role="dialog"]')) return;
      if (desktopMenuRef.current?.contains(target)) return;
      if (mobileMenuRef.current?.contains(target)) return;
      setAccountOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setAccountOpen(false);
      // Focus return — the one piece of menu behaviour worth keeping once the
      // ARIA menu roles are gone.
      (desktopTriggerRef.current ?? mobileTriggerRef.current)?.focus();
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [accountOpen]);

  const primaryItems = buildPrimaryNavItems(incomingOfferCount);
  const accountItems = buildAccountMenuItems(isAdmin);
  const activeKey = activeEntryKey(primaryItems, pathname);
  const accountActive = activeEntryKey(accountItems, pathname) !== null;
  const initials = displayName.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  const avatarLabel = `Account and settings, ${displayName}`;

  return (
    <>
      {/* Desktop / tablet top bar */}
      <header className="sticky top-0 z-30 hidden border-b border-line/40 bg-board-deep/80 backdrop-blur sm:block">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-6">
          <Link className={`flex items-center gap-2.5 rounded-lg text-xl font-black tracking-tight text-ink ${focusRing}`} href="/">
            <span aria-hidden="true" className="clip-pennant h-4 w-3.5 shrink-0 bg-brass" />
            KUT
          </Link>
          <nav aria-label="Primary" className="flex flex-1 items-center gap-1">
            {primaryItems.map((item) => (
              <Link
                aria-current={ariaCurrent(item, pathname, activeKey)}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-bold transition-colors ${focusRing} ${
                  item.key === activeKey ? "bg-brass/10 text-brass" : "text-ink-dim hover:text-ink"
                }`}
                href={item.href}
                key={item.key}
              >
                <item.Icon className="h-4 w-4" />
                {item.label}
                <TabBadge item={item} />
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 rounded-full border border-brass/30 bg-gradient-to-b from-brass/15 to-brass/5 px-3.5 py-1.5 text-sm font-black tabular-nums text-brass">
              <IconCoin className="h-3.5 w-3.5" />
              {balance.toLocaleString()}
            </span>
            <MessagesLink className="h-9 w-9" unreadCount={unreadCount} />
            <div className="relative" ref={desktopMenuRef}>
              <button
                aria-expanded={accountOpen}
                aria-label={avatarLabel}
                className={`flex items-center gap-1.5 rounded-full ${focusRing}`}
                onClick={() => setAccountOpen((open) => !open)}
                ref={desktopTriggerRef}
                type="button"
              >
                <span
                  className={`grid h-9 w-9 place-items-center rounded-full bg-brass text-xs font-black text-ink-on-accent ${
                    accountActive ? "ring-2 ring-brass/40 ring-offset-2 ring-offset-board-deep" : ""
                  }`}
                >
                  {initials || "KUT"}
                </span>
                <IconChevronDown aria-hidden="true" className="h-4 w-4 text-ink-dim" />
              </button>
              {accountOpen && <AccountMenu displayName={displayName} items={accountItems} />}
            </div>
          </div>
        </div>
      </header>

      {/* Mobile top bar. Three controls on the right rather than two, so the
          coins pill is allowed to shrink — at 320px with a six-figure balance
          the row would otherwise overflow into horizontal scroll. */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-2 border-b border-line/40 bg-board-deep/85 px-4 backdrop-blur sm:hidden">
        <Link className={`flex shrink-0 items-center gap-2 rounded-lg text-lg font-black text-ink ${focusRing}`} href="/">
          <span aria-hidden="true" className="clip-pennant h-3.5 w-3 shrink-0 bg-brass" />
          KUT
        </Link>
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex min-w-0 items-center gap-1 rounded-full border border-brass/30 bg-gradient-to-b from-brass/15 to-brass/5 px-3 py-1 text-xs font-black tabular-nums text-brass">
            <IconCoin className="h-3 w-3 shrink-0" />
            <span className="truncate">{balance.toLocaleString()}</span>
          </span>
          <MessagesLink className="h-11 w-11" unreadCount={unreadCount} />
          <div className="shrink-0" ref={mobileMenuRef}>
            <button
              aria-expanded={accountOpen}
              aria-label={avatarLabel}
              className={`flex items-center rounded-full ${focusRing}`}
              onClick={() => setAccountOpen((open) => !open)}
              ref={mobileTriggerRef}
              type="button"
            >
              <span
                className={`grid h-9 w-9 place-items-center rounded-full bg-brass text-xs font-black text-ink-on-accent ${
                  accountActive ? "ring-2 ring-brass/40 ring-offset-2 ring-offset-board" : ""
                }`}
              >
                {initials || "KUT"}
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* Mobile bottom tab bar */}
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-30 flex border-t border-line/40 bg-board-deep/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden"
      >
        {primaryItems.map((item) => (
          <Link
            aria-current={ariaCurrent(item, pathname, activeKey)}
            className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-[10px] font-bold leading-none min-[360px]:text-[11px] ${focusRing} ${
              item.key === activeKey ? "text-brass" : "text-ink-faint"
            }`}
            href={item.href}
            key={item.key}
          >
            <span className="relative">
              <item.Icon className="h-5 w-5" />
              <TabBarBadge item={item} />
            </span>
            <span className="whitespace-nowrap">{item.label}</span>
          </Link>
        ))}
      </nav>

      {/* Phone: a sheet within thumb reach, rather than the desktop dropdown
          anchored to the hardest corner of the screen to reach one-handed. */}
      <BottomSheet label="Account" onClose={() => setAccountOpen(false)} open={accountOpen} returnFocusRef={mobileTriggerRef}>
        <div className="flex items-center gap-3 border-b border-panel-2 pb-4">
          <span className="grid h-11 w-11 place-items-center rounded-full bg-brass text-sm font-black text-ink-on-accent">
            {initials || "KUT"}
          </span>
          <p className="text-[0.95rem] font-black text-ink">{displayName}</p>
        </div>
        <AccountLinks items={accountItems} size="sheet" />
        <div className="h-px bg-panel-2" />
        <LogoutButton variant="menu-item" />
      </BottomSheet>
    </>
  );
}
