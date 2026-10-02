import Link from "next/link";
import { formatClock, formatDayDate, formatWeekday } from "@/lib/midweek/entry";
import type { EntryMini, HomeMatch } from "@/lib/midweek/load";
import { LiveMarker } from "./chip";
import { MidweekCountdown } from "./countdown";
import { MidweekMiniCard } from "./mini-card";
import { ReportText } from "./player-name";
import { MidweekScoreboard } from "./report";

/**
 * Home's ways into `/midweek`, in its "now" stack (design/ux-review
 * `Home-Now-Picking` and `Home-Now-Live`, ADR-114): the pick card before the
 * lock, the evening card from the lock to the end of the final, and the
 * champion until owner decision D4's cutoff. Which one shows is
 * `loadMidweekEntryPoint`'s call; nothing shows when Midweek is disabled or the
 * member has opted out. Each card is one link.
 */

export const NOW_CARD = "grid gap-3 rounded-2xl border p-4 sm:px-6 sm:py-5";
export const NOW_BRASS = "border-brass/50 bg-brass-bg/30 hover:border-brass";
export const NOW_KICKER =
  "text-[0.7rem] font-extrabold tracking-[0.26em] text-brass uppercase [overflow-wrap:anywhere]";
const PRIMARY =
  "inline-flex min-h-12 items-center justify-center rounded-xl bg-gradient-to-b from-[#eebd63] to-[#d29a34] px-5 text-[15px] font-black text-ink-on-accent shadow-lg shadow-brass/25 group-hover:brightness-105";
const SECONDARY =
  "inline-flex min-h-12 items-center justify-center rounded-xl border border-line bg-panel/70 px-5 text-[15px] font-black text-ink group-hover:border-brass";

/** Before the lock: pick your five, or they're in (Home-Now-Picking). */
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
  return (
    <Link className={`group ${NOW_CARD} ${NOW_BRASS}`} href="/midweek">
      <span className="flex flex-wrap items-baseline justify-between gap-x-2.5 gap-y-1">
        <span className={NOW_KICKER}>Midweek Madness &middot; {formatDayDate(lockAt)}</span>
        <MidweekCountdown className="text-sm font-extrabold text-brass" now={now} target={lockAt} />
      </span>
      <span className="display text-2xl sm:text-3xl">
        {picked ? "Your five are in" : "Pick your five"}
      </span>
      <span className="text-sm leading-relaxed text-ink-dim">
        {picked ? (
          <>
            Change them until {formatWeekday(lockAt)} {formatClock(lockAt)}.
          </>
        ) : (
          <>
            Squads lock {formatWeekday(lockAt)} at {formatClock(lockAt)}. You haven&rsquo;t picked
            yet, so an auto squad would play for you, heavily handicapped.
          </>
        )}
      </span>
      {picked && (
        <span aria-hidden="true" className="flex gap-1.5">
          {saved.map((card, index) => (
            <MidweekMiniCard
              injured={card.injured}
              key={index}
              ovr={card.ovr}
              rarityTier={card.rarityTier}
              small
            />
          ))}
        </span>
      )}
      <span className={picked ? SECONDARY : PRIMARY}>
        {picked ? "Change your five" : "Pick your five"}
      </span>
    </Link>
  );
}

/**
 * From the lock to the end of the final (Home-Now-Live): leads Home. Your
 * match, or the final, as it stood at page load: Home doesn't poll (Q11).
 */
export function MidweekLiveCard({
  kicker,
  title,
  line,
  match,
  button,
}: {
  kicker: string;
  title: string;
  line: string;
  match: HomeMatch | null;
  button: { label: string; href: string };
}) {
  return (
    <Link
      className={`group ${NOW_CARD} border-team-red-line bg-[linear-gradient(180deg,rgb(51_20_25/55%),rgb(33_28_21/60%))] hover:border-live`}
      href={button.href}
    >
      <span className="flex flex-wrap items-center justify-between gap-x-2.5 gap-y-1">
        <span className={NOW_KICKER}>{kicker}</span>
        <LiveMarker />
      </span>
      {match ? (
        <>
          <MidweekScoreboard
            auto={match.auto}
            compact
            goals={match.goals}
            managers={match.managers}
            penalties={match.penalties}
            winnerSide={match.winnerSide}
            youSide={match.youSide}
          />
          <span className="text-sm leading-relaxed text-ink-dim">
            <ReportText parts={match.headline} />
          </span>
        </>
      ) : (
        <>
          <span className="display text-2xl sm:text-3xl">{title}</span>
          <span className="text-sm leading-relaxed text-ink-dim">{line}</span>
        </>
      )}
      <span className={PRIMARY}>{button.label}</span>
    </Link>
  );
}

/** After the final, until Thursday 23:59 (owner decision D4). */
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
    <Link className={`group ${NOW_CARD} ${NOW_BRASS}`} href={`/midweek/${weekStart}`}>
      <span className={NOW_KICKER}>Midweek Madness &middot; {formatDayDate(lockAt)}</span>
      <span className="display text-2xl sm:text-3xl">{title}</span>
      <span className="text-sm leading-relaxed text-ink-dim">{line}</span>
      <span className={SECONDARY}>See the bracket</span>
    </Link>
  );
}
