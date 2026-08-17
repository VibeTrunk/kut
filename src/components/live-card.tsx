export type LiveCardPlayer = {
  id: string;
  displayName: string;
  archetype: string;
  liveOvr: number;
  pac: number;
  sho: number;
  pas: number;
  dri: number;
  def: number;
  phy: number;
  rarityTier: "common" | "bronze" | "silver" | "gold" | "holo" | "elite";
  photoUrl?: string | null;
};

type LiveCardProps = {
  player: LiveCardPlayer;
  size?: "grid" | "detail";
};

const attributes = (player: LiveCardPlayer) => [
  ["PAC", player.pac],
  ["SHO", player.sho],
  ["PAS", player.pas],
  ["DRI", player.dri],
  ["DEF", player.def],
  ["PHY", player.phy],
] as const;

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export function LiveCard({ player, size = "grid" }: LiveCardProps) {
  return (
    <article className="live-card" data-rarity={player.rarityTier} data-size={size}>
      <div aria-hidden="true" className="live-card__texture" />
      <div aria-hidden="true" className="live-card__shine" />

      <div aria-hidden="true" className="live-card__pennant">
        <span className={`live-card__tier-icon live-card__tier-icon--${player.rarityTier}`} />
        <span>{player.rarityTier}</span>
      </div>

      <header className="live-card__header">
        <p aria-label={`${player.liveOvr} overall`} className="live-card__ovr">
          {player.liveOvr}
          <span>OVR</span>
        </p>
      </header>

      {player.photoUrl ? (
        <div className="live-card__frame" style={{ backgroundImage: `url("${player.photoUrl}")` }}>
          <span aria-hidden="true" className="live-card__tape" />
        </div>
      ) : (
        <div className="live-card__frame live-card__frame--jersey">
          <span aria-hidden="true" className="live-card__tape" />
          <span className="live-card__jersey-initials">{initials(player.displayName)}</span>
        </div>
      )}

      <div className="live-card__identity">
        <h2>{player.displayName}</h2>
        <p>{player.archetype.replaceAll("_", " ")}</p>
      </div>

      <dl className="live-card__stats">
        {attributes(player).map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </article>
  );
}
