import type { LiveCardPlayer } from "@/components/live-card";

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
