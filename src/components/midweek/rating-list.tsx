import Link from "next/link";
import { LiveCard } from "@/components/live-card";
import { MIDWEEK } from "@/game/midweek/config";
import type { NightRatings, RatedCard } from "@/lib/midweek/night-ratings";
import { RATING } from "@/lib/midweek/report/ratings";
import { MidweekTrialistCard } from "./bits";
import { MidweekMiniCard } from "./mini-card";
import { MidweekSectionHead } from "./page-head";
import { MidweekRatingDisc } from "./rating-disc";
import { MidweekRatingToggle } from "./rating-toggle";

/** The rule under the block, every number from `RATING` (DR3 HANDOFF "Copy"). */
export const RATING_RULE =
  `Every card starts at ${RATING.base} and gains for goals, assists, saves and blocks, more for ` +
  `the harder ones; a win adds ${RATING.result} and a defeat takes ${RATING.result} off. A miss ` +
  `never costs the shooter. The night’s rating is the mean of the card’s matches; a bye isn’t a match.`;

export const ratingsSubline = (matchCount: number) =>
  `Out of 10, the mean of ${matchCount} ${matchCount === 1 ? "match" : "matches"}`;

function BestChip() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-line px-2 py-px text-[10px] font-black tracking-[0.08em] whitespace-nowrap text-ink uppercase">
      ★ Best of your five
    </span>
  );
}

function MatchChips({ card }: { card: RatedCard }) {
  return (
    <ul className="mt-2 hidden min-w-0 gap-1.5 group-data-[open=true]:grid">
      {card.matches.map((match) => (
        <li className="min-w-0" key={match.href}>
          <Link
            className="grid min-h-11 w-full grid-cols-[minmax(0,1fr)_30px_8px] items-center gap-2 rounded-2xl border border-line bg-board-deep/40 py-1 pr-2 pl-3 text-[12.5px] font-bold text-ink-dim hover:border-brass"
            href={match.href}
          >
            <span className="[overflow-wrap:anywhere]">{match.label}</span>
            <MidweekRatingDisc
              context={`against ${match.opponent}`}
              rating={match.rating}
              size="xs"
            />
            <span aria-hidden="true" className="font-black text-brass">
              &rsaquo;
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/**
 * `MidweekRatingList` (DR3 HANDOFF §1, ADR-117): a member's five once the week
 * is complete, best first with `★ Best of your five` on the top card, never a
 * mark for the lowest. Below `lg` one row per card (mini card, name, meta, the
 * line, the disc on the right); from `lg` the five LiveCards in a row with the
 * disc and name under each. `Show each match` opens a chip per match, linking
 * to its report.
 */
export function MidweekRatingList({
  ratings,
  defaultOpen,
  id = "ratings",
}: {
  ratings: NightRatings;
  defaultOpen: boolean;
  id?: string;
}) {
  const headId = `${id}-h`;
  const listId = `${id}-cards`;
  return (
    <section aria-labelledby={headId} className="grid scroll-mt-24 gap-3" id={id}>
      <MidweekSectionHead id={headId} title="Your five’s ratings">
        <p className="text-[13px] text-ink-faint">{ratingsSubline(ratings.matchCount)}</p>
      </MidweekSectionHead>
      <MidweekRatingToggle
        controls={listId}
        defaultOpen={defaultOpen}
        link={
          <Link
            className="text-sm font-bold text-brass hover:underline"
            href="/how-it-works#midweek-ratings"
          >
            How ratings work &rarr;
          </Link>
        }
      >
        <div id={listId}>
          <ol className="grid lg:hidden">
            {ratings.cards.map((card) => (
              <li
                className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3 border-b border-line/35 py-3 first:pt-1"
                key={card.slot}
              >
                {card.mini ? (
                  <MidweekMiniCard {...card.mini} />
                ) : (
                  <MidweekMiniCard ovr={MIDWEEK.trialist.ovr} variant="trialist" />
                )}
                <div className="grid min-w-0 gap-0.5">
                  <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[15px] leading-tight font-black [overflow-wrap:anywhere]">
                    {card.name}
                    {card.best && <BestChip />}
                  </p>
                  <p className="text-xs text-ink-faint">{card.meta}</p>
                  <p className="mt-1 font-serif text-[17px] leading-[1.3] text-pretty text-ink">
                    {card.line}
                  </p>
                </div>
                <MidweekRatingDisc context="for the night" rating={card.rating} />
                <div className="col-span-2 col-start-2 hidden min-w-0 group-data-[open=true]:block">
                  <MatchChips card={card} />
                </div>
              </li>
            ))}
          </ol>
          <ol className="hidden grid-cols-5 items-start gap-x-5 gap-y-2.5 lg:grid">
            {ratings.cards.map((card) => (
              <li className="row-span-4 grid min-w-0 grid-rows-subgrid" key={card.slot}>
                {card.face ? (
                  <LiveCard player={card.face} />
                ) : (
                  <MidweekTrialistCard
                    slot={card.slot + 1}
                    state="trialist"
                    trialistOvr={MIDWEEK.trialist.ovr}
                  />
                )}
                <div className="flex items-center gap-2.5">
                  <MidweekRatingDisc context="for the night" rating={card.rating} size="lg" />
                  <div className="grid min-w-0 justify-items-start gap-1">
                    <p className="text-[14.5px] leading-tight font-black [overflow-wrap:anywhere]">
                      {card.name}
                    </p>
                    {card.best && <BestChip />}
                  </div>
                </div>
                <p className="font-serif text-base leading-[1.3] text-pretty text-ink">
                  {card.line}
                </p>
                <MatchChips card={card} />
              </li>
            ))}
          </ol>
        </div>
      </MidweekRatingToggle>
      <p className="text-[12.5px] leading-normal text-ink-faint">{RATING_RULE}</p>
    </section>
  );
}
