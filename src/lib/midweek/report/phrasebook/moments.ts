/**
 * Chances that didn't go in (BUILD_SPEC §44.10). **A miss always credits
 * someone**: the keeper, a defender, the woodwork or the pressure. It never
 * ridicules the shooter. `{shooter}` took the chance, `{keeper}` is the
 * defending keeper, `{defender}` the defender the engine credited.
 */

/** Saves, by how big the chance was: `great` denies a likely goal. */
export const SAVES: Record<"great" | "good" | "routine", readonly string[]> = {
  great: [
    "{keeper} pulls off a stunning save to deny {shooter}!",
    "{shooter} looked certain to score, but {keeper} gets down brilliantly!",
    "What a stop from {keeper}! {shooter} can't believe it.",
    "{keeper} spreads wide and blocks {shooter}'s point-blank effort!",
    "{keeper} flies across goal to keep out {shooter}'s shot!",
    "A world-class save from {keeper} denies {shooter} a certain goal!",
    "{keeper} somehow claws {shooter}'s effort off the line!",
    "{shooter} does everything right, and {keeper} does everything better.",
  ],
  good: [
    "{keeper} dives to push {shooter}'s shot round the post.",
    "{keeper} tips {shooter}'s effort over the bar.",
    "{shooter} forces a fine save from {keeper}.",
    "{keeper} is equal to {shooter}'s shot.",
    "{keeper} stands tall and blocks {shooter}'s effort.",
    "Good hands from {keeper} to keep out {shooter}.",
    "{keeper} reads {shooter}'s shot and gathers at the second attempt.",
    "{keeper} gets a strong hand to {shooter}'s shot.",
  ],
  routine: [
    "{keeper} gathers {shooter}'s shot comfortably.",
    "{keeper} is perfectly placed for {shooter}'s shot.",
    "{keeper} watches {shooter}'s shot all the way into the gloves.",
    "{keeper} collects {shooter}'s attempt without fuss.",
    "{shooter} tests {keeper}, who is up to it.",
    "{keeper} smothers {shooter}'s shot.",
    "{keeper} is well placed to hold {shooter}'s effort.",
    "{shooter} makes {keeper} work, and {keeper} is ready.",
  ],
};

export const WOODWORK: readonly string[] = [
  "{shooter} rattles the crossbar!",
  "Off the post! {shooter} is inches away.",
  "{shooter} hits the bar, and the whole goal shakes.",
  "The effort from {shooter} clips the outside of the post.",
  "The woodwork denies {shooter}!",
  "{shooter} strikes the post. So close!",
  "The shot from {shooter} comes back off the frame of the goal.",
  "Crossbar! {shooter} deserved better.",
  "{shooter} smacks the inside of the post, and it bounces out!",
  "The post comes to the rescue as {shooter} goes close.",
];

export const BLOCKS: readonly string[] = [
  "{defender} throws in a brave block on {shooter}'s shot.",
  "{defender} gets in the way of {shooter}'s effort just in time.",
  "A superb block from {defender} to deny {shooter}.",
  "{defender} slides in to block {shooter}'s shot.",
  "{shooter} shoots, but {defender} is there to block.",
  "{defender} reads it and blocks {shooter}'s strike.",
  "Last-ditch defending from {defender} keeps {shooter} out!",
  "{defender} stands firm and charges down {shooter}'s shot.",
  "{defender} makes a goal-saving block on {shooter}.",
  "The shot from {shooter} cannons off {defender}, who knew exactly where to stand.",
];

/** A shot forced off target: the credit goes to the defender's pressure. */
export const WIDE: readonly string[] = [
  "{defender} closes in fast, and {shooter}'s shot flies wide.",
  "Under pressure from {defender}, {shooter} drags it past the post.",
  "{defender} forces {shooter} wide, and the angle is too tight.",
  "{defender} gets close enough to put {shooter} off, and it's wide.",
  "{shooter} has to shoot early with {defender} arriving, and it's over the bar.",
  "{defender} harries {shooter} into shooting early, and it's off target.",
  "Great tracking back from {defender} hurries {shooter}, and it goes wide.",
  "{defender} does just enough, and {shooter}'s effort curls past the post.",
  "{defender} blocks the angle, and {shooter} can only find the side netting.",
  "The pressure from {defender} tells as {shooter} fires over.",
];

/**
 * Asides for a Player in injury mode at the lock (the ADR-085 cast rule),
 * added after the moment itself. The humour is about playing on regardless,
 * never the injury: nothing medical, no body parts, and never the admin's
 * injury note (ADR-084, ADR-087).
 */
export const INJURED_GOAL: Record<"sensational" | "quality" | "routine", readonly string[]> = {
  sensational: [
    "Not bad for someone still in plaster.",
    "The cast stays on. The celebration is enormous.",
    "Injured, apparently. Nobody told {shooter}.",
    "{shooter} was down as a doubt. Some doubt.",
    "Still in plaster, and still the best thing on the pitch.",
  ],
  quality: [
    "Plaster and all, {shooter} is on the scoresheet.",
    "The injury list has never looked so dangerous.",
    "Somebody sign that cast: {shooter} has scored.",
    "{shooter} is injured, officially. Unofficially, {shooter} is scoring.",
    "A goal from the injury list, of all places.",
  ],
  routine: [
    "Even from the injury list, {shooter} doesn't miss those.",
    "In plaster, but in the right place.",
    "{shooter} plays on regardless, and it pays off.",
    "The cast doesn't slow {shooter} down for this one.",
    "Injured {shooter} still finds a way.",
  ],
};

export const INJURED_CREATOR: readonly string[] = [
  "An assist from the injury list: take a bow, {creator}.",
  "{creator} is still in plaster and still pulling the strings.",
  "Injured {creator} sets it up anyway.",
  "Who needs to be fit? Not {creator}.",
  "The cast is signed, the pass is perfect: {creator} again.",
  "{creator} is officially injured and unofficially running the game.",
];

export const INJURED_KEEPER: readonly string[] = [
  "In plaster, and still unbeatable: {keeper}.",
  "Injured {keeper} keeps it out anyway.",
  "The cast on {keeper} is doing a lot of work tonight.",
  "The finest keeper on the injury list strikes again.",
  "Still in plaster, {keeper} refuses to be beaten.",
  "{keeper} should be resting. {keeper} is saving everything instead.",
];
