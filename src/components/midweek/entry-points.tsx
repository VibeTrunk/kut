import Link from "next/link";
import { formatClock, formatDayDate, formatShortLock, formatWeekday } from "@/lib/midweek/entry";
import type { EntryMini } from "@/lib/midweek/load";
import { MidweekCountdown } from "./countdown";
import { MidweekMiniCard } from "./mini-card";

/**
 * The two ways into `/club/midweek` from elsewhere, in their before-the-lock
 * states (PR 7). The evening and after-the-final states are PR 8's. Both are
 * rendered only while picking is open for a member who hasn't opted out
 * (`loadMidweekEntryPoint`), so neither shows when Midweek is disabled.
 */

/** `MidweekEntryCard` on Home, directly under the header (Home-BeforeLock). */
export function MidweekEntryCard({
  lockAt,
  now,
  saved,
}: {
  lockAt: string;
  now: string;
  saved: EntryMini[];
}) {
  const picked = saved.length > 0;
  const when = `${formatWeekday(lockAt)} at ${formatClock(lockAt)}`;
  return (
    <Link
      className="group grid gap-3.5 rounded-2xl border border-brass/50 bg-[radial-gradient(80%_140%_at_100%_0%,rgb(143_176_194/10%),transparent_60%)] bg-brass-bg/25 px-[18px] pt-[18px] pb-4 hover:border-brass sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-x-8 sm:gap-y-4 sm:px-6 sm:py-[22px]"
      href="/club/midweek"
    >
      <span className="grid gap-2.5">
        <span>
          <span className="block text-[0.7rem] font-extrabold tracking-[0.26em] text-brass uppercase">
            Midweek Madness &middot; {formatDayDate(lockAt)}
          </span>
          <span className="display mt-1 block text-3xl sm:text-4xl">
            {picked ? "Your five are in" : "Pick your five"}
          </span>
        </span>
        <span className="block text-sm leading-relaxed text-ink-dim">
          {picked ? (
            <>
              Change them until {formatWeekday(lockAt)} {formatClock(lockAt)}.
            </>
          ) : (
            <>
              Squads lock <b className="text-ink">{when}</b>,{" "}
              <MidweekCountdown now={now} target={lockAt} />. You haven&rsquo;t picked yet, so an
              auto squad would play for you, heavily handicapped.
            </>
          )}
        </span>
        <span aria-hidden="true" className="flex gap-1.5">
          {picked
            ? saved.map((card, index) => (
                <MidweekMiniCard
                  injured={card.injured}
                  key={index}
                  ovr={card.ovr}
                  rarityTier={card.rarityTier}
                  small
                />
              ))
            : Array.from({ length: 5 }, (_, index) => (
                <MidweekMiniCard key={index} small variant="unknown" />
              ))}
        </span>
      </span>
      <span
        className={
          picked
            ? "inline-flex min-h-12 items-center justify-center rounded-xl border border-line bg-panel/70 px-5 text-[15px] font-black text-ink group-hover:border-brass"
            : "inline-flex min-h-12 items-center justify-center rounded-xl bg-gradient-to-b from-[#eebd63] to-[#d29a34] px-5 text-[15px] font-black text-ink-on-accent shadow-lg shadow-brass/25 group-hover:brightness-105"
        }
      >
        {picked ? "Change your five" : "Pick your five"}
      </span>
    </Link>
  );
}

/** `MidweekStrip` under the Collection header (Collection-Card, owner decision D2). */
export function MidweekStrip({ lockAt, saved }: { lockAt: string; saved: EntryMini[] }) {
  const picked = saved.length > 0;
  const lock = formatShortLock(lockAt);
  return (
    <Link
      className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-[14px] border border-brass/40 bg-brass-bg/28 px-3 py-2.5 hover:border-brass"
      href="/club/midweek"
    >
      {picked ? (
        <MidweekMiniCard
          injured={saved[0].injured}
          ovr={saved[0].ovr}
          rarityTier={saved[0].rarityTier}
        />
      ) : (
        <MidweekMiniCard variant="unknown" />
      )}
      <span className="text-[13.5px] leading-snug text-ink-dim">
        <b className="block text-[14.5px] text-ink">
          {picked ? "Midweek Madness: your five are in" : "Midweek Madness: pick five of these"}
        </b>
        {picked ? `Change them until ${lock}.` : `Squads lock ${lock}. No pick, auto squad.`}
      </span>
      <span aria-hidden="true" className="text-xl font-black text-brass">
        &rarr;
      </span>
    </Link>
  );
}
