/**
 * The shoot-out (BUILD_SPEC §44.5, §44.10). A report narrates the intro, every
 * kick that isn't scored, and the kick that decides it; the scored kicks show
 * as a tally. A missed penalty credits the keeper or the woodwork, never
 * ridicules the kicker. `{first}` and `{second}` are the two managers, in
 * kicking order.
 */
export const SHOOTOUT_INTRO: readonly string[] = [
  "Level at full time. It's penalties!",
  "Nothing to separate {first} and {second}. Penalties it is.",
  "{first} and {second} can't be split. To the spot!",
  "All square. Time for penalties, and for nerves.",
  "It goes to a penalty shootout, and nobody can watch.",
  "Penalties. {first} goes first.",
];

export const PENALTY_SAVED: readonly string[] = [
  "{keeper} guesses right and saves from {kicker}!",
  "{keeper} dives to keep out the penalty from {kicker}!",
  "Saved! {keeper} reads {kicker} perfectly.",
  "{keeper} stays big and stops the spot kick from {kicker}.",
  "{keeper} gets a fingertip to the penalty from {kicker}!",
  "{kicker} goes low, and so does {keeper}. Saved!",
  "{keeper} waits and waits, and saves from {kicker}.",
  "Brilliant from {keeper}, who pushes the penalty from {kicker} away.",
];

export const PENALTY_WOODWORK: readonly string[] = [
  "The penalty from {kicker} cannons off the bar!",
  "Off the post! {kicker} goes agonisingly close.",
  "{kicker} hits the woodwork from the spot!",
  "{kicker} goes for the corner, and the post says no.",
  "The crossbar denies {kicker}!",
];

/** Off target: the credit goes to the keeper's presence on the line. */
export const PENALTY_WIDE: readonly string[] = [
  "Dancing on the line works for {keeper}: {kicker} puts it wide.",
  "{keeper} stares {kicker} out, and the penalty drifts past the post.",
  "The mind games from {keeper} pay off as the penalty from {kicker} sails over.",
  "{keeper} makes the goal look tiny, and {kicker} misses the target.",
  "{keeper} delays, {kicker} waits, and the penalty goes wide.",
  "A wave from {keeper} on the line is enough: {kicker} is off target.",
];

export const DECISIVE_SCORED: readonly string[] = [
  "{kicker} steps up and wins it!",
  "{kicker} sends {keeper} the wrong way. It's over!",
  "{kicker} buries the decisive penalty!",
  "Ice cold: {kicker} slots home the winner.",
  "{kicker} smashes it into the roof of the net to settle it!",
  "{kicker} rolls it in, and the celebrations begin.",
];

export const DECISIVE_SAVED: readonly string[] = [
  "{keeper} saves from {kicker}, and that's the shootout won!",
  "{keeper} is the hero, denying {kicker} to seal it!",
  "{keeper} dives, saves, wins it!",
  "It's over: {keeper} keeps out the penalty from {kicker}!",
  "{keeper} stops {kicker} and the shootout is done!",
];

/** The deciding kick missed the target or hit the frame. */
export const DECISIVE_MISSED: readonly string[] = [
  "The post decides it: the kick from {kicker} comes back out!",
  "The woodwork has the final say as {kicker} goes close.",
  "The mind games from {keeper} settle it as the kick from {kicker} goes wide.",
  "{keeper} made the goal look small, and the kick from {kicker} decides it.",
];

/** Still level after the sudden-death cap: a seeded draw decides (BUILD_SPEC §44.5). */
export const SHOOTOUT_TOSS: readonly string[] = [
  "After all that, still level. The draw falls for {winner}.",
  "Nobody can miss, so it goes to a draw, and {winner} goes through.",
  "Round after round, still level. The draw favours {winner}.",
];
