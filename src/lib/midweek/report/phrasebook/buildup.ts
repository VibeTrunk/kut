import type { ChanceType } from "@/game/midweek/config";

/**
 * Build-up: how a chance was made, one sentence per chance type (BUILD_SPEC
 * §44.10). `{creator}` made the chance and `{shooter}` takes it; both are
 * Player names. Every line reaches members through a reviewed PR; the rules
 * are pinned by `tests/unit/midweek-phrasebook.test.ts`.
 */
export const BUILDUP: Record<ChanceType, readonly string[]> = {
  breakaway: [
    "{creator} launches it long and {shooter} is away.",
    "One ball from {creator} over the top, and {shooter} is clean through.",
    "{creator} spots the run and {shooter} is off to the races.",
    "A raking pass from {creator} sends {shooter} galloping clear.",
    "{creator} clears it long; {shooter} beats everyone to it and is gone.",
    "{shooter} is released by {creator} with half the pitch to run into.",
  ],
  wing_run: [
    "{creator} tears down the right and picks out {shooter}.",
    "{creator} skips past one, then another, on the left, and finds {shooter}.",
    "Down the wing goes {creator}, and the cross is looking for {shooter}.",
    "{creator} hugs the touchline, gets to the byline and spots {shooter}.",
    "A lung-bursting run from {creator} ends with the ball at {shooter}'s feet.",
    "{creator} beats the full-back for pace and whips it towards {shooter}.",
  ],
  chase: [
    "{creator} pokes it into the channel and {shooter} sets off after it.",
    "{shooter} chases a hopeful ball from {creator} and wins the race.",
    "{creator} lifts it over the defence; {shooter} refuses to give it up.",
    "A lofted pass from {creator}, and {shooter} is first to it.",
    "{creator} hits it into space, and {shooter} outruns the defence to get there.",
    "{shooter} hunts down a pass from {creator} that looked overhit.",
  ],
  volley: [
    "{creator} hangs a cross up at the far post for {shooter}.",
    "A corner from {creator} is half-cleared, straight back to {shooter}.",
    "{creator} chips it into the box and {shooter} watches it drop.",
    "A looping cross from {creator} sits up invitingly for {shooter}.",
    "{creator} scoops it over the top and {shooter} steadies for the volley.",
    "The ball drops out of the sky after a {creator} cross, right on to {shooter}.",
  ],
  first_time: [
    "{creator} squares it for {shooter}.",
    "{creator} rolls it across the box into {shooter}'s path.",
    "{creator} lays it off first time to {shooter}.",
    "Quick feet from {creator}, and a pass into {shooter} at the edge of the six-yard box.",
    "{creator} slides it to {shooter} without looking up.",
    "{creator} drills a low ball in, and {shooter} is arriving.",
  ],
  overhead: [
    "{creator} loops a cross in just behind {shooter}.",
    "The cross from {creator} looks too high, until {shooter} goes airborne.",
    "{creator} flicks it up in the box, and {shooter} has an idea.",
    "A deflected cross from {creator} spins up behind {shooter}.",
    "{creator} lobs it into a crowd, and {shooter} has the back to goal.",
    "The ball in from {creator} is awkward, just behind {shooter}.",
  ],
  through_ball: [
    "{creator} threads a pass between two defenders for {shooter}.",
    "{creator} splits the defence wide open, and {shooter} is through.",
    "A perfectly weighted ball from {creator} puts {shooter} one on one.",
    "{creator} sees the gap nobody else saw and slips {shooter} in.",
    "{creator} disguises the pass beautifully, and {shooter} is in behind.",
    "The defence steps up, {creator} plays it through, and {shooter} is gone.",
  ],
  free_kick: [
    "{creator} is brought down on the edge of the box. {shooter} fancies this one.",
    "{creator} wins a free kick in a dangerous spot, and {shooter} stands over it.",
    "{creator} rolls the free kick sideways to {shooter}.",
    "A free kick, won by some fine dribbling from {creator}, and {shooter} places the ball.",
    "{creator} tees it up from the free kick for {shooter}.",
    "{creator} dummies the free kick. {shooter} takes it.",
  ],
  curler: [
    "{creator} lays it back to {shooter} on the edge of the box.",
    "{creator} finds {shooter} in space, just outside the area.",
    "{creator} cuts it back to the edge of the box, where {shooter} is waiting.",
    "A short pass from {creator}, and {shooter} shapes to curl it.",
    "{creator} tees up {shooter} twenty yards out.",
    "{creator} rolls it into {shooter}'s path on the angle of the box.",
  ],
  header: [
    "{creator} swings in a corner towards {shooter}.",
    "{creator} whips in a free kick, right on to {shooter}.",
    "{creator} floats a cross to the far post, and {shooter} rises.",
    "From a {creator} corner, {shooter} attacks the ball.",
    "{creator} delivers a set piece with pace, and {shooter} gets across the near post.",
    "{creator} hangs it up, and {shooter} climbs above everyone.",
  ],
  scramble: [
    "A corner from {creator} causes chaos in the six-yard box.",
    "{creator} drives it low into a crowded box, and {shooter} is in there somewhere.",
    "A {creator} throw-in turns into a pinball game in the box.",
    "The shot from {creator} is blocked, and it drops for {shooter} in the melee.",
    "{creator} hooks it back into the danger zone, and {shooter} is lurking.",
    "Nobody can clear the cross from {creator}, and it breaks to {shooter}.",
  ],
  long_shot: [
    "{creator} knocks it square to {shooter}, thirty yards out.",
    "{creator} lays it off, and {shooter} has a look from distance.",
    "A clearance from {creator} falls to {shooter} a long way from goal.",
    "{creator} rolls it back to {shooter}, and nobody closes down.",
    "A short one from {creator}, and {shooter} lets fly from range.",
    "{creator} finds {shooter} in acres of space in midfield.",
  ],
  long_throw: [
    "{creator} launches a long throw up the pitch to {shooter}.",
    "{creator} rolls the ball out quickly, and {shooter} is off.",
    "{creator} hurls it out to {shooter} before the defence is set.",
    "A quick throw from {creator} catches everyone napping, except {shooter}.",
    "{creator} gathers and releases {shooter} in one movement.",
    "{creator} spots {shooter} unmarked and throws it the length of the half.",
  ],
  cutback: [
    "{creator} gets to the byline and cuts it back for {shooter}.",
    "{creator} drags it back from the goal line into {shooter}'s path.",
    "{creator} digs out a cutback, and {shooter} is arriving at the penalty spot.",
    "{creator} pulls it back perfectly for {shooter}.",
    "Down to the byline goes {creator}, and back it comes for {shooter}.",
    "{creator} waits, waits, and cuts it back to {shooter}.",
  ],
  one_two: [
    "{shooter} plays a one-two with {creator} and bursts into the box.",
    "{shooter} and {creator} exchange passes on the edge of the area.",
    "A slick one-two between {creator} and {shooter} opens the door.",
    "{shooter} gives and goes with {creator}, and the return is perfect.",
    "{creator} returns the one-two first time, and {shooter} is in.",
    "{shooter} and {creator} play a wall pass right through the middle.",
  ],
};

/**
 * Build-up for a chance the shooter made alone (creator and shooter are the
 * same card). Only the solo-capable chance types need these.
 */
export const SOLO_BUILDUP: Partial<Record<ChanceType, readonly string[]>> = {
  breakaway: [
    "{shooter} intercepts on halfway and is away.",
    "{shooter} picks the ball up deep and just keeps running.",
    "{shooter} nicks it off a defender and is clean through.",
    "{shooter} spins away from a challenge with nothing but grass ahead.",
  ],
  wing_run: [
    "{shooter} goes on a mazy run down the left.",
    "{shooter} takes on the full-back and wins.",
    "{shooter} dances along the touchline, beating player after player.",
    "{shooter} cuts in from the right wing.",
  ],
  long_shot: [
    "{shooter} picks it up thirty yards out and looks up.",
    "{shooter} has space in midfield and decides to try it.",
    "Nobody closes {shooter} down, which is a brave decision.",
    "{shooter} steps inside and shapes to shoot from distance.",
  ],
  curler: [
    "{shooter} shifts it inside on the edge of the box.",
    "{shooter} drifts across the edge of the area, looking for the angle.",
    "{shooter} sidesteps one challenge and sets up a curler.",
    "{shooter} feints to cross and comes inside instead.",
  ],
  scramble: [
    "The ball ricochets around the box and falls to {shooter}.",
    "A clearance comes straight back off {shooter}.",
    "{shooter} keeps the ball alive in a crowded six-yard box.",
    "{shooter} wins a loose ball in the goalmouth.",
  ],
  free_kick: [
    "{shooter} is brought down twenty yards out, gets up, and stands over it.",
    "{shooter} earns a free kick on the edge of the box and wants it.",
    "{shooter} wins the free kick and nobody else gets near the ball.",
    "{shooter} places the ball carefully for a free kick in shooting range.",
  ],
};
