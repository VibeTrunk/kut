import Link from "next/link";
import { IconScale } from "@/components/icons";
import { SectionTabs } from "@/components/app-shell/section-tabs";
import type { RouteEntry } from "@/lib/nav/routes";

/**
 * The one Collection header, shared by the album view (`collection-album.tsx`)
 * and the manage grid (`club/collection/page.tsx`).
 *
 * The two were ~90% identical copies that had drifted apart only because one
 * lived in a page and the other in a component — including two hand-copied
 * Album/Manage toggles. They are merged here because this PR adds a fourth
 * figure (Club Value, inherited from the retired `/club` hub) and adding it
 * twice is how the duplication happened in the first place.
 *
 * Server component: both callers are server-rendered, so this costs nothing in
 * the client bundle.
 */

const VIEW_TABS: RouteEntry[] = [
  { key: "album", href: "/club/collection", label: "Album" },
  { key: "manage", href: "/club/collection?view=manage", label: "Manage" },
  { key: "trading", href: "/club/collection/wanted", label: "Trading" },
];

/** The completion bar. Also used for the album's per-page index chips. */
export function Completion({ count, total }: { count: number; total: number }) {
  return (
    <svg aria-label={`${count} of ${total} collected`} className="h-2 w-full" viewBox="0 0 100 8">
      <rect className="fill-line/60" height="8" rx="4" width="100" />
      <rect className="fill-brass" height="8" rx="4" width={total ? (count / total) * 100 : 0} />
    </svg>
  );
}

type CollectionHeaderProps = {
  mode: "album" | "manage";
  cardCount: number;
  uniquePlayers: number;
  totalPlayers: number;
  discardValue: number;
  /** Null when the figure could not be read — the header simply omits it. */
  clubValue: number | null;
  showArchetypeNudge: boolean;
};

export function CollectionHeader({
  mode,
  cardCount,
  uniquePlayers,
  totalPlayers,
  discardValue,
  clubValue,
  showArchetypeNudge,
}: CollectionHeaderProps) {
  return (
    <header className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
      <div className="space-y-3">
        <p className="text-[0.7rem] font-extrabold uppercase tracking-[0.26em] text-brass">My club</p>
        <h1 className="display text-3xl sm:text-6xl">Collection</h1>
        <p className="display text-4xl text-brass">
          {uniquePlayers} / {totalPlayers}{" "}
          <span className="font-sans text-xs font-extrabold uppercase tracking-[0.16em] text-ink-dim">
            TFH players collected
          </span>
        </p>
        <Completion count={uniquePlayers} total={totalPlayers} />
        <p className="text-xs font-bold text-ink-faint">
          {cardCount} {cardCount === 1 ? "card" : "cards"} &middot; {uniquePlayers} unique{" "}
          {uniquePlayers === 1 ? "player" : "players"} &middot; {discardValue.toLocaleString()} KUT Coins of discard
          value
        </p>
        {/* Club Value moved here when /club retired (ADR-053). It stays a link,
            which was the one thing that hub still did that nothing else did. */}
        {clubValue !== null && (
          <p className="flex items-center gap-1.5 text-xs font-bold text-ink-faint">
            <IconScale aria-hidden="true" className="h-3.5 w-3.5" />
            Club Value
            <Link className="font-black tabular-nums text-brass hover:underline" href="/club/value">
              {clubValue.toLocaleString()} KUT Coins &rarr;
            </Link>
          </p>
        )}
      </div>
      <div className="space-y-3">
        <SectionTabs activeKey={mode} label="Collection view" tabs={VIEW_TABS} />
        {showArchetypeNudge && (
          <Link
            className="block rounded-full border border-brass-line bg-brass-bg/40 px-4 py-3 text-sm font-bold text-ink-dim hover:text-brass"
            href="/settings/card"
          >
            Your card is an All-rounder by default &mdash; <span className="text-brass">choose your type &rarr;</span>
          </Link>
        )}
      </div>
    </header>
  );
}
