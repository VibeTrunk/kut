import { archetypeLabel } from "@/game/archetypes";
import { CardTilt } from "@/components/card-tilt";
import { injuryCast } from "@/lib/injury-cast";

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
  /** Optional week-over-week OVR change. A positive value renders a small "▲ +N" pill. */
  trend?: number | null;
  /** The Player is in injury mode (ADR-082); the card goes into a signed plaster cast (ADR-084). */
  injured?: boolean;
};

const TIER_LABEL: Record<LiveCardPlayer["rarityTier"], string> = {
  common: "Common",
  bronze: "Bronze",
  silver: "Silver",
  gold: "Gold",
  holo: "Holo",
  elite: "Elite",
};

const attributes = (player: LiveCardPlayer) =>
  [
    ["PAC", player.pac],
    ["SHO", player.sho],
    ["PAS", player.pas],
    ["DRI", player.dri],
    ["DEF", player.def],
    ["PHY", player.phy],
  ] as const;

/** Longest surname that still sets legibly on the shoulder arc. */
const ARC_LIMIT = 14;
/** Past this the arc has to drop two points to fit. */
const ARC_TIGHT = 10;

function surname(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts.length > 0 ? parts[parts.length - 1] : name.trim();
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

/** Two plasters crossed over the squad number (injured shirt back). */
function ShirtPlasters() {
  return (
    <>
      {[32, -32].map((angle) => (
        <g key={angle} transform={`rotate(${angle} 100 126)`}>
          <rect fill="#e0b58a" height="18" rx="9" width="84" x="58" y="117" />
          <rect fill="#f3dcc0" height="14" rx="3" width="24" x="88" y="119" />
          {[68, 80, 120, 132].map((cx) => (
            <circle cx={cx} cy="126" fill="#b9895c" key={cx} r="0.9" />
          ))}
        </g>
      ))}
    </>
  );
}

/**
 * The no-photo card (ADR-043): the back of a shirt carrying the player's
 * surname across the shoulders and their live rating as the squad number.
 * Most of the club never uploads a picture, so this is the default card face
 * rather than an error state — and unlike a monogram it differs per player.
 * Injured, the shirt lifts so the number clears the signature band, and two
 * plasters cross over the number (ADR-084).
 */
function ShirtBack({ player, injured }: { player: LiveCardPlayer; injured: boolean }) {
  const name = surname(player.displayName).toUpperCase();
  // Distinct per card so duplicate arcs on one page cannot collide.
  const arcId = `shirt-arc-${player.id}`;

  return (
    <>
      <svg aria-hidden="true" preserveAspectRatio="xMidYMid slice" viewBox="0 0 200 200">
        <defs>
          <path d="M42,74 Q100,54 158,74" id={arcId} />
        </defs>
        <rect className="live-card__shirt-ground" height="200" width="200" x="0" y="0" />
        <g transform={injured ? "translate(0 -14)" : undefined}>
          <path
            className="live-card__shirt-body"
            d="M64,28 L84,32 Q100,48 116,32 L136,28 L164,44 L180,92 L150,108 L144,94 L144,200 L56,200 L56,94 L50,108 L20,92 L36,44 Z"
          />
          <path className="live-card__shirt-seam" d="M56,94 L56,200 M144,94 L144,200" fill="none" />
          <text className="live-card__shirt-name" fontSize={name.length > ARC_TIGHT ? 11 : 13}>
            <textPath href={`#${arcId}`} startOffset="50%" textAnchor="middle">
              {name}
            </textPath>
          </text>
          <text
            className="live-card__shirt-number"
            dominantBaseline="middle"
            fontSize="62"
            textAnchor="middle"
            x="100"
            y="126"
          >
            {player.liveOvr}
          </text>
          {injured && <ShirtPlasters />}
        </g>
      </svg>
      <span aria-hidden="true" className="live-card__shirt-halftone" />
    </>
  );
}

/** Fallback for surnames too long to set on the arc: a plain drawn bust. */
function BustFallback({ player }: { player: LiveCardPlayer }) {
  return (
    <>
      <svg aria-hidden="true" preserveAspectRatio="xMidYMid slice" viewBox="0 0 200 200">
        <rect className="live-card__shirt-ground" height="200" width="200" x="0" y="0" />
        <circle className="live-card__bust" cx="100" cy="72" r="32" />
        <path
          className="live-card__bust"
          d="M40,178 C40,140 66,120 100,120 C134,120 160,140 160,178"
        />
      </svg>
      <span aria-hidden="true" className="live-card__shirt-halftone" />
      <span className="sr-only">{initials(player.displayName)}</span>
    </>
  );
}

/**
 * What the club wrote on the cast: a corner plaster, two signatures and a
 * doodle, fixed per Player. Only ever lines from the fixed pool, never the
 * admin injury note (ADR-084).
 */
function InjuryCast({ playerId }: { playerId: string }) {
  const cast = injuryCast(playerId);
  return (
    <div aria-hidden="true" className="live-card__cast">
      <span className="live-card__tape" />
      <span className="live-card__sig live-card__sig--1" data-ink={cast.ink}>
        {cast.first}
      </span>
      <span className="live-card__sig live-card__sig--2">{cast.second}</span>
      <svg className="live-card__doodle" data-kind={cast.doodle} viewBox="0 0 40 40">
        {cast.doodle === "heart" ? (
          <path d="M20,34 C8,25 4,19 4,13.5 C4,8.5 8,5 12.5,5 C16,5 18.5,7 20,10 C21.5,7 24,5 27.5,5 C32,5 36,8.5 36,13.5 C36,19 32,25 20,34 Z" />
        ) : (
          <>
            <circle cx="20" cy="20" r="16" />
            <path d="M13,16 L13,17 M27,16 L27,17 M12,25 Q20,31 28,25" />
          </>
        )}
      </svg>
    </div>
  );
}

/** The bandage clip, straddling the art/nameplate seam. */
function BandageClip() {
  return (
    <svg aria-hidden="true" className="live-card__clip" viewBox="0 0 34 16">
      <rect fill="#b7b9bb" height="10" rx="2" stroke="#7d8184" width="32" x="1" y="3" />
      <path
        d="M4,3V0.5M9,3V0.5M25,3V0.5M30,3V0.5M4,13V15.5M9,13V15.5M25,13V15.5M30,13V15.5M13,8H21"
        stroke="#7d8184"
        strokeLinecap="round"
        strokeWidth="1.3"
      />
    </svg>
  );
}

export function LiveCard({ player, size = "grid", trend, injured = false }: LiveCardProps) {
  const tier = player.rarityTier;

  const card = (
    <article
      className="live-card"
      data-injured={injured || undefined}
      data-rarity={tier}
      data-size={size}
    >
      <span aria-hidden="true" className="live-card__glow" />

      <div className="live-card__art">
        <div aria-hidden="true" className="live-card__portrait">
          {player.photoUrl ? (
            /* Plain <img>, not next/image: photos are already cropped to 512px on
               upload, and avoiding the /_next/image loader keeps the CSP simple. */
            /* eslint-disable-next-line @next/next/no-img-element */
            <img alt="" decoding="async" loading="lazy" src={player.photoUrl} />
          ) : surname(player.displayName).length > ARC_LIMIT ? (
            <BustFallback player={player} />
          ) : (
            <ShirtBack injured={injured} player={player} />
          )}
        </div>
        <span aria-hidden="true" className="live-card__topscrim" />
        <span aria-hidden="true" className="live-card__scrim" />

        <p aria-label={`${player.liveOvr} overall`} className="live-card__ovr">
          <b>{player.liveOvr}</b>
          <span aria-hidden="true">OVR</span>
          {injured && (
            <em aria-hidden="true" className="live-card__cast-note">
              set in plaster
            </em>
          )}
        </p>

        {typeof trend === "number" && trend > 0 && (
          <p className="live-card__trend">
            <span aria-hidden="true">&#9650;</span> +{trend}{" "}
            <span className="live-card__trend-unit">OVR this week</span>
          </p>
        )}

        {/* After both scrims and before the pennant: they share z-index 3, so
            DOM order puts the pennant over the corner plaster. */}
        {injured && <InjuryCast playerId={player.id} />}

        <span aria-hidden="true" className="live-card__pennant">
          <span className={`live-card__tier-icon live-card__tier-icon--${tier}`} />
        </span>
      </div>

      <div className="live-card__plate">
        {injured && <BandageClip />}
        <h2>{player.displayName}</h2>
        <p>
          {archetypeLabel(player.archetype)} &middot; {TIER_LABEL[tier]}
        </p>
        {injured && (
          <span className="sr-only">Injured: the rating is protected during recovery</span>
        )}
      </div>

      <dl className="live-card__stats">
        {attributes(player).map(([label, value]) => {
          const struck = injured && label === "PAC";
          return (
            <div key={label}>
              <dt>{label}</dt>
              <dd className={struck ? "live-card__struck" : undefined}>
                {value}
                {struck && (
                  <span aria-hidden="true" className="live-card__hop">
                    hop
                  </span>
                )}
              </dd>
            </div>
          );
        })}
      </dl>

      <span aria-hidden="true" className="live-card__film" />
      <span aria-hidden="true" className="live-card__sheen" />
      <span aria-hidden="true" className="live-card__grain" />
      <span aria-hidden="true" className="live-card__frame" />
    </article>
  );

  // Only Elite pays for the client bundle: every other tier stays a pure
  // server component.
  return tier === "elite" ? <CardTilt>{card}</CardTilt> : card;
}
