import type { LiveCardPlayer } from "@/components/live-card";
import { formatDate } from "@/lib/format";

/**
 * Bars are drawn as SVG geometry rather than a div with a percentage width:
 * production CSP is `style-src 'self' 'nonce-…'`, which strips the inline
 * `style` attribute a computed width would need, and Tailwind cannot generate
 * an arbitrary-value class from a runtime number.
 */

type Attrs = Pick<LiveCardPlayer, "pac" | "sho" | "pas" | "dri" | "def" | "phy">;

const ATTRS: [label: string, key: keyof Attrs][] = [
  ["PAC", "pac"],
  ["SHO", "sho"],
  ["PAS", "pas"],
  ["DRI", "dri"],
  ["DEF", "def"],
  ["PHY", "phy"],
];

export function AttributeBars({ player }: { player: Attrs }) {
  return (
    <dl className="grid grid-cols-2 gap-x-8 gap-y-5 sm:grid-cols-3">
      {ATTRS.map(([label, key]) => {
        const value = player[key];
        return (
          <div className="space-y-2" key={key}>
            <div className="flex items-baseline justify-between gap-2">
              <dt className="text-[0.65rem] font-extrabold uppercase tracking-[0.14em] text-ink-faint">{label}</dt>
              <dd className="text-xl font-black tabular-nums text-ink">{value}</dd>
            </div>
            <svg
              aria-hidden="true"
              className="block h-1 w-full"
              preserveAspectRatio="none"
              viewBox="0 0 100 4"
            >
              <rect className="fill-line" height="4" rx="2" width="100" x="0" y="0" />
              <rect className="fill-brass" height="4" rx="2" width={Math.max(0, Math.min(100, value))} x="0" y="0" />
            </svg>
          </div>
        );
      })}
    </dl>
  );
}

export type RatingSnapshot = { week_start: string; live_ovr: number };

/** Last few published weeks of a player's live rating. */
export function RatingHistory({ snapshots }: { snapshots: RatingSnapshot[] }) {
  if (snapshots.length < 2) return null;

  const values = snapshots.map((snapshot) => snapshot.live_ovr);
  const floor = Math.min(...values) - 3;
  const ceiling = Math.max(...values) + 2;
  const span = Math.max(1, ceiling - floor);

  const slot = 14;
  const barWidth = 9;
  const height = 44;
  const width = snapshots.length * slot;

  return (
    <div className="space-y-3">
      <p className="text-[0.65rem] font-extrabold uppercase tracking-[0.15em] text-ink-faint">
        Rating over the last {snapshots.length} published weeks
      </p>
      <div className="flex items-end gap-3">
        <svg aria-hidden="true" className="h-11 w-full max-w-xs" preserveAspectRatio="none" viewBox={`0 0 ${width} ${height}`}>
          {snapshots.map((snapshot, index) => {
            const barHeight = Math.max(2, ((snapshot.live_ovr - floor) / span) * height);
            const latest = index === snapshots.length - 1;
            return (
              <rect
                className={latest ? "fill-brass" : "fill-brass/25"}
                height={barHeight}
                key={snapshot.week_start}
                rx="2"
                width={barWidth}
                x={index * slot}
                y={height - barHeight}
              />
            );
          })}
        </svg>
        <p className="shrink-0 text-2xl font-black tabular-nums leading-none text-brass">{values[values.length - 1]}</p>
      </div>
      <p className="text-xs font-semibold text-ink-faint">
        {formatDate(snapshots[0].week_start)} &ndash; {formatDate(snapshots[snapshots.length - 1].week_start)}
      </p>
    </div>
  );
}
