/** The disc's sizes (DR3 HANDOFF §1): the grid, the list, the Why list, the per-match chips. */
const SIZES = {
  lg: "h-[52px] w-[52px] border-[1.5px] text-[19px]",
  md: "h-11 w-11 border-[1.5px] text-base",
  sm: "h-[38px] w-[38px] border-[1.5px] text-sm",
  xs: "h-[30px] w-[30px] border text-[11.5px]",
} as const;

/** A rating as one decimal: `7.0`, never `7`. */
export const ratingText = (rating: number) => rating.toFixed(1);

/**
 * `MidweekRatingDisc` (DR3-4): a rating is never coloured. A neutral circle,
 * so nobody reads it against Power's tinted bands: different shape, side,
 * range and colour. Screen readers hear `rated 7.5 out of 10 {for the night}`.
 */
export function MidweekRatingDisc({
  rating,
  size = "md",
  context,
}: {
  rating: number;
  size?: keyof typeof SIZES;
  /** `for the night`, `for this match`, `against Eline`. */
  context: string;
}) {
  return (
    <span
      className={`inline-grid flex-none place-items-center rounded-full border-ink-dim bg-panel-2 font-black tracking-[-0.01em] text-ink tabular-nums ${SIZES[size]}`}
    >
      <span aria-hidden="true">{ratingText(rating)}</span>
      <span className="sr-only">
        rated {ratingText(rating)} out of 10 {context}
      </span>
    </span>
  );
}
