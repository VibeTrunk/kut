import type { ChanceType } from "@/game/midweek/config";

/**
 * How a goal went in, per chance type and quality tier (BUILD_SPEC §44.10).
 * The tier follows the engine's goal probability: an unlikely chance that goes
 * in is `sensational`, a middling one `quality`, a likely one `routine`.
 * `{shooter}` scored; `{keeper}` is the defending side's keeper.
 */
export type Tier = "sensational" | "quality" | "routine";

export const FINISHES: Record<ChanceType, Record<Tier, readonly string[]>> = {
  breakaway: {
    sensational: [
      "{shooter} lifts an audacious chip over {keeper} from thirty yards!",
      "{shooter} rounds {keeper} at full tilt and slots it in from a tight angle!",
      "{shooter} doesn't even take a touch, and the finish is outrageous!",
      "{shooter} outruns everyone and dinks it over {keeper}. Sensational!",
    ],
    quality: [
      "{shooter} keeps calm and slides it past {keeper}.",
      "{shooter} takes it round {keeper} and rolls it in.",
      "{shooter} drills it low into the far corner.",
      "{shooter} opens up and places it beyond {keeper}.",
    ],
    routine: [
      "{shooter} has all the time in the world and tucks it away.",
      "{shooter} makes it look simple.",
      "{shooter} strokes it home with {keeper} stranded.",
      "{shooter} finishes it off without any fuss.",
    ],
  },
  wing_run: {
    sensational: [
      "{shooter} cuts inside and bends one into the top corner from an impossible angle!",
      "{shooter} shoots from near the touchline and it creeps in at the near post!",
      "{shooter} beats two more and fires in off the underside of the bar!",
      "{shooter} goes for goal from the corner of the box. Unbelievable!",
    ],
    quality: [
      "{shooter} cuts inside and whips it past {keeper}.",
      "{shooter} drives it across {keeper} and into the far corner.",
      "{shooter} squeezes a shot in at the near post.",
      "{shooter} steadies and fires low past {keeper}.",
    ],
    routine: [
      "{shooter} steers it home from close range.",
      "{shooter} arrives at the far post and taps in.",
      "{shooter} bundles it over the line.",
      "{shooter} has a simple finish and takes it.",
    ],
  },
  chase: {
    sensational: [
      "{shooter} gets there a fraction before {keeper} and flicks it in from an absurd angle!",
      "{shooter} wins the race and prods it in from right on the byline!",
      "{shooter} shoots on the stretch while {keeper} is still coming out, and it drops in!",
      "{shooter} hooks it in from a ball everyone had given up on!",
    ],
    quality: [
      "{shooter} gets there first and prods it past {keeper}.",
      "{shooter} holds off the defender and slides it in.",
      "{shooter} takes one touch and shoots before {keeper} can close the angle.",
      "{shooter} nips in ahead of {keeper} and scores.",
    ],
    routine: [
      "{shooter} gets there and walks it in.",
      "{shooter} wins the race and finishes calmly.",
      "{shooter} reaches it first and rolls it into the net.",
      "{shooter} makes no mistake after all that running.",
    ],
  },
  volley: {
    sensational: [
      "{shooter} meets it on the volley and it flies into the top corner!",
      "{shooter} catches it perfectly on the half-volley. {keeper} never saw it.",
      "{shooter} leathers a volley in off the crossbar!",
      "{shooter} volleys it from the edge of the box, and the net bulges!",
    ],
    quality: [
      "{shooter} volleys it firmly past {keeper}.",
      "{shooter} keeps the volley down and it skids into the corner.",
      "{shooter} guides a volley just inside the post.",
      "{shooter} times the volley well and scores.",
    ],
    routine: [
      "{shooter} volleys it in from close range.",
      "{shooter} sidefoots the volley home.",
      "{shooter} can't miss from there, and doesn't.",
      "{shooter} knocks the volley in from six yards.",
    ],
  },
  first_time: {
    sensational: [
      "{shooter} hits it first time from a ridiculous angle and it flies in!",
      "{shooter} flicks it first time with the outside of the boot into the far corner!",
      "{shooter} spins and shoots in one movement. What a finish!",
      "{shooter} backheels it past {keeper}. Cheeky, and brilliant!",
    ],
    quality: [
      "{shooter} sweeps it first time past {keeper}.",
      "{shooter} doesn't take a touch, just fires it low into the corner.",
      "{shooter} guides it first time inside the post.",
      "{shooter} finishes crisply, first time.",
    ],
    routine: [
      "{shooter} taps it in first time.",
      "{shooter} passes it into the net.",
      "{shooter} gets a toe to it and it's in.",
      "{shooter} applies the simplest of finishes.",
    ],
  },
  overhead: {
    sensational: [
      "{shooter} goes up for a sensational overhead kick, and it's in!",
      "{shooter} with a bicycle kick! {keeper} can only watch it sail in!",
      "{shooter} tries the overhead kick, and it hits the net! Goal of the season?",
      "{shooter} scissor-kicks it in! The whole club will be talking about this one.",
    ],
    quality: [
      "{shooter} hooks an overhead kick in off the post!",
      "{shooter} goes acrobatic and finds the corner.",
      "{shooter} tries the overhead, catches it just right, and it loops over {keeper}.",
      "{shooter} flips it backwards over everyone and in.",
    ],
    routine: [
      "{shooter} overhead-kicks it in from two yards. Why not?",
      "{shooter} goes for the overhead from close range and it trickles in.",
      "{shooter} decides a tap-in is too easy and scores with an overhead kick.",
      "{shooter} flicks it in acrobatically from point-blank range.",
    ],
  },
  through_ball: {
    sensational: [
      "{shooter} takes it round {keeper} and scores from the tightest of angles!",
      "{shooter} chips {keeper} from the edge of the box. Delightful!",
      "{shooter} dummies {keeper} twice and walks it in. Outrageous composure!",
      "{shooter} shoots early, through {keeper}'s legs and in!",
    ],
    quality: [
      "{shooter} slots it past {keeper}.",
      "{shooter} places it low into the far corner.",
      "{shooter} stays cool and finishes.",
      "{shooter} lifts it over the advancing {keeper}.",
    ],
    routine: [
      "{shooter} rolls it into the empty net.",
      "{shooter} finishes it off nicely.",
      "{shooter} tucks it away with ease.",
      "{shooter} makes the one-on-one look easy.",
    ],
  },
  free_kick: {
    sensational: [
      "{shooter} curls the free kick over the wall and into the top corner!",
      "{shooter} smashes the free kick straight through the wall and in!",
      "{shooter} bends it round the wall, and {keeper} can only admire it!",
      "{shooter} floats the free kick in off the underside of the bar!",
    ],
    quality: [
      "{shooter} sneaks the free kick inside the near post.",
      "{shooter} whips the free kick past a diving {keeper}.",
      "{shooter} rolls it under the jumping wall and in!",
      "{shooter} finds the bottom corner from the free kick.",
    ],
    routine: [
      "{shooter} bends the free kick home.",
      "{shooter} places the free kick beyond {keeper}.",
      "{shooter} tucks the free kick away.",
      "{shooter} sidefoots the free kick into the corner.",
    ],
  },
  curler: {
    sensational: [
      "{shooter} curls one into the top corner from twenty-five yards!",
      "{shooter} bends it round everyone and into the far corner. Gorgeous!",
      "{shooter} unfurls a curler that {keeper} just watches go in!",
      "{shooter} wraps a shot around the defender, and it nestles in the top corner!",
    ],
    quality: [
      "{shooter} curls it just inside the post.",
      "{shooter} bends it past the dive of {keeper}.",
      "{shooter} finds the far corner with a lovely curler.",
      "{shooter} curls it low and hard past {keeper}.",
    ],
    routine: [
      "{shooter} curls it past {keeper} from close range.",
      "{shooter} bends it into an unguarded corner.",
      "{shooter} places a curler in off the post.",
      "{shooter} guides a curler home.",
    ],
  },
  header: {
    sensational: [
      "{shooter} flings into a diving header and it rockets in!",
      "{shooter} heads it in off the underside of the bar from twelve yards!",
      "{shooter} glances a header across {keeper} and into the far corner. Superb!",
      "{shooter} rises like a salmon and powers it into the top corner!",
    ],
    quality: [
      "{shooter} heads it firmly past {keeper}.",
      "{shooter} glances a header just inside the post.",
      "{shooter} nods it back across goal and in.",
      "{shooter} gets above everyone and heads home.",
    ],
    routine: [
      "{shooter} nods it in from close range.",
      "{shooter} heads it into the empty net.",
      "{shooter} gets a free header and buries it.",
      "{shooter} can't miss with a header from there.",
    ],
  },
  scramble: {
    sensational: [
      "{shooter} somehow squeezes it in through a crowd of defenders!",
      "{shooter} scores from flat on the floor, amid total chaos!",
      "{shooter} hooks it in on the turn while everyone else is falling over!",
      "{shooter} flicks it through a forest of legs and in!",
    ],
    quality: [
      "{shooter} reacts first and pokes it in.",
      "{shooter} forces it over the line.",
      "{shooter} jabs it past {keeper} in the melee.",
      "{shooter} bundles it in at the second attempt.",
    ],
    routine: [
      "{shooter} scrambles it in. They all count.",
      "{shooter} taps it in from a yard out.",
      "{shooter} prods it over the line.",
      "{shooter} is in the right place at the right time.",
    ],
  },
  long_shot: {
    sensational: [
      "{shooter} lets fly from thirty yards, and it screams into the top corner!",
      "{shooter} hits an absolute thunderbolt! {keeper} didn't move!",
      "{shooter} tries it from the halfway line, and it's in!",
      "{shooter} unleashes a rocket that dips over {keeper} and in!",
    ],
    quality: [
      "{shooter} drills a long-range shot into the bottom corner.",
      "A shot from distance by {shooter} skids past {keeper}.",
      "{shooter} fires from twenty-five yards and it finds the corner.",
      "{shooter} tries it from range, and it deflects in.",
    ],
    routine: [
      "The long shot from {shooter} catches {keeper} off guard and goes in.",
      "{shooter} rolls it from distance into the empty net.",
      "A speculative effort from {shooter} creeps in.",
      "{shooter} chips it into the unguarded net from long range.",
    ],
  },
  long_throw: {
    sensational: [
      "{shooter} runs from the throw all the way to the box and chips it in!",
      "{shooter} volleys the long throw first time from way out, and it's in!",
      "{shooter} takes the throw in stride and lashes it into the top corner!",
      "{shooter} catches the whole defence asleep and curls it home!",
    ],
    quality: [
      "{shooter} races through and slots it past {keeper}.",
      "{shooter} takes one touch and fires it past {keeper}.",
      "{shooter} brings it down and finishes smartly.",
      "{shooter} makes the counter-attack count.",
    ],
    routine: [
      "{shooter} has only {keeper} to beat, and does.",
      "{shooter} rolls it in to finish the counter.",
      "{shooter} tucks it away after the quick restart.",
      "{shooter} finishes off a lightning break.",
    ],
  },
  cutback: {
    sensational: [
      "{shooter} flicks the cutback in with a backheel!",
      "{shooter} hits the cutback first time into the top corner!",
      "{shooter} dummies once, then smashes it in off the bar!",
      "{shooter} curls the cutback in from the edge of the box!",
    ],
    quality: [
      "{shooter} sweeps the cutback into the corner.",
      "{shooter} steers it past {keeper} from the penalty spot.",
      "{shooter} places the cutback inside the post.",
      "{shooter} finishes the move with a crisp strike.",
    ],
    routine: [
      "{shooter} side-foots the cutback home.",
      "{shooter} tucks it away from twelve yards.",
      "{shooter} can't miss, and doesn't.",
      "{shooter} taps the cutback in.",
    ],
  },
  one_two: {
    sensational: [
      "{shooter} takes the return pass and chips {keeper} from twenty yards!",
      "{shooter} volleys the return pass straight into the top corner!",
      "{shooter} completes the one-two with a curling finish. Beautiful football!",
      "{shooter} finishes a flowing move with a delicate lob!",
    ],
    quality: [
      "{shooter} drives it past {keeper} at the end of the move.",
      "{shooter} slides it under {keeper}.",
      "{shooter} finishes the one-two with a low shot into the corner.",
      "{shooter} rounds off a slick move.",
    ],
    routine: [
      "{shooter} rolls it into the net to finish the move.",
      "{shooter} tucks it in after the one-two.",
      "{shooter} finishes off the one-two at the back post.",
      "{shooter} walks it in. Lovely stuff.",
    ],
  },
};
