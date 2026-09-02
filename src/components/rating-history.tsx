import { RARITY_BANDS, getRarityTier, type RarityTier } from "@/game/rating-engine";

export type RatingSnapshot = { week_start: string; live_ovr: number; rarity_tier?: RarityTier };

type RatingHistoryProps = {
  snapshots: RatingSnapshot[];
  goalsByWeek: Map<string, number>;
  playerName: string;
};

const TIER_COLORS: Record<RarityTier, string> = {
  common: "#e9e5d9", bronze: "#ecd8b1", silver: "#e3e8eb", gold: "#e2c069", holo: "#e6dcf6", elite: "#e9c46a",
};

export function ratingDomain(values: number[]) {
  const lowest = RARITY_BANDS.findIndex((band) => band.tier === getRarityTier(Math.min(...values)));
  const highest = RARITY_BANDS.findIndex((band) => band.tier === getRarityTier(Math.max(...values)));
  return RARITY_BANDS.slice(Math.max(0, lowest - 1), Math.min(RARITY_BANDS.length, highest + 2));
}

function shortDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, day)));
}

export function RatingHistory({ snapshots, goalsByWeek, playerName }: RatingHistoryProps) {
  if (snapshots.length === 0) {
    return <p className="text-sm font-semibold text-ink-faint">{playerName}&rsquo;s rating history starts with the next published session.</p>;
  }

  const values = snapshots.map((snapshot) => snapshot.live_ovr);
  const bands = ratingDomain(values);
  const domainMin = bands[0].min;
  const domainMax = bands[bands.length - 1].max;
  const width = 560;
  const height = 230;
  const left = 64;
  const right = 12;
  const top = 12;
  const bottom = 51;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const x = (index: number) => snapshots.length === 1 ? left + plotWidth / 2 : left + (index * plotWidth) / (snapshots.length - 1);
  const y = (value: number) => top + ((domainMax - value) / (domainMax - domainMin + 1)) * plotHeight;
  const points = snapshots.map((snapshot, index) => `${x(index)},${y(snapshot.live_ovr)}`).join(" ");
  const latest = snapshots[snapshots.length - 1];
  const nextBand = RARITY_BANDS.find((band) => band.min > latest.live_ovr);
  const range = `${snapshots.length} published ${snapshots.length === 1 ? "week" : "weeks"}, ${shortDate(snapshots[0].week_start)} – ${shortDate(latest.week_start)}`;

  return (
    <section className="space-y-3" aria-labelledby="rating-history-title">
      <div className="flex items-end justify-between gap-4">
        <h2 id="rating-history-title" className="max-w-[15rem] text-[0.65rem] font-extrabold uppercase tracking-[0.15em] text-ink-faint">
          Rating over {snapshots.length} published {snapshots.length === 1 ? "week" : "weeks"}
        </h2>
        <p className="text-4xl font-black tabular-nums leading-none text-brass">{latest.live_ovr}<span className="ml-1 text-[0.65rem] uppercase tracking-[0.16em]">now</span></p>
      </div>
      <svg className="block h-auto w-full" role="img" aria-label={`${playerName}: ${range}, latest rating ${latest.live_ovr}.`} viewBox={`0 0 ${width} ${height}`}>
        {bands.map((band) => {
          const bandTop = y(band.max);
          const bandBottom = y(band.min - 1);
          return <g key={band.tier}>
            <rect fill={TIER_COLORS[band.tier]} fillOpacity="0.12" height={bandBottom - bandTop} width={plotWidth} x={left} y={bandTop} />
            <line className="stroke-line/60" strokeWidth="1" x1={left} x2={width - right} y1={bandBottom} y2={bandBottom} />
            <text className="fill-ink-faint text-[10px] font-bold uppercase tracking-[0.12em]" x="2" y={bandTop + 14}>{band.tier} {band.min}</text>
          </g>;
        })}
        {snapshots.length > 1 && <polyline fill="none" points={points} stroke="#e0ac4a" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />}
        {snapshots.map((snapshot, index) => {
          const showLabel = snapshots.length <= 10 || index === 0 || index === snapshots.length - 1 || index % 4 === 0;
          const goals = goalsByWeek.get(snapshot.week_start) ?? 0;
          return <g key={snapshot.week_start}>
            <title>{`${shortDate(snapshot.week_start)}: ${snapshot.live_ovr} OVR${goals ? `, ${goals} goal${goals === 1 ? "" : "s"}` : ""}`}</title>
            <circle cx={x(index)} cy={y(snapshot.live_ovr)} fill={index === snapshots.length - 1 ? "#e0ac4a" : "#19160f"} r={index === snapshots.length - 1 ? "5" : "3.5"} stroke="#e0ac4a" strokeWidth="2" />
            {showLabel && <text className="fill-ink-faint text-[10px] font-bold" textAnchor="middle" x={x(index)} y={height - 27}>{shortDate(snapshot.week_start)}</text>}
            {goals > 0 && <g>
              <title>{`${goals} goal${goals === 1 ? "" : "s"} in this week`}</title>
              <path d={`M ${x(index) - 5} ${height - 18} L ${x(index) + 5} ${height - 18} L ${x(index)} ${height - 27} Z`} fill="#e0ac4a" />
              <text className="fill-brass text-[10px] font-bold" textAnchor="middle" x={x(index)} y={height - 4}>{goals}</text>
            </g>}
          </g>;
        })}
      </svg>
      {snapshots.length === 1 && nextBand && <p className="text-sm font-bold text-brass">{nextBand.min - latest.live_ovr} OVR from {nextBand.tier[0].toUpperCase() + nextBand.tier.slice(1)}.</p>}
      <p className="text-xs leading-relaxed text-ink-faint">{range}. Goals feed Form, the temporary part of this line. Ratings are recorded once per football week and are not revised if attendance is corrected later.</p>
      <table className="sr-only"><caption>{playerName}&rsquo;s rating history</caption><thead><tr><th>Week</th><th>OVR</th><th>Goals</th></tr></thead><tbody>{snapshots.map((snapshot) => <tr key={snapshot.week_start}><td>{shortDate(snapshot.week_start)}</td><td>{snapshot.live_ovr}</td><td>{goalsByWeek.get(snapshot.week_start) ?? 0}</td></tr>)}</tbody></table>
    </section>
  );
}
