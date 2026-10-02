import type { FiveView } from "@/lib/midweek/evening";
import { Chip } from "./chip";
import { MidweekMiniCard } from "./mini-card";

/**
 * `MidweekFiveList` (HANDOFF "Midweek: the evening", Evening-Draw): one entered
 * five as a neutral panel, the member's own outlined in brass. Per card the
 * mini card (34 × 48, no OVR label), the name, and `archetype · tier · OVR`
 * with `in goal`. Nothing about form, pick or chances: those come at round 1's
 * kick-off (ADR-105). A panel sits at its own height.
 */
export function MidweekFiveList({
  five,
  you,
  noun = "five",
}: {
  five: FiveView;
  you: boolean;
  /** "line-up" where the Why on the same page already names each side's five. */
  noun?: string;
}) {
  return (
    <section
      aria-label={`${five.manager}’s ${noun}`}
      className={`grid content-start gap-2 rounded-[14px] border bg-panel/50 p-3 ${you ? "border-brass/55" : "border-line/60"}`}
    >
      <p className="flex flex-wrap items-center gap-1.5 font-black">
        {five.manager}
        {you && <Chip tone="you">You</Chip>}
        {five.auto && <Chip tone="auto">Auto squad</Chip>}
      </p>
      <ul className="grid gap-1.5">
        {five.cards.map((card) => (
          <li
            className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2.5 text-[13.5px]"
            key={card.slot}
          >
            {card.mini ? (
              <MidweekMiniCard
                injured={card.mini.injured}
                ovr={card.mini.ovr}
                rarityTier={card.mini.rarityTier}
                small
              />
            ) : (
              <MidweekMiniCard ovr={30} small variant="trialist" />
            )}
            <span className="min-w-0">
              <span className="block truncate">{card.name}</span>
              <small className="block text-[11.5px] text-ink-faint">{card.detail}</small>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
