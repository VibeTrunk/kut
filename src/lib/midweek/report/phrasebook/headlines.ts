/**
 * Headlines and fact lines (BUILD_SPEC §44.10). Praise Players, tease
 * managers. `{winner}` and `{loser}` are the managers, `{score}` the result,
 * `{hero}` the Player the headline is about.
 */
export const HEADLINES = {
  hat_trick: [
    "{hero}'s hat trick sends {winner} through",
    "Three for {hero} as {winner} beats {loser} {score}",
    "{hero} takes the match ball home: {winner} {score} {loser}",
    "Hat trick hero {hero} sinks {loser}",
  ],
  upset: [
    "Upset! {winner} knocks out the favourite, {loser}",
    "{winner} defies the odds against {loser}",
    "Nobody gave {winner} a chance. {score}.",
    "Giant-killing: {winner} beats {loser} {score}",
    "{winner} shocks {loser}",
  ],
  thrashing: [
    "{winner} runs riot: {score} against {loser}",
    "{winner} thrashes {loser} {score}",
    "No contest: {winner} {score} {loser}",
    "The five from {loser} are left chasing shadows in a {score} defeat",
    "{winner} puts {score} past {loser}",
  ],
  three_keeper_win: [
    "{winner}'s three-keeper gamble pays off",
    "Three keepers, one win: {winner} beats {loser}",
    "{winner} goes keeper-heavy and gets away with it",
  ],
  three_keeper_loss: [
    "{loser}'s three-keeper gamble backfires",
    "Too many keepers spoil it for {loser}",
    "{winner} exposes the three-keeper plan of {loser}",
  ],
  keeperless_win: [
    "{winner} wins without a proper keeper, {score}",
    "Who needs a keeper? {winner} beats {loser} {score}",
    "{winner} gets away with it: no keeper, still through",
  ],
  keeperless_loss: [
    "No keeper, no luck: {loser} goes out to {winner}",
    "The keeperless gamble from {loser} ends against {winner}",
    "{winner} makes {loser} pay for leaving the goal to an outfielder",
  ],
  shootout: [
    "{winner} wins it on penalties against {loser}",
    "Penalty drama: {winner} edges {loser}",
    "{winner} survives a shootout with {loser}",
    "{loser} goes out on penalties to {winner}",
    "It takes penalties, but {winner} gets past {loser}",
  ],
  comeback: [
    "{winner} comes from behind to beat {loser} {score}",
    "Fightback! {winner} turns it round against {loser}",
    "{loser} leads, then {winner} takes over",
    "{winner} recovers to beat {loser} {score}",
  ],
  late_winner: [
    "Late drama as {winner} snatches it against {loser}",
    "{hero}'s late winner sends {winner} through",
    "{winner} leaves it late to beat {loser} {score}",
    "A late, late goal settles it for {winner}",
  ],
  comfortable: [
    "{winner} sees off {loser} {score}",
    "A comfortable night for {winner} against {loser}",
    "{winner} beats {loser} {score}",
    "{winner} is too strong for {loser}",
    "{winner} goes through at the expense of {loser}",
  ],
  narrow: [
    "{winner} edges past {loser} {score}",
    "{winner} squeezes through against {loser}",
    "Tight one: {winner} {score} {loser}",
    "{winner} does just enough against {loser}",
    "One goal in it: {winner} beats {loser}",
  ],
} as const satisfies Record<string, readonly string[]>;

export type HeadlineKind = keyof typeof HEADLINES;

/**
 * Fact lines under the headline. `{name}` is a Player, `{manager}` the manager
 * the fact is about, `{opponent}` the other manager, and `{value}`, `{picks}`,
 * `{owners}`, `{tier}` numbers or labels from the engine. Owner counts appear
 * only when at least three entrants own the Player (ADR-091); otherwise the
 * `contrarian_rare` wording is used. Until the week is complete no count is
 * published at all (owner decision D3), and the pages render every report's
 * text that way, so `contrarian_unpublished` is the wording members read
 * (ADR-098).
 */
export const FACT_LINES = {
  contrarian_known: [
    "Only {picks} of {owners} owners picked {name}. {manager} did, and it paid off.",
    "{name} was in just {picks} of {owners} possible squads, and made the difference.",
    "The brave call: {manager} picked {name}, like just {picks} of {owners} owners.",
    "{picks} of {owners} owners went with {name}. The rest will be kicking themselves.",
  ],
  contrarian_rare: [
    "{name} was a rare pick this week, and {manager} is glad of it.",
    "Hardly anyone picked {name}. {manager} did, and it paid off.",
    "A rare pick, a big payoff: {name} for {manager}.",
    "{manager} dared to pick {name}, and got a bonus for it.",
  ],
  contrarian_unpublished: [
    "{name} was in few squads this week. {manager} saw something the others didn't.",
    "Against the crowd: {manager} picked {name}, and the pick bonus showed.",
    "Not many managers made room for {name}. {manager} did, and reaped the bonus.",
    "The road less picked: {name} for {manager}, and it worked.",
  ],
  form_hero: [
    "{name} is having a week: form {value}, the talk of the club.",
    "Form {value}: {name} is flying this week.",
    "{name} rolled a big week (form {value}), and it shows.",
    "This is the week of {name}: form {value}.",
  ],
  cheap_standout: [
    "Star of the match: {name}, a {tier} card.",
    "Who needs Elites? {tier} card {name} runs the show.",
    "{name}, a humble {tier}, is the standout.",
    "The best player on the pitch was a {tier}: {name}.",
  ],
  upset: [
    "{manager} had a {value} chance before kick-off, and won anyway.",
    "The odds gave {manager} {value}. The odds were wrong.",
    "{value} to win, said the numbers. {manager} disagreed.",
    "An upset: {manager} started as a {value} outsider.",
  ],
  keeperless_side: [
    "{manager} played without a Goalkeeper, so {name} went in goal.",
    "No Goalkeeper for {manager}: {name} had the gloves tonight.",
    "{name} kept goal for {manager}, who didn't pick a keeper.",
    "{manager} left the Goalkeeper at home, so {name} went between the posts.",
  ],
  three_keeper_paid: [
    "{manager} picked three keepers and got away with it.",
    "The three-keeper gamble pays off for {manager}.",
    "Three keepers from {manager}: bold, and somehow right.",
  ],
  three_keeper_backfired: [
    "The three-keeper gamble from {manager} backfired.",
    "Three keepers, one goal to guard: {manager} learned the hard way.",
    "{manager} picked three keepers. Two of them played outfield. It showed.",
  ],
  thrashing: [
    "A {value}-goal margin. {opponent} will want to forget this one.",
    "Winning by {value} goals: the five from {manager} were in a hurry.",
    "{value} goals clear. Nobody saw that coming, least of all {opponent}.",
  ],
  brace: [
    "Two goals for {name}.",
    "{name} scores twice.",
    "A brace for {name}.",
    "{name} bags a pair.",
  ],
  hat_trick: [
    "Hat trick for {name}!",
    "{name} scores three. Take the match ball home.",
    "Three goals for {name}, a hat trick.",
    "{name} completes the hat trick.",
  ],
  injured_hero: [
    "{name} is injured and still made the difference.",
    "Plaster and all, {name} was the story of the match.",
    "The finest Player on the injury list tonight: {name}.",
    "{name} played on from the injury list, and nobody will forget it.",
  ],
} as const satisfies Record<string, readonly string[]>;

export type FactLineKind = keyof typeof FACT_LINES;
