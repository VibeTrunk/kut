import type { LiveCardPlayer } from "@/components/live-card";

type Tier = LiveCardPlayer["rarityTier"];

/** The tier-chip palette (`.tier-chip` in globals.css), as utilities. */
const TIER_CLASS: Record<Tier, string> = {
  common: "bg-[#e9e5d9] text-[#3b3830]",
  bronze: "bg-[#ecd8b1] text-[#6d3f1a]",
  silver: "bg-[#e3e8eb] text-[#3a444c]",
  gold: "bg-[linear-gradient(140deg,#f7e7b2,#e2c069)] text-[#6e500f]",
  holo: "bg-[linear-gradient(140deg,#d9f2ee,#e6dcf6_45%,#f5dcf0)] text-[#4a3a70]",
  elite:
    "bg-[radial-gradient(120%_100%_at_50%_0%,#2c2314,#0f0c08)] text-[#e9c46a] shadow-[inset_0_0_0_1px_rgb(233_196_106/45%)]",
};

/** The plaster band across an injured Player's mini (the cast, ADR-084). */
const PLASTER =
  "after:absolute after:-inset-x-1 after:top-[58%] after:h-2 after:-rotate-[24deg] after:bg-[linear-gradient(90deg,#e0b58a_0_38%,#f3dcc0_38%_62%,#e0b58a_62%)] after:shadow-[0_1px_1px_rgb(0_0_0/25%)] after:content-['']";

type MidweekMiniCardProps =
  | { variant?: "card"; rarityTier: Tier; ovr: number; injured: boolean; small?: boolean }
  | { variant: "trialist" | "empty" | "unknown"; small?: boolean; ovr?: number };

/**
 * `MidweekMiniCard`: rarity, OVR and the cast in 46 px, because `LiveCard` is
 * unreadable below about 140 px (§48). Decorative: the row beside it carries
 * the words.
 */
export function MidweekMiniCard(props: MidweekMiniCardProps) {
  const size = props.small ? "w-[34px]" : "w-[46px]";
  const base = `relative grid aspect-[5/7] ${size} flex-none place-items-center content-center overflow-hidden rounded-md`;
  const number = props.small ? "text-[13px]" : "text-[17px]";

  if ("rarityTier" in props) {
    return (
      <span
        aria-hidden="true"
        className={`${base} shadow-[0_2px_6px_rgb(0_0_0/45%)] ${TIER_CLASS[props.rarityTier]} ${props.injured ? PLASTER : ""}`}
      >
        <b className={`${number} leading-none font-black tracking-[-0.02em]`}>{props.ovr}</b>
        {!props.small && (
          <small className="text-[7px] font-black tracking-[0.12em] opacity-80">OVR</small>
        )}
      </span>
    );
  }
  if (props.variant === "trialist" || props.variant === "unknown") {
    return (
      <span
        aria-hidden="true"
        className={`${base} border-[1.5px] border-dashed border-line bg-[repeating-linear-gradient(135deg,rgb(74_64_48/45%)_0_4px,transparent_4px_8px)] text-ink-faint`}
      >
        <b className="text-[13px] leading-none font-black">
          {props.variant === "unknown" ? "?" : (props.ovr ?? "")}
        </b>
        {props.variant === "trialist" && !props.small && (
          <small className="text-[7px] font-black tracking-[0.12em] opacity-80">TRI</small>
        )}
      </span>
    );
  }
  return (
    <span
      aria-hidden="true"
      className={`${base} border-[1.5px] border-dashed border-brass text-brass`}
    >
      <b className="text-[22px] leading-none font-normal">+</b>
    </span>
  );
}
