import { COMPETE_STATUS, type CompeteStatus } from "@/lib/nav/routes";

const TONE: Record<CompeteStatus, string> = {
  pick: "bg-brass text-ink-on-accent",
  live: "bg-live text-ink-on-live",
};

const SHAPE = {
  // On the bottom bar's icon, anchored to its right edge, so it can never push
  // the fifth tab past a 320 px screen.
  bar: "absolute -top-[7px] -right-[18px] border-2 border-board-deep px-[5px] py-px text-[8.5px]",
  // After the label: the desktop bar and the Midweek section tab.
  inline: "px-[7px] py-px text-[10px]",
};

/**
 * Compete's status badge (ADR-107, HANDOFF "Navigation"): `Pick` in brass,
 * `Live` in live red. The chip is what the eye reads; screen readers get one
 * sentence instead, so the link reads "Compete Pick. Midweek Madness: you
 * haven't picked your five". The `inline` chip brings that sentence along; on
 * the bottom bar the chip sits before the label, so the bar places
 * `CompeteBadgeWords` after the label itself.
 */
export function CompeteBadge({
  status,
  variant,
}: {
  status: CompeteStatus;
  variant: keyof typeof SHAPE;
}) {
  const chip = (
    <span
      aria-hidden="true"
      className={`rounded-full leading-[1.3] font-black tracking-[0.04em] whitespace-nowrap uppercase ${SHAPE[variant]} ${TONE[status]}`}
    >
      {COMPETE_STATUS[status].text}
    </span>
  );
  if (variant === "bar") return chip;
  return (
    <>
      {chip}
      <CompeteBadgeWords status={status} />
    </>
  );
}

/** The badge's words for screen readers, after the tab's label. */
export function CompeteBadgeWords({ status }: { status: CompeteStatus }) {
  const { text, label } = COMPETE_STATUS[status];
  return <span className="sr-only">{` ${text}. ${label}`}</span>;
}
