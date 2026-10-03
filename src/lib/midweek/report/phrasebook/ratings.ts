/**
 * The line under each card's night rating (BUILD_SPEC §44.10, ADR-117). One
 * pool per story, the card's biggest contribution over the night, chosen in
 * `nightStory`. `{name}` is the card's display name; the counts are the
 * night's totals and appear only in pools where they are at least two, so no
 * line reads "1 goals". Praise the card; never mock it for a quiet night.
 * Every pool holds at least five lines, so a five never repeats one.
 */
export const RATING_STORIES = [
  "hat_trick",
  "brace",
  "goal_and_assist",
  "shootout_save",
  "goal",
  "assists",
  "assist",
  "keeper_wall",
  "keeper",
  "blocks",
  "block",
  "creator",
  "quiet_win",
  "quiet",
] as const;

export type RatingStory = (typeof RATING_STORIES)[number];

export const RATING_LINES: Record<RatingStory, readonly string[]> = {
  hat_trick: [
    "{name} scored {goals} on the night. Nobody else came close.",
    "The bracket will remember this one: {goals} goals for {name}.",
    "{name} kept finding the net: {goals} goals in one evening.",
    "A night to frame for {name}: {goals} goals.",
    "Every chance seemed to fall to {name}, and {goals} went in.",
  ],
  brace: [
    "{name} found the net twice.",
    "A brace for {name}: two goals, two reasons to pick this card again.",
    "Two goals from {name}, both taken with real confidence.",
    "{name} scored two and made the manager look clever.",
    "{name} scored once, then did it again.",
  ],
  goal_and_assist: [
    "Goal and assist for {name}. A complete night's work.",
    "{name} scored and created. Hard to ask more of one card.",
    "{name} was in the middle of everything: a goal and an assist.",
    "Scorer and provider: {name} did both jobs on the night.",
    "{name} made one and finished one.",
  ],
  shootout_save: [
    "{name} saved a penalty in the shoot-out. That's the moment people will talk about.",
    "A shoot-out save from {name}, and the nerve to go with it.",
    "{name} guessed right from the spot when it counted.",
    "Penalties are a lottery, unless {name} is in goal.",
    "When it came down to penalties, {name} came up with a save.",
  ],
  goal: [
    "{name} got on the scoresheet.",
    "One goal for {name}, and a good one to have.",
    "{name} scored. Job done.",
    "A goal from {name} to show for the night.",
    "{name} put one away.",
  ],
  assists: [
    "{name} set up {assists} goals without needing the credit.",
    "The scorers owe {name} a thank-you: {assists} assists.",
    "{name} kept creating: {assists} goals came from this card.",
    "Provider in chief: {name} laid on {assists} goals.",
    "A pass from {name} started {assists} goals.",
  ],
  assist: [
    "{name} set up a goal.",
    "An assist for {name}: the pass before the celebration.",
    "{name} made a goal for someone else and was happy to.",
    "{name} picked out a teammate for a goal.",
    "A goal came from a pass by {name}.",
  ],
  keeper_wall: [
    "{name} made {saves} saves and kept the side in it.",
    "A busy night between the posts: {saves} saves from {name}.",
    "The shots kept coming and {name} kept stopping them: {saves} saves.",
    "{name} stood firm in goal with {saves} saves.",
    "{name} said no {saves} times.",
  ],
  keeper: [
    "{name} made the saves that were needed.",
    "A steady night in goal for {name}.",
    "{name} kept things calm at the back.",
    "{name} was alert whenever the ball came near.",
    "{name} dealt with whatever came through.",
  ],
  blocks: [
    "{name} put in block after block.",
    "Nothing got past {name} without a fight.",
    "{name} read the danger again and again.",
    "Defending is a craft, and {name} showed it.",
    "Every time a shot came, {name} seemed to be in the way.",
  ],
  block: [
    "{name} made one big block when it mattered.",
    "One timely block from {name}.",
    "{name} stepped in to stop a chance.",
    "{name} snuffed out a chance with a well-timed block.",
    "A crucial block from {name}.",
  ],
  creator: [
    "{name} kept making chances. The goals will come.",
    "{name} kept the ball moving forward all night.",
    "Plenty of good work from {name} going forward.",
    "{name} created chance after chance.",
    "{name} kept setting things up.",
  ],
  quiet_win: [
    "{name} did a quiet job in a side that went through.",
    "No headlines for {name}, but the side kept winning.",
    "{name} played a part in a winning side.",
    "Not every card needs a highlight. {name} did the simple things.",
    "{name} kept it tidy while others took the headlines.",
  ],
  quiet: [
    "A quiet night for {name}. The ball just didn't come that way.",
    "{name} waited for a chance that never arrived.",
    "Few chances came near {name} this time.",
    "Next week could be {name}'s week.",
    "{name} stayed patient all night.",
  ],
};
