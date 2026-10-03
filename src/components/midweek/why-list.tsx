"use client";

import { useEffect, useId, useState } from "react";
import { archetypeLabel } from "@/game/archetypes";
import { MIDWEEK, PPM } from "@/game/midweek/config";
import { handicapText } from "@/lib/midweek/evening";
import type { WhyCard, WhySide } from "@/lib/midweek/report/types";
import { Chip } from "./chip";
import { PlayerName } from "./player-name";

/**
 * `MidweekWhyList` (HANDOFF "Matches", DR1-5, DR2-3, DR2-6..8): the odds before
 * kick-off, then per side its five cards, strongest first, one compact row
 * each with the card's Power in this match. `Show every factor` opens the five
 * factor boxes under every card, and each box's label explains itself on
 * hover, tap or focus. No tables, so nothing scrolls sideways at any width;
 * bars are SVG with `width` attributes because the CSP blocks inline styles.
 */

/** A card's power in this match: the week's power, fixed at the lock, times this match's Day roll. */
export function matchPower(card: Pick<WhyCard, "powerPpm" | "dayRollPpm">): number {
  return (card.powerPpm / PPM) * (card.dayRollPpm / PPM);
}

/** Strength bands for Power, a heat scale (HANDOFF table): pill text, tint, border, bar, and the band in words. */
const BANDS = [
  {
    min: 1.1,
    word: "strong",
    pill: "border-[#3c5230] bg-[#1c2416] text-[#8bbd6c]",
    bar: "fill-[#8bbd6c]",
  },
  {
    min: 1.0,
    word: "above ordinary",
    pill: "border-[#4a5030] bg-[#22241a] text-[#c3d27c]",
    bar: "fill-[#c3d27c]",
  },
  {
    min: 0.9,
    word: "below ordinary",
    pill: "border-[#5c4419] bg-[#2b1f0a] text-[#e0ac4a]",
    bar: "fill-[#e0ac4a]",
  },
  {
    min: -Infinity,
    word: "weak",
    pill: "border-[#6a3524] bg-[#2a1712] text-[#e8794f]",
    bar: "fill-[#e8794f]",
  },
] as const;

/** The band of a power as shown, so "1.10" on screen is always strong. */
export function powerBand(power: number) {
  const shown = Number(power.toFixed(2));
  return BANDS.find((band) => shown >= band.min)!;
}

const BAR_LOW = 0.5;
const BAR_HIGH = 1.5;

/** The bar's filled share of 0.50–1.50, in percent, never quite empty. */
export function powerBarWidth(power: number): number {
  const share = ((power - BAR_LOW) / (BAR_HIGH - BAR_LOW)) * 100;
  return Math.round(Math.max(2, Math.min(100, share)) * 10) / 10;
}

/** A factor's effect as `+19%`, `−7%` or a dash. */
export function factorEffect(ppm: number): { text: string; trend: "up" | "down" | "flat" } {
  const percent = Math.round((ppm / PPM - 1) * 100);
  if (percent === 0) return { text: "–", trend: "flat" };
  return percent > 0
    ? { text: `+${percent}%`, trend: "up" }
    : { text: `−${Math.abs(percent)}%`, trend: "down" };
}

/** A ppm factor's distance from 1.00 in percent, as written in copy: `25`, `12.5`. */
const percentOff = (ppm: number) => String(Math.round(Math.abs(ppm - PPM) / 1_000) / 10);

const FACTORS = ["Rating", "Form", "Pick", "Fitness", "Day"] as const;
type Factor = (typeof FACTORS)[number];

/** What each factor means (HANDOFF copy, DR2-7), every figure from `MIDWEEK`. */
export const FACTOR_EXPLANATIONS: Record<Factor, string> = {
  Rating: `From the card's OVR: no boost at OVR ${MIDWEEK.ovr.min}, up to +${percentOff(MIDWEEK.ovr.factorMaxPpm)}% at OVR ${MIDWEEK.ovr.max}.`,
  Form: `The Player's form this week, rolled once at the lock: from −${percentOff(MIDWEEK.form.minPpm)}% to +${percentOff(MIDWEEK.form.maxPpm)}%, usually close to zero. Every copy of the Player shares it.`,
  Pick: `Picking against the crowd pays: up to +${percentOff(MIDWEEK.pick.points[0][1])}% when few owners picked this Player, down to −${percentOff(MIDWEEK.pick.points[MIDWEEK.pick.points.length - 1][1])}% when nearly all of them did.`,
  Fitness: `−${percentOff(MIDWEEK.injuredFitnessPpm)}% when the Player is injured; otherwise no change.`,
  Day: `A fresh roll for this match only, between −${percentOff(PPM - MIDWEEK.dayRollSpreadPpm)}% and +${percentOff(PPM + MIDWEEK.dayRollSpreadPpm)}%.`,
};

const factorPpm = (card: WhyCard): Record<Factor, number> => ({
  Rating: card.ovrFactorPpm,
  Form: card.formRollPpm,
  Pick: card.pickFactorPpm,
  Fitness: card.fitnessPpm,
  Day: card.dayRollPpm,
});

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

/** Which factor explanation shows: the one tapped or focused, else the one hovered, unless dismissed. */
type Tips = { open: string | null; hover: string | null; dismissed: string | null };

function FactorStrip({
  card,
  tipKey,
  tips,
  setTips,
}: {
  card: WhyCard;
  tipKey: string;
  tips: Tips;
  setTips: (update: (tips: Tips) => Tips) => void;
}) {
  const baseId = useId();
  const values = factorPpm(card);
  return (
    <dl className="relative col-span-full mt-1 mb-0.5 grid grid-cols-5 gap-[3px] min-[412px]:col-start-2">
      {FACTORS.map((factor) => {
        const key = `${tipKey}:${factor}`;
        const id = `${baseId}-${factor}`;
        const shown = (tips.open ?? tips.hover) === key && tips.dismissed !== key;
        const effect = factorEffect(values[factor]);
        return (
          <div
            className={`grid min-w-0 gap-px rounded-lg py-1 pr-1 pl-[5px] ${shown ? "bg-board-deep/85 outline outline-1 outline-brass" : "bg-board-deep/55"}`}
            key={factor}
            onMouseEnter={() =>
              setTips((t) => ({ open: t.open === key ? key : null, hover: key, dismissed: null }))
            }
            onMouseLeave={() =>
              setTips((t) => ({
                ...t,
                hover: t.hover === key ? null : t.hover,
                dismissed: t.dismissed === key ? null : t.dismissed,
              }))
            }
          >
            <dt className="text-[8.5px] font-black tracking-[0.03em] text-ink-faint uppercase">
              <button
                aria-describedby={id}
                className="cursor-help underline decoration-dotted underline-offset-[3px] focus-visible:rounded-[3px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass"
                onBlur={() => setTips((t) => ({ ...t, open: t.open === key ? null : t.open }))}
                onClick={() => setTips((t) => ({ ...t, open: key, dismissed: null }))}
                onFocus={() => setTips((t) => ({ ...t, open: key, dismissed: null }))}
                type="button"
              >
                {factor}
              </button>
            </dt>
            <dd
              className={`text-[13px] font-extrabold tabular-nums ${effect.trend === "up" ? "text-moss" : effect.trend === "down" ? "text-brick" : "text-ink-faint"}`}
            >
              {effect.text}
            </dd>
            {/* Spans the whole strip, just below it, so it never runs off a narrow screen. */}
            <span
              className={`absolute inset-x-0 top-[calc(100%+6px)] z-10 rounded-[10px] border border-line bg-panel-2 px-2.5 py-2 text-[12.5px] leading-snug font-semibold text-ink shadow-[0_8px_20px_rgb(0_0_0/45%)] ${shown ? "block" : "hidden"}`}
              id={id}
              role="tooltip"
            >
              {FACTOR_EXPLANATIONS[factor]}
            </span>
          </div>
        );
      })}
    </dl>
  );
}

function CardRow({
  card,
  side,
  open,
  tipKey,
  tips,
  setTips,
}: {
  card: WhyCard;
  side: 0 | 1;
  open: boolean;
  tipKey: string;
  tips: Tips;
  setTips: (update: (tips: Tips) => Tips) => void;
}) {
  const power = matchPower(card);
  const band = powerBand(power);
  const notes = [
    card.inGoal && "in goal",
    card.trialist && "trialist",
    card.injured && "injured",
    card.handicapPpm !== PPM && `handicap ×${handicapText(card.handicapPpm)}`,
    card.goals > 0 && plural(card.goals, "goal"),
    card.assists > 0 && plural(card.assists, "assist"),
  ].filter(Boolean);
  return (
    <li className="grid grid-cols-[3.4rem_minmax(0,1fr)] items-center gap-x-2.5 gap-y-[5px] border-b border-line/35 py-[7px]">
      <p
        className={`row-span-2 grid h-full min-h-[34px] place-items-center rounded-[9px] border text-[17px] font-black tabular-nums ${band.pill}`}
      >
        {power.toFixed(2)}
        <span className="sr-only"> power, {band.word}</span>
      </p>
      <p className="min-w-0 text-[14.5px] leading-tight font-bold [overflow-wrap:anywhere]">
        <PlayerName owner={card.label.owner} side={side}>
          {card.label.text}
        </PlayerName>{" "}
        <small className="text-xs font-semibold text-ink-faint">
          {archetypeLabel(card.archetype)} &middot; {card.ovr}
          {notes.length > 0 && (
            <>
              {" "}
              &middot; <b className="font-bold text-ink-dim">{notes.join(", ")}</b>
            </>
          )}
        </small>
      </p>
      <svg
        aria-hidden="true"
        className="block h-[5px] w-full"
        preserveAspectRatio="none"
        viewBox="0 0 100 6"
      >
        <rect className="fill-panel-2" height="6" rx="3" width="100" />
        <rect className={band.bar} height="6" rx="3" width={powerBarWidth(power)} />
        <rect className="fill-ink-dim" height="6" width="0.8" x="49.6" />
      </svg>
      {open && <FactorStrip card={card} setTips={setTips} tipKey={tipKey} tips={tips} />}
    </li>
  );
}

export function MidweekWhyList({
  why,
  beforeFullTime = false,
}: {
  why: readonly [WhySide, WhySide];
  /** A match in play: its goals and assists are left out until full time (ADR-115). */
  beforeFullTime?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [tips, setTips] = useState<Tips>({ open: null, hover: null, dismissed: null });
  const showing = tips.open ?? tips.hover;

  // Escape closes an explanation wherever the pointer or focus is (WCAG 1.4.13).
  useEffect(() => {
    if (!showing) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setTips({ open: null, hover: null, dismissed: showing });
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [showing]);

  const left = Math.round(why[0].winChancePpm / 10_000);
  const chances = [left, 100 - left] as const;
  return (
    <section aria-labelledby="why-h" className="grid gap-[18px]">
      <h2 className="display text-3xl" id="why-h">
        Why
      </h2>
      <div className="grid gap-1.5">
        <p className="text-[10.4px] font-extrabold tracking-[0.15em] text-ink-faint uppercase">
          Chances before kick-off
        </p>
        <svg
          aria-label={`Before kick-off: ${why[0].manager} ${chances[0]}%, ${why[1].manager} ${chances[1]}%`}
          className="block h-3 w-full overflow-hidden rounded-md"
          preserveAspectRatio="none"
          role="img"
          viewBox="0 0 100 10"
        >
          <rect className="fill-team-blue" height="10" width={chances[0]} />
          <rect
            className="fill-team-red opacity-80"
            height="10"
            width={chances[1]}
            x={chances[0]}
          />
        </svg>
        <p aria-hidden="true" className="flex justify-between gap-3 text-[13px]">
          <span>
            <PlayerName side={0}>{why[0].manager}</PlayerName>{" "}
            <b className="tabular-nums">{chances[0]}%</b>
          </span>
          <span className="text-right">
            <b className="tabular-nums">{chances[1]}%</b>{" "}
            <PlayerName side={1}>{why[1].manager}</PlayerName>
          </span>
        </p>
      </div>
      <div className="grid gap-6">
        {why.map((side, s) => (
          <section aria-label={`${side.manager}’s five`} className="grid min-w-0 gap-1" key={s}>
            <h3 className="flex flex-wrap items-baseline gap-x-2 gap-y-1 border-b border-line pb-1.5 text-base font-black">
              <PlayerName side={s as 0 | 1}>{side.manager}</PlayerName>
              <small className="text-[12.5px] font-bold text-ink-faint tabular-nums">
                {chances[s]}% before kick-off
              </small>
              {side.auto && <Chip tone="auto">Auto squad</Chip>}
              {side.keeperless && <Chip tone="warn">No keeper</Chip>}
              {side.shortLines.map(({ line, short }) => (
                <Chip key={line} tone="warn">
                  {line} {short} short
                </Chip>
              ))}
            </h3>
            <ul className="grid">
              {side.cards
                .map((card, slot) => ({ card, slot }))
                .sort((a, b) => matchPower(b.card) - matchPower(a.card) || a.slot - b.slot)
                .map(({ card, slot }) => (
                  <CardRow
                    card={card}
                    key={slot}
                    open={open}
                    setTips={setTips}
                    side={s as 0 | 1}
                    tipKey={`${s}:${slot}`}
                    tips={tips}
                  />
                ))}
            </ul>
          </section>
        ))}
      </div>
      <p>
        <button
          aria-expanded={open}
          className="inline-flex min-h-11 items-center justify-center rounded-[10px] border border-line bg-panel/70 px-3.5 text-sm font-black whitespace-nowrap text-ink hover:border-brass"
          onClick={() => {
            setOpen((value) => !value);
            setTips({ open: null, hover: null, dismissed: null });
          }}
          type="button"
        >
          {open ? "Hide the factors" : "Show every factor"}
        </button>
      </p>
      <p className="text-xs leading-relaxed text-ink-faint">
        Power is a card&rsquo;s strength in this match; 1.00, the tick on each bar, is an ordinary
        card. Green is stronger than that, amber and orange weaker. It multiplies the card&rsquo;s
        rating, form, pick, fitness and this match&rsquo;s day roll
        {open && "; hover or tap a factor to see what it means"}.
        {beforeFullTime && " Goals and assists are added at full time."} Who picked whom is on the
        bracket page after the final.
      </p>
    </section>
  );
}
