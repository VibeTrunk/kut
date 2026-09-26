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
