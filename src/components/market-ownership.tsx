import type { OwnershipDisplayData } from "@/lib/market-ownership";

export function MarketOwnership({
  ownership,
  compact = false,
}: {
  ownership: OwnershipDisplayData;
  compact?: boolean;
}) {
  return (
    <p
      className={
        compact
          ? "flex min-h-9 items-center justify-center rounded-lg border border-brass/30 bg-brass/10 px-2 py-1.5 text-center text-[0.65rem] font-bold leading-tight text-ink-dim"
          : "w-fit rounded-xl border border-brass/30 bg-brass/10 px-3 py-2 text-sm font-bold text-ink-dim"
      }
    >
      <span aria-hidden="true">{ownership.text}</span>
      <span className="sr-only">{ownership.accessibleText}</span>
    </p>
  );
}
