import Link from "next/link";
import { formatClock, formatDayDate, formatWeekday } from "@/lib/midweek/entry";
import type { ClockStop } from "@/lib/midweek/evening";
import type { EntryMini } from "@/lib/midweek/load";
import { MidweekRevealClock } from "./clock";
import { MidweekCountdown } from "./countdown";
import { MidweekMiniCard } from "./mini-card";

/**
 * Home's way into `/midweek`: its card before the lock (PR 7), during the
 * evening and after the final until owner decision D4's cutoff (PR 8). Which
 * one shows is `loadMidweekEntryPoint`'s call; nothing shows when Midweek is
 * disabled or the member has opted out. The Collection strip (owner decision
 * D2) is gone: Compete's badge and this card replace it (Q12, ADR-107).
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
      href="/midweek"
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

const CARD =
  "group grid gap-3.5 rounded-2xl border border-brass/50 bg-[radial-gradient(80%_140%_at_100%_0%,rgb(143_176_194/10%),transparent_60%)] bg-brass-bg/25 px-[18px] pt-[18px] pb-4 hover:border-brass sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-x-8 sm:gap-y-4 sm:px-6 sm:py-[22px]";
const SECONDARY =
  "inline-flex min-h-12 items-center justify-center rounded-xl border border-line bg-panel/70 px-5 text-[15px] font-black text-ink group-hover:border-brass";

/** `MidweekEntryCard` during the evening (Home-Live): your latest result, what's next, a compact clock. */
export function MidweekLiveCard({
  title,
  line,
  stops,
}: {
  title: string;
  line: string;
  stops: ClockStop[] | null;
}) {
  return (
    <Link className={CARD} href="/midweek">
      <span className="grid gap-3">
        <span>
          <span className="block text-[0.7rem] font-extrabold tracking-[0.26em] text-brass uppercase">
            Midweek Madness &middot; live
          </span>
          <span className="display mt-1 block text-3xl sm:text-4xl">{title}</span>
        </span>
        <span className="block text-sm leading-relaxed text-ink-dim">{line}</span>
        {stops && <MidweekRevealClock compact label="Wednesday's schedule" stops={stops} />}
      </span>
      <span className={SECONDARY}>Follow the bracket</span>
    </Link>
  );
}

/** `MidweekEntryCard` after the final, until Thursday 23:59 (owner decision D4). */
export function MidweekFinalCard({
  weekStart,
  lockAt,
  title,
  line,
}: {
  weekStart: string;
  lockAt: string;
  title: string;
  line: string;
}) {
  return (
    <Link className={CARD} href={`/midweek/${weekStart}`}>
      <span className="grid gap-2.5">
        <span>
          <span className="block text-[0.7rem] font-extrabold tracking-[0.26em] text-brass uppercase">
            Midweek Madness &middot; {formatDayDate(lockAt)}
          </span>
          <span className="display mt-1 block text-3xl sm:text-4xl">{title}</span>
        </span>
        <span className="block text-sm leading-relaxed text-ink-dim">{line}</span>
      </span>
      <span className={SECONDARY}>See the bracket</span>
    </Link>
  );
}
