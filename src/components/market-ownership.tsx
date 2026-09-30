import { IconCollection } from "@/components/icons";
import type { OwnershipDisplayData } from "@/lib/market-ownership";

/**
 * The ownership chip that rides the card: pass it as `LiveCard`'s `badge`
 * (KB-026). It used to be a bordered block under the card that only owned
 * listings had, so the Buy buttons in a grid row stopped lining up.
 *
 * `compact` is the grid tile's short text. There the card sits inside the
 * listing link, whose `aria-label` replaces everything in it, so a compact chip
 * is visual only and the tile speaks `accessibleText` itself, outside the link.
 */
export function MarketOwnership({
  ownership,
  compact = false,
}: {
  ownership: OwnershipDisplayData;
  compact?: boolean;
}) {
  return (
    <p
      aria-hidden={compact || undefined}
      className={`flex max-w-full items-center rounded-full border border-ink/20 bg-board-deep/85 font-black whitespace-nowrap text-ink tabular-nums shadow-[0_2px_6px_rgb(0_0_0/35%)] backdrop-blur-sm [--icon-cutout:var(--color-board-deep)] ${
        compact ? "gap-1.5 py-0.5 pr-2.5 pl-2 text-[0.7rem]" : "gap-2 py-1 pr-3 pl-2.5 text-sm"
      }`}
    >
      <IconCollection
        aria-hidden="true"
        className={`shrink-0 text-brass ${compact ? "h-3 w-3" : "h-4 w-4"}`}
      />
      {compact ? (
        <span className="truncate">{ownership.shortText}</span>
      ) : (
        <>
          <span aria-hidden="true" className="truncate">
            {ownership.text}
          </span>
          <span className="sr-only">{ownership.accessibleText}</span>
        </>
      )}
    </p>
  );
}
