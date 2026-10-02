import type { ReactNode } from "react";

/**
 * The small word chips of the Midweek results pages (`.chip` in the mockups):
 * "You", "Auto", "✓ Through", "Out", "No keeper", "Injured". A chip always
 * carries a word, so colour is never the only signal.
 */
const TONE = {
  neutral: "border-line text-ink-dim",
  you: "border-brass bg-brass text-ink-on-accent",
  auto: "border-steel-line text-steel",
  won: "border-moss-line bg-moss-bg text-moss",
  out: "border-brick-line bg-brick-bg text-brick",
  warn: "border-warning-line bg-warning-bg text-warning",
  plaster:
    "border-[#6b5238] bg-[#2e2217] text-[#e8c49c] before:h-1.5 before:w-3 before:flex-none before:-rotate-[20deg] before:rounded-[3px] before:bg-[linear-gradient(90deg,#e0b58a_0_35%,#f3dcc0_35%_65%,#e0b58a_65%)] before:content-['']",
} as const;

export type ChipTone = keyof typeof TONE;

export function Chip({ tone = "neutral", children }: { tone?: ChipTone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-[5px] rounded-full border px-2 py-0.5 text-[10.5px] leading-normal font-extrabold tracking-[0.08em] whitespace-nowrap uppercase ${TONE[tone]}`}
    >
      {children}
    </span>
  );
}

/**
 * The `Live` marker (`.ux-live` in the mockups): live red with a dot that
 * pulses unless the member asked for reduced motion. The word carries it.
 */
export function LiveMarker({ children = "Live" }: { children?: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-team-red-line bg-team-red-bg px-[9px] py-0.5 text-[10.5px] font-black tracking-[0.1em] whitespace-nowrap text-live uppercase">
      <span
        aria-hidden="true"
        className="h-[7px] w-[7px] rounded-full bg-live shadow-[0_0_0_3px_rgb(255_128_145/25%)] motion-safe:animate-pulse"
      />
      {children}
    </span>
  );
}
