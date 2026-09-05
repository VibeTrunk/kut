"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { activeEntryKey, ariaCurrent, formatBadgeCount, type RouteEntry } from "@/lib/nav/routes";

/**
 * In-page tabs for a section: Market's Buy / Offers, the Leaderboard's
 * Clubs / Players, and the Admin row.
 *
 * TEXT-ONLY BY DESIGN. This is a client component rendered by server pages, so
 * an `Icon` prop would be a function crossing the RSC boundary and would fail
 * at build time. If a tab needs a glyph, inline it in the label's own markup at
 * the call site, or render the tabs from a client component.
 *
 * Active resolution goes through `activeEntryKey` rather than a per-tab prefix
 * test, because a section index and a tab nested under it are both tabs:
 * `/market/offers` must light Offers and not Buy, while `/market/<id>` must
 * light Buy. Longest owned prefix wins.
 */
export type SectionTab = RouteEntry & {
  badgeCount?: number;
  badgeNoun?: string;
};

type SectionTabsProps = {
  /** The `aria-label` on the nav, e.g. "Market". */
  label: string;
  tabs: readonly SectionTab[];
  /**
   * `segmented` (default) is the two-or-three tab control that matches the
   * Collection's Album/Manage toggle. `row` is the flat wrap the Admin header
   * uses, which suits six tabs where a segmented control would leave each one
   * ~60px wide on a phone.
   */
  variant?: "segmented" | "row";
  /**
   * Escape hatch for tabs that are not decided by the pathname — the
   * Collection's `?view=manage` toggle is query-param state, which
   * `usePathname()` cannot see.
   */
  activeKey?: string;
};

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass";

function TabBadge({ tab }: { tab: SectionTab }) {
  const text = formatBadgeCount(tab.badgeCount ?? 0);
  if (!text) return null;
  return (
    <span className="grid h-[1.125rem] min-w-[1.125rem] place-items-center rounded-full bg-brass px-1.5 text-[0.7rem] font-black leading-none tabular-nums text-ink-on-accent">
      {text}
      {tab.badgeNoun && <span className="sr-only"> {tab.badgeNoun}</span>}
    </span>
  );
}

export function SectionTabs({ label, tabs, variant = "segmented", activeKey }: SectionTabsProps) {
  const pathname = usePathname();
  const resolved = activeKey ?? activeEntryKey(tabs, pathname);

  // `w-full … sm:w-fit` with `flex-1 … sm:flex-none` matters: without it two
  // tabs inside a max-w-6xl section stretch to ~576px each on desktop.
  const navClass =
    variant === "row"
      ? "flex flex-wrap gap-2"
      : "flex w-full gap-1 rounded-xl border border-line bg-board-deep/40 p-1 sm:w-fit";

  return (
    <nav aria-label={label} className={navClass}>
      {tabs.map((tab) => {
        const active = tab.key === resolved;
        const tabClass =
          variant === "row"
            ? `inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-bold ${
                active ? "bg-brass/10 text-brass" : "text-ink-faint hover:text-ink"
              }`
            : `flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg px-5 text-sm font-black sm:flex-none sm:px-6 ${
                active ? "bg-brass/15 text-brass" : "text-ink-dim hover:text-ink"
              }`;
        return (
          <Link
            // An explicit activeKey means the caller resolved the state itself
            // (the Album/Manage toggle differs only by query string, which
            // ariaCurrent cannot see), so trust it as the exact page.
            aria-current={activeKey ? (active ? "page" : undefined) : ariaCurrent(tab, pathname, resolved)}
            className={`${tabClass} ${focusRing}`}
            href={tab.href}
            key={tab.key}
          >
            {tab.label}
            <TabBadge tab={tab} />
          </Link>
        );
      })}
    </nav>
  );
}
