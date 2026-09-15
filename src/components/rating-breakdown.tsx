import {
  describeContribution,
  describeDecay,
  describeFormTotal,
  describeRatingBase,
  formatForm,
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
 */
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

      {live.length > 0 ? (
        <div className="mt-4">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-ink-faint">
            What&rsquo;s in that Form
          </p>
          <ul className="mt-2 space-y-2">
            {live.map(({ contribution, line }) => (
              <li
                className="rounded-xl border border-line/60 bg-board/40 p-3"
                key={contribution.session_id}
              >
                <p className="text-sm font-bold">{line}</p>
                <p className="mt-1 text-xs text-ink-faint">{describeDecay(contribution)}</p>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-sm font-bold">{describeFormTotal(breakdown)}</p>
          <p className="mt-2 text-xs text-ink-faint">
            Form fades over the following few sessions, so a big night lifts a rating for a while
            rather than permanently. Attendance is what builds a rating for good.
          </p>
        </div>
      ) : (
        <p className="mt-4 text-sm text-ink-faint">
          No recent session is adding Form right now, so this rating is all attendance. Goals and
          kudos from the next session will show up here.
        </p>
      )}

      {breakdown.form_score > 0 && live.length === 0 && (
        <p className="mt-2 text-xs text-ink-faint">
          Carried Form: {formatForm(breakdown.form_score)}.
        </p>
      )}
    </section>
  );
}
