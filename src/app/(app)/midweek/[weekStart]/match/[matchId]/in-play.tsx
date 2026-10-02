import Link from "next/link";
import { MidweekFiveList } from "@/components/midweek/five-list";
import { MidweekLivePoller } from "@/components/midweek/live-poller";
import { MIDWEEK_PAGE } from "@/components/midweek/page-head";
import { PlayerName } from "@/components/midweek/player-name";
import {
  MidweekLaneTimeline,
  MidweekScoreboard,
  MidweekShootoutLive,
  type Managers,
} from "@/components/midweek/report";
import { MidweekWhyList } from "@/components/midweek/why-list";
import type { FiveView } from "@/lib/midweek/evening";
import type { LiveMatch } from "@/lib/midweek/live-load";

/**
 * A match page while the match is in play (ADR-115), polling every 20 seconds.
 *
 * - The member's own match or the final (`Match-Yours-Live`, `Match-Final-Live`):
 *   the live scoreboard, every chance so far in its lane, the newest outlined,
 *   the shoot-out kick by kick once it has begun, and the Why without goals and
 *   assists. No headline or facts: they would give the result away.
 * - Any other match (`Match-Other-InPlay`): `In play · result at full time`, why
 *   it isn't shown chance by chance, both fives and the Why's pre-match side.
 */
export function InPlayMatch({
  back,
  kicker,
  managers,
  watched,
  youSide,
  auto,
  live,
  fives,
  now,
}: {
  back: { href: string; label: string };
  kicker: string;
  managers: Managers;
  watched: boolean;
  youSide: 0 | 1 | null;
  auto: readonly [boolean, boolean];
  live: LiveMatch | null;
  fives: FiveView[];
  now: string;
}) {
  return (
    <main className={MIDWEEK_PAGE}>
      <article className="mx-auto grid max-w-6xl gap-5 py-4 sm:gap-6 sm:py-8">
        <header className="grid gap-3">
          <Link
            className="justify-self-start text-sm font-bold text-brass hover:underline"
            href={back.href}
          >
            &larr; {back.label}
          </Link>
          <p className="text-[0.7rem] font-extrabold tracking-[0.26em] text-brass uppercase">
            {kicker}
          </p>
          <h1 className="sr-only">
            {managers[0]} v {managers[1]}
          </h1>
        </header>
        {watched ? (
          <>
            <MidweekScoreboard
              auto={auto}
              goals={live?.live.score ?? [0, 0]}
              live={{ minute: live?.live.minute ?? 0, penalties: live?.live.penalties ?? null }}
              managers={managers}
              penalties={null}
              winnerSide={null}
              youSide={youSide}
            />
            <div className="grid gap-7 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:items-start lg:gap-10">
              <div className="grid min-w-0 content-start gap-7">
                <section aria-labelledby="timeline-h" className="grid gap-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
                    <h2 className="display text-3xl" id="timeline-h">
                      How it went
                    </h2>
                    <p className="text-[13px] text-ink-faint">A new chance every 20 seconds</p>
                  </div>
                  <MidweekLaneTimeline
                    live
                    managers={managers}
                    timeline={live?.live.timeline ?? []}
                  />
                </section>
                {live?.live.shootout && live.live.penalties && (
                  <MidweekShootoutLive
                    kicks={live.live.kicks}
                    managers={managers}
                    penalties={live.live.penalties}
                  />
                )}
              </div>
              {live && (
                <aside className="min-w-0">
                  <MidweekWhyList beforeFullTime why={live.why} />
                </aside>
              )}
            </div>
          </>
        ) : (
          <>
            <div
              aria-label={`${managers[0]} v ${managers[1]}, in play. The result shows at full time.`}
              className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2.5 rounded-2xl border border-line/60 bg-panel/60 p-3.5 sm:px-6 sm:py-5"
              role="group"
            >
              <p className="text-[17px] leading-[1.2] font-black [overflow-wrap:anywhere] sm:text-[22px]">
                <PlayerName side={0}>{managers[0]}</PlayerName>
              </p>
              <p aria-hidden="true" className="grid justify-items-center gap-1.5 text-center">
                <span className="rounded-full border border-dashed border-steel-line px-2 py-px text-[10px] font-black tracking-[0.1em] whitespace-nowrap text-steel uppercase">
                  In play
                </span>
                <span className="text-[11.5px] font-bold whitespace-nowrap text-ink-faint">
                  result at full time
                </span>
              </p>
              <p className="text-right text-[17px] leading-[1.2] font-black [overflow-wrap:anywhere] sm:text-[22px]">
                <PlayerName side={1}>{managers[1]}</PlayerName>
              </p>
            </div>
            <p className="rounded-2xl border border-line/60 bg-panel/60 p-5 text-sm leading-relaxed text-ink-dim">
              You&rsquo;re not in this match, so it isn&rsquo;t shown chance by chance. Its result
              and report appear at full time, at the same moment for everyone. Members watch their
              own match and the final live.
            </p>
            <div className="grid gap-7 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:items-start lg:gap-10">
              <div className="grid min-w-0 content-start items-start gap-3.5 sm:grid-cols-2 lg:grid-cols-1">
                {fives.map((five) => (
                  <MidweekFiveList five={five} key={five.userId} noun="line-up" you={false} />
                ))}
              </div>
              {live && (
                <aside className="min-w-0">
                  <MidweekWhyList beforeFullTime why={live.why} />
                </aside>
              )}
            </div>
          </>
        )}
        <div className="flex justify-center">
          <MidweekLivePoller at={now} foot poll />
        </div>
      </article>
    </main>
  );
}
