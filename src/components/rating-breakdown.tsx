import {
  carriedForm,
  describeCarriedDecay,
  describeCarriedForm,
  describeContribution,
  describeDecay,
  describeFormTotal,
  describeRatingBase,
  type FormContribution,
  type RatingBreakdown,
} from "@/lib/rating-story";

/**
 * "Why this rating" — the story behind a Live card's OVR (ADR-074).
 *
 * Presentational only. Every number arrives already computed by
 * `kut.player_rating_breakdown` / `kut.player_form_contributions`; nothing here
 * recalculates a rating (ADR-064). Per RATING_BALANCE_REVIEW, per-session detail
 * is expressed in Form and only the combined bonus is stated in OVR.
 *
 * The rows must SUM TO THE TOTAL. `player_form_contributions` sees only the
 * per-session half of the engine's Form, so a player still carrying Form from
 * before self-reporting began had an unexplained gap between their rows and
 * their total — and one carrying nothing else was told "this rating is all
 * attendance" directly under a box reading "+2 from Form". `carriedForm()`
 * recovers that remainder and it is rendered as a row of its own.
 */
function FormRow({ line, detail }: { line: string; detail: string }) {
  return (
    <li className="rounded-xl border border-line/60 bg-board/40 p-3">
      <p className="text-sm font-bold">{line}</p>
      <p className="mt-1 text-xs text-ink-faint">{detail}</p>
    </li>
  );
}

export function RatingBreakdownStory({
  playerName,
  breakdown,
  contributions,
}: {
  playerName: string;
  breakdown: RatingBreakdown;
  contributions: FormContribution[];
}) {
  const live = contributions
    .map((contribution) => ({ contribution, line: describeContribution(contribution) }))
    .filter((entry): entry is { contribution: FormContribution; line: string } =>
      Boolean(entry.line),
    );
  const carried = carriedForm(breakdown, contributions);
  const hasRows = live.length > 0 || carried > 0;

  return (
    <section className="rounded-2xl border border-line bg-board-deep/40 p-4">
      <h2 className="font-black">Why this rating</h2>
      <p className="mt-2 text-sm text-ink-faint">{describeRatingBase(playerName, breakdown)}</p>

      <dl className="mt-4 grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-board/60 p-3">
          <dt className="text-xs font-bold uppercase tracking-[0.12em] text-ink-faint">
            From attendance
          </dt>
          <dd className="mt-1 text-lg font-black">{breakdown.attendance_base}</dd>
        </div>
        <div className="rounded-xl bg-board/60 p-3">
          <dt className="text-xs font-bold uppercase tracking-[0.12em] text-ink-faint">
            From Form
          </dt>
          <dd className="mt-1 text-lg font-black">
            {breakdown.form_bonus > 0 ? `+${breakdown.form_bonus}` : "0"}
          </dd>
        </div>
      </dl>

      {breakdown.is_ovr_capped && (
        <p className="mt-3 text-xs text-ink-faint">
          This rating sits at the 83 ceiling, so the attendance figure above is shown after the cap.
        </p>
      )}

      {hasRows ? (
        <div className="mt-4">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-ink-faint">
            What&rsquo;s in that Form
          </p>
          <ul className="mt-2 space-y-2">
            {live.map(({ contribution, line }) => (
              <FormRow
                detail={describeDecay(contribution)}
                key={contribution.session_id}
                line={line}
              />
            ))}
            {carried > 0 && (
              <FormRow
                detail={describeCarriedDecay()}
                key="carried"
                line={describeCarriedForm(carried)}
              />
            )}
          </ul>
          <p className="mt-3 text-sm font-bold">{describeFormTotal(breakdown)}</p>
          {carried < 0 && (
            <p className="mt-2 text-xs text-ink-faint">
              Form tops out at 8, so the sessions above add up to more than the rating can use.
            </p>
          )}
          <p className="mt-2 text-xs text-ink-faint">
            Form fades over the following few sessions, so a big night lifts a rating for a while
            rather than permanently. Attendance is what builds a rating for good.
          </p>
          {live.length === 0 && (
            <p className="mt-2 text-xs text-ink-faint">
              No recent session is adding Form yet. Goals and kudos from the next session will show
              up here.
            </p>
          )}
        </div>
      ) : (
        <p className="mt-4 text-sm text-ink-faint">
          No recent session is adding Form right now, so this rating is all attendance. Goals and
          kudos from the next session will show up here.
        </p>
      )}
    </section>
  );
}
