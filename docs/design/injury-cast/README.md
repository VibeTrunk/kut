# Injury mode card — the plaster cast

**Status:** designed and approved 2026-09-23; built 2026-09-23 (ADR-084) in
`src/components/live-card.tsx`, `src/app/globals.css` and
`src/lib/injury-cast.ts`. The build prompt is
[`BUILD_PROMPT.md`](BUILD_PROMPT.md). Now that it is built, the app wins over
this file where they disagree.

**Visual source of truth:** the design canvas
<https://claude.ai/artifact/JJ1XHAugHcpSrQAkkyHFdb>, in the section
"A · The plaster cast, ready to build". Its artboards are the PlasterCard
component, detail size (a shirt back, a bright photo and a dark photo), grid
size, and the handoff spec and code. The canvas is private to the owner. This
file carries everything the build needs, so the canvas is a visual check,
not a dependency. Where the two disagree, this file wins.

As in [`../README.md`](../README.md): the canvas reproduces `LiveCard` in plain
HTML so it can stand alone. **Build it in the real component**
(`src/components/live-card.tsx` + `src/app/globals.css`), not by copying
the canvas markup.

## What it is

While a Player is in injury mode (ADR-082), every `LiveCard` rendered with
`injured` swaps its tier material for a **signed plaster cast**. It replaces
today's small "🩹 Injured" chip. The card skeleton is unchanged: OVR top-left,
tier pennant top-right, art, nameplate and ruled stat table. The change is
one data attribute, CSS and some decorative markup. **There is no database,
RPC, economy or rating change, and no migration.**

## The one rule

**The cast is the card, not the photo.** Writing goes only where there is
plaster:

- the **signature band**, the bottom 40% of the art, where the picture fades
  into solid plaster;
- the nameplate;
- the stat table.

The top 60% of the art is where a face sits in an uploaded photo. It carries
only the "set in plaster" note under OVR and one corner plaster. That is what
makes the design work over any custom photo.

## What changes on the card

1. `data-injured` on the `<article>`. The "Injured" chip (`.live-card__injured`
   markup and CSS) is deleted.
2. **Plaster stock** (a gauze weave) replaces the tier's stock. The nameplate
   and the pennant become an **elastic bandage**.
3. **"set in plaster"** in blue ballpoint under "OVR".
4. A **corner plaster** across the art's top-right corner, under the pennant,
   "taping the picture down".
5. **Signature band:** two signatures and one doodle, fixed per Player.
6. A **bandage clip** straddling the art/nameplate seam, top-right.
7. **PAC crossed out** in red marker, with "hop" written beside it. The value
   stays legible.
8. **Shirt back only:** the shirt lifts 14 viewBox units so the number clears
   the band, and two crossed plasters go over the number.
9. **Tier effects off:** sheen, film, glow and foil animation. Elite keeps its
   pointer tilt (`CardTilt`).

## Decisions

- **Rarity still reads.** The plaster replaces all six materials, including
  Elite's inverted lacquer. Rarity survives twice: the pennant silhouette
  keeps its tier icon, and the tier word stays on the nameplate.
- **The nameplate line is not extended with "In plaster".** "All-rounder ·
  Common · In plaster" overflows the plate at grid size, and the look already
  says it. A hidden `sr-only` line carries the meaning instead.
- **The photo is never tinted, blurred or re-cropped.** It keeps
  `object-fit: cover`. Only the band (fading in from 60% of the art height)
  and the corner plaster cover it.
- **Known trade-off:** if a face sits unusually low in the crop, the band
  softens the chin. This is accepted, because the upload is a square
  head-and-shoulders crop.
- **Signatures are fixed per Player.** They are chosen by an FNV-1a hash of
  `player.id`, so every copy of that Player's card shows the same cast. Server
  rendering stays deterministic, with no `Math.random`.
- **Never write the injury note on the cast.** `kut.injury_periods.note` is
  admin-only and may hold medical detail. Signatures come only from the fixed
  pool below.
- **Market cards unchanged.** Market pages pass no `injured` today and stay as
  they are. Scope is the call sites that already pass `injured`: players list
  and detail, collection, and album.
- **Two new fonts,** Caveat 700 (`--font-hand`) and Permanent Marker 400
  (`--font-marker`). Both come through `next/font/google`, so they are
  self-hosted and CSP `font-src 'self'` holds. They use `preload: false`
  because only injured cards use them.

## Tokens

| Token | Value | Use |
|---|---|---|
| `--stock` | `#efeadf` | Plaster: card ground and signature band |
| `--ci` | `#3d3a33` | OVR, stats |
| `--plate` | `#d4ae8c` | Bandage: nameplate, pennant |
| `--plate-ink` | `#3a2413` | Text on the bandage |
| `--shirt` / `--shirt-ink` | `#5a554b` / `#f3efe4` | Shirt back, through the existing vars |
| plaster | `#e0b58a` | Pad `#f3dcc0`, holes `#b9895c` |
| `--ink-blue` | `#27459a` | Ballpoint, 7.3:1 on plaster |
| `--ink-green` | `#2f6b3a` | Felt tip, 5.3:1 |
| `--ink-black` | `#1f1d1a` | Biro, 14:1 |
| `--ink-red` | `#b8322a` | Marker, strike, heart, 4.9:1 |

## Placement

All sizes are in `cqi`, where the card width is 100. The card is already an
inline-size container, so everything scales from the 170 px grid card to the
330 px detail card by itself. Cards narrower than 224 px (two-up on a phone)
hide the items marked "hidden".

| Element | Anchor · offset | Size · type · rotate | Below 224 px |
|---|---|---|---|
| Signature band | art bottom, 40% tall | transparent → 82% plaster at 38% → solid at 62% | shown |
| Cast note | under "OVR", +1.6 | 5 · Caveat 700 · blue · −4° | hidden |
| Corner plaster | art top 3.6, right −5.6 | 24.8 × 6, radius 3, pad inset 0.9 / 8.4 · 38° | shown |
| Signature 1 | art right 4, bottom 15 | 5.8 · Caveat 700 · blue/green/black · −5° | shown |
| Signature 2 | art left 4, bottom 2.8 | 4.2 · Permanent Marker · red · 3° | hidden |
| Doodle | art left 4.8, bottom 12.5 | 6 × 6 · heart red / smiley blue · −12° | hidden |
| Bandage clip | plate top −2.35, right 6 | 10 × 4.7, straddles the seam | shown |
| PAC strike | over the value, 48% down | ±8% overhang, 0.7 thick · red · −10° | shown |
| "hop" | after the value +1.2, top −2.6 | 5.4 · Caveat 700 · red · −8° | hidden |

## Signature pool

Each line is at most 20 characters, which fits slot 1 at every size. Lines
are English or Dutch and never name a real member.

```
Get well soon!!        Beterschap, maat!
Who brings the bibs?   It was never a foul
Snel weer terug!       Rest up, legend
TFH misses you         Doc says: no rabonas
Walk it off (later)    Sterkte, kanjer!
Back next week??       Hou je taai!
```

## Accessibility

- Everything drawn on the cast is `aria-hidden`. One `sr-only` line carries
  the meaning: "Injured: the rating is protected during recovery", which was
  the chip's old tooltip.
- Nothing on the cast animates, so reduced motion needs no extra rule.

## Code

### `src/app/globals.css`

Delete the `.live-card__injured` block. Add this after the Elite tier (before
the no-photo card section). `[data-rarity][data-injured]` outranks every tier
rule whatever the source order.

```css
/* ===== INJURY MODE — the plaster cast ======================================
   While a Player is in injury mode (ADR-082) the tier's material is swapped
   for a signed cast. Rarity still reads from the pennant silhouette and the
   tier word. The cast is the card, not the photo: writing sits only on
   plaster (the band the art fades into, the nameplate, the stats), never
   across a face. `[data-rarity][data-injured]` outranks every tier rule,
   whatever the source order. */
.live-card[data-rarity][data-injured] {
  --stock: #efeadf;
  --ci: #3d3a33;
  --plate: #d4ae8c;
  --plate-ink: #3a2413;
  --rule: rgb(63 59 51 / 20%);
  --edge: rgb(255 255 255 / 60%);
  --shirt: #5a554b;
  --shirt-ink: #f3efe4;
  --ink-blue: #27459a;
  --ink-green: #2f6b3a;
  --ink-black: #1f1d1a;
  --ink-red: #b8322a;
  background-color: var(--stock);
  background-image:
    repeating-linear-gradient(0deg, rgb(120 110 90 / 8%) 0 1px, transparent 1px 5px),
    repeating-linear-gradient(90deg, rgb(120 110 90 / 8%) 0 1px, transparent 1px 5px);
  box-shadow: var(--lift);
}

.live-card[data-rarity][data-injured]
  :is(.live-card__sheen, .live-card__film, .live-card__glow) {
  display: none;
}

.live-card[data-rarity][data-injured] .live-card__grain {
  opacity: 0.4;
  background-image: radial-gradient(rgb(0 0 0 / 17%) 0.5px, transparent 0.6px);
  background-size: 3px 3px;
  mix-blend-mode: multiply;
}

.live-card[data-rarity][data-injured] .live-card__frame {
  box-shadow:
    inset 0 0 0 0.1em var(--edge),
    inset 0 0 0 0.34em rgb(0 0 0 / 5.5%);
}

/* Elastic bandage: the nameplate and the pennant. */
.live-card[data-rarity][data-injured]
  :is(.live-card__plate, .live-card__pennant) {
  background-color: var(--plate);
  background-image:
    repeating-linear-gradient(45deg, rgb(90 55 25 / 14%) 0 1px, transparent 1px 4px),
    repeating-linear-gradient(-45deg, rgb(90 55 25 / 14%) 0 1px, transparent 1px 4px);
  background-size: auto;
  animation: none;
  color: var(--plate-ink);
}

/* Undo the gold emboss and the Elite leaf on type. */
.live-card[data-rarity][data-injured]
  :is(.live-card__plate h2, .live-card__ovr b, .live-card__ovr span,
      .live-card__stats dd) {
  color: inherit;
  text-shadow: none;
}

/* The signature band: the art fades to solid plaster at the bottom, so
   the writing sits on plaster over any photo. */
.live-card[data-rarity][data-injured] .live-card__scrim {
  height: 40%;
  background: linear-gradient(
    180deg,
    transparent 0%,
    color-mix(in srgb, var(--stock) 82%, transparent) 38%,
    var(--stock) 62%
  );
}

/* "set in plaster", under the rating. An <em>, so the tier rules that
   restyle `.live-card__ovr span` never reach it. */
.live-card__cast-note {
  margin-top: 1.6cqi;
  font-family: var(--font-hand), cursive;
  font-size: 5cqi;
  font-style: normal;
  font-weight: 700;
  color: var(--ink-blue);
  white-space: nowrap;
  transform: rotate(-4deg);
  transform-origin: left center;
}

/* Everything written on the cast. Same z-index as the pennant but earlier
   in the DOM, so the pennant sits on top of the corner plaster. */
.live-card__cast {
  position: absolute;
  inset: 0;
  z-index: 3;
  pointer-events: none;
}

/* A plaster taping the art's top-right corner down. */
.live-card__tape {
  position: absolute;
  top: 3.6cqi;
  right: -5.6cqi;
  width: 24.8cqi;
  height: 6cqi;
  border-radius: 3cqi;
  background:
    radial-gradient(circle, #b9895c 0.3cqi, transparent 0.36cqi) 0 0 / 2cqi 2cqi,
    #e0b58a;
  box-shadow: 0 0.4cqi 1cqi rgb(0 0 0 / 22%);
  transform: rotate(38deg);
}

.live-card__tape::after {
  content: "";
  position: absolute;
  inset: 0.9cqi 8.4cqi;
  border-radius: 0.8cqi;
  background: #f3dcc0;
}

.live-card__sig {
  position: absolute;
  line-height: 1;
  white-space: nowrap;
}

.live-card__sig--1 {
  right: 4cqi;
  bottom: 15cqi;
  font-family: var(--font-hand), cursive;
  font-size: 5.8cqi;
  font-weight: 700;
  color: var(--ink-blue);
  transform: rotate(-5deg);
}
.live-card__sig--1[data-ink="green"] {
  color: var(--ink-green);
}
.live-card__sig--1[data-ink="black"] {
  color: var(--ink-black);
}

.live-card__sig--2 {
  left: 4cqi;
  bottom: 2.8cqi;
  font-family: var(--font-marker), cursive;
  font-size: 4.2cqi;
  color: var(--ink-red);
  transform: rotate(3deg);
}

.live-card__doodle {
  position: absolute;
  left: 4.8cqi;
  bottom: 12.5cqi;
  width: 6cqi;
  height: 6cqi;
  fill: none;
  stroke: var(--ink-red);
  stroke-width: 2.6;
  stroke-linecap: round;
  stroke-linejoin: round;
  transform: rotate(-12deg);
}
.live-card__doodle[data-kind="smiley"] {
  stroke: var(--ink-blue);
}

/* The bandage clip, straddling the art/nameplate seam. */
.live-card__clip {
  position: absolute;
  top: -2.35cqi;
  right: 6cqi;
  width: 10cqi;
  height: 4.7cqi;
}

/* PAC in red marker. The value underneath stays legible. */
.live-card__struck {
  position: relative;
}
.live-card__struck::after {
  content: "";
  position: absolute;
  top: 48%;
  right: -8%;
  left: -8%;
  height: 0.7cqi;
  border-radius: 0.4cqi;
  background: var(--ink-red);
  transform: rotate(-10deg);
}

.live-card__hop {
  position: absolute;
  top: -2.6cqi;
  left: calc(100% + 1.2cqi);
  font-family: var(--font-hand), cursive;
  font-size: 5.4cqi;
  font-weight: 700;
  color: var(--ink-red);
  white-space: nowrap;
  transform: rotate(-8deg);
}

/* Two-up on a phone: keep one signature, the plasters, the clip and the
   strike. The rest would only be noise at ~7px. */
@container (max-width: 224px) {
  :is(.live-card__sig--2, .live-card__doodle, .live-card__cast-note,
      .live-card__hop) {
    display: none;
  }
}
```

### `src/lib/injury-cast.ts` (new)

```ts
/**
 * What the club wrote on an injured Player's cast (injury mode, ADR-082).
 * Derived from the Player id, so every copy of the card carries the same
 * cast and the server render is deterministic. At most 20 characters a
 * line; never a member's name, never the admin injury note.
 */
const CAST_LINES = [
  "Get well soon!!",
  "Beterschap, maat!",
  "Who brings the bibs?",
  "It was never a foul",
  "Snel weer terug!",
  "Rest up, legend",
  "TFH misses you",
  "Doc says: no rabonas",
  "Walk it off (later)",
  "Sterkte, kanjer!",
  "Back next week??",
  "Hou je taai!",
] as const;

const INKS = ["blue", "green", "black"] as const;

function fnv1a(value: string) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function injuryCast(playerId: string) {
  const hash = fnv1a(playerId);
  const count = CAST_LINES.length;
  const first = hash % count;
  // An offset of 1..count-1, so the two lines always differ.
  const second = (first + 1 + ((hash >>> 8) % (count - 1))) % count;
  return {
    first: CAST_LINES[first],
    second: CAST_LINES[second],
    ink: INKS[(hash >>> 16) % INKS.length],
    doodle: (hash >>> 24) % 2 === 0 ? "smiley" : "heart",
  } as const;
}
```

Export `CAST_LINES` too if the unit test needs to check the pool directly.

### `src/app/layout.tsx`

```tsx
import { Archivo, Caveat, Instrument_Serif, Permanent_Marker } from "next/font/google";

// Handwriting for the injury cast only, so neither face is preloaded.
const caveat = Caveat({
  subsets: ["latin"],
  weight: "700",
  variable: "--font-hand",
  display: "swap",
  preload: false,
});

const permanentMarker = Permanent_Marker({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-marker",
  display: "swap",
  preload: false,
});

// <html className={`${archivo.variable} ${instrumentSerif.variable}
//   ${caveat.variable} ${permanentMarker.variable} h-full antialiased`}>
```

### `src/components/live-card.tsx`

```tsx
import { injuryCast } from "@/lib/injury-cast";

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

// ShirtBack gains `injured` and wraps everything after the ground rect,
// lifting the number clear of the signature band:
//   <g transform={injured ? "translate(0 -14)" : undefined}>
//     …body, seam, name, number (unchanged)…
//     {injured && <ShirtPlasters />}
//   </g>
// BustFallback (long surnames) is unchanged; the band simply covers its base.

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

// In LiveCard:
<article
  className="live-card"
  data-injured={injured || undefined}
  data-rarity={tier}
  data-size={size}
>
  …
  <ShirtBack injured={injured} player={player} />
  …
  <p aria-label={`${player.liveOvr} overall`} className="live-card__ovr">
    <b>{player.liveOvr}</b>
    <span aria-hidden="true">OVR</span>
    {injured && (
      <em aria-hidden="true" className="live-card__cast-note">
        set in plaster
      </em>
    )}
  </p>
  {/* trend pill unchanged; delete the old injured chip */}
  {injured && <InjuryCast playerId={player.id} />}
  <span aria-hidden="true" className="live-card__pennant">…</span>
  …
  <div className="live-card__plate">
    {injured && <BandageClip />}
    <h2>{player.displayName}</h2>
    <p>…unchanged…</p>
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
  …
</article>;
```

The `<InjuryCast>` must come **after** the two scrims and **before** the
pennant in the DOM. The cast and the pennant share `z-index: 3`, and DOM order
puts the pennant on top of the corner plaster.

## Other copy that mentions the chip

- `src/app/(app)/how-it-works/page.tsx`, section 4 ("Injured? Your card is
  protected"): "Your cards show a 🩹 Injured chip while it lasts" becomes
  something like "Your cards go into plaster, signed by the club, while it
  lasts."
- `docs/decisions.md` ADR-082 says "A 🩹 Injured chip marks the Player's Live
  cards". Leave that ADR as history; the new ADR supersedes that sentence.

## Acceptance

- An injured Player's card shows the cast at every tier (Common through
  Elite). The pennant icon and the tier word still name the tier.
- It works for a custom photo, a shirt back and the bust fallback, at detail
  size (330 px) and grid size (~170 px). At grid size, signature 2, the
  doodle, the cast note and "hop" are hidden.
- The same Player shows the same two lines, ink and doodle on every page and
  every copy.
- A non-injured card is pixel-identical to before. No `data-injured`
  attribute is rendered at all when `injured` is false.
- Screen readers hear the sr-only injury line and none of the cast text.
