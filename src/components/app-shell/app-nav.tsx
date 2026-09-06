"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconCoin, IconMessages } from "@/components/icons";
import { activeEntryKey, ariaCurrent, formatBadgeCount, isSegmentPrefix } from "@/lib/nav/routes";
import { buildPrimaryNavItems, type NavItem } from "./nav-items";

type AppNavProps = {
  displayName: string;
  isAdmin: boolean;
  balance: number;
  unreadCount: number;
  incomingOfferCount: number;
};

const focusRing = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass";

function TabBadge({ item }: { item: NavItem }) {
  const text = formatBadgeCount(item.badgeCount ?? 0);
  if (!text) return null;
  return <span className="grid h-[1.125rem] min-w-[1.125rem] place-items-center rounded-full bg-brass px-1.5 text-[0.7rem] font-black leading-none tabular-nums text-ink-on-accent">{text}{item.badgeNoun && <span className="sr-only"> {item.badgeNoun}</span>}</span>;
}

function TabBarBadge({ item }: { item: NavItem }) {
  const text = formatBadgeCount(item.badgeCount ?? 0);
  if (!text) return null;
  return <span className="absolute -right-2.5 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full border-2 border-board-deep bg-brass px-1 text-[0.625rem] font-black leading-none tabular-nums text-ink-on-accent">{text}{item.badgeNoun && <span className="sr-only"> {item.badgeNoun}</span>}</span>;
}

function MessagesLink({ unreadCount, className }: { unreadCount: number; className: string }) {
  const pathname = usePathname();
  const active = isSegmentPrefix("/messages", pathname);
  const text = formatBadgeCount(unreadCount);
  return <Link aria-current={active ? "page" : undefined} aria-label={unreadCount > 0 ? `Messages, ${unreadCount} unread` : "Messages"} className={`relative grid shrink-0 place-items-center rounded-full border transition-colors ${focusRing} ${className} ${active ? "border-brass/60 bg-brass/10 text-brass" : "border-line text-ink-dim hover:text-ink"}`} href="/messages"><IconMessages className="h-4 w-4" />{!!text && <span aria-hidden="true" className="absolute -right-1 -top-1 grid h-[1.125rem] min-w-[1.125rem] place-items-center rounded-full border-2 border-board bg-brass px-1 text-[0.625rem] font-black leading-none tabular-nums text-ink-on-accent">{text}</span>}</Link>;
}

export function AppNav({ displayName, balance, unreadCount, incomingOfferCount }: AppNavProps) {
  const pathname = usePathname();
  const primaryItems = buildPrimaryNavItems(incomingOfferCount);
  const activeKey = activeEntryKey(primaryItems, pathname);
  const initials = displayName.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  const settingsActive = isSegmentPrefix("/settings", pathname) || isSegmentPrefix("/how-it-works", pathname) || isSegmentPrefix("/admin", pathname);

  return <>
    <header className="sticky top-0 z-30 hidden border-b border-line/40 bg-board-deep/80 backdrop-blur sm:block">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-6">
        <Link className={`flex items-center gap-2.5 rounded-lg text-xl font-black tracking-tight text-ink ${focusRing}`} href="/"><span aria-hidden="true" className="clip-pennant h-4 w-3.5 shrink-0 bg-brass"/>KUT</Link>
        <nav aria-label="Primary" className="flex flex-1 items-center gap-1">{primaryItems.map((item) => <Link aria-current={ariaCurrent(item, pathname, activeKey)} className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-bold transition-colors ${focusRing} ${item.key === activeKey ? "bg-brass/10 text-brass" : "text-ink-dim hover:text-ink"}`} href={item.href} key={item.key}><item.Icon className="h-4 w-4"/>{item.label}<TabBadge item={item}/></Link>)}</nav>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 rounded-full border border-brass/30 bg-gradient-to-b from-brass/15 to-brass/5 px-3.5 py-1.5 text-sm font-black tabular-nums text-brass"><IconCoin className="h-3.5 w-3.5"/>{balance.toLocaleString()}</span>
          <MessagesLink className="h-9 w-9" unreadCount={unreadCount}/>
          <Link aria-current={settingsActive ? "page" : undefined} aria-label={`Settings, ${displayName}`} className={`grid h-9 w-9 place-items-center rounded-full bg-brass text-xs font-black text-ink-on-accent ${focusRing} ${settingsActive ? "ring-2 ring-brass/40 ring-offset-2 ring-offset-board-deep" : ""}`} href="/settings">{initials || "KUT"}</Link>
        </div>
      </div>
    </header>

    <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-2 border-b border-line/40 bg-board-deep/85 px-4 backdrop-blur sm:hidden">
      <Link className={`flex shrink-0 items-center gap-2 rounded-lg text-lg font-black text-ink ${focusRing}`} href="/"><span aria-hidden="true" className="clip-pennant h-3.5 w-3 shrink-0 bg-brass"/>KUT</Link>
      <div className="flex min-w-0 items-center gap-2"><span className="flex min-w-0 items-center gap-1 rounded-full border border-brass/30 bg-gradient-to-b from-brass/15 to-brass/5 px-3 py-1 text-xs font-black tabular-nums text-brass"><IconCoin className="h-3 w-3 shrink-0"/><span className="truncate">{balance.toLocaleString()}</span></span><MessagesLink className="h-11 w-11" unreadCount={unreadCount}/><Link aria-current={settingsActive ? "page" : undefined} aria-label={`Settings, ${displayName}`} className={`grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brass text-xs font-black text-ink-on-accent ${focusRing} ${settingsActive ? "ring-2 ring-brass/40 ring-offset-2 ring-offset-board" : ""}`} href="/settings">{initials || "KUT"}</Link></div>
    </header>

    <nav aria-label="Primary" className="fixed inset-x-0 bottom-0 z-30 flex border-t border-line/40 bg-board-deep/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden">{primaryItems.map((item) => <Link aria-current={ariaCurrent(item, pathname, activeKey)} className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-[10px] font-bold leading-none min-[360px]:text-[11px] ${focusRing} ${item.key === activeKey ? "text-brass" : "text-ink-faint"}`} href={item.href} key={item.key}><span className="relative"><item.Icon className="h-5 w-5"/><TabBarBadge item={item}/></span><span className="whitespace-nowrap">{item.label}</span></Link>)}</nav>
  </>;
}
