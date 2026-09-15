import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { localDatabaseUrl } from "../support/local-target";

const url = localDatabaseUrl();

// Every id this suite writes lives under the 40000000- prefix, including its own
// players, season and session. Nothing is shared with another integration file
// or with supabase/seed.sql.
const fx = {
  scorer: "40000000-0000-4000-8000-000000000001",
  praiser: "40000000-0000-4000-8000-000000000002",
  quiet: "40000000-0000-4000-8000-000000000003",
  scorerPlayer: "40000000-0000-4000-8000-000000000011",
  praiserPlayer: "40000000-0000-4000-8000-000000000012",
  quietPlayer: "40000000-0000-4000-8000-000000000013",
  season: "40000000-0000-4000-8000-000000000021",
  session: "40000000-0000-4000-8000-000000000022",
  seed: "40000000-0000-4000-8000-000000000040",
};
// Seeded by 20260920000000_session_reports_rating_v2.sql.
const categories = [
  "10000000-0000-4000-8000-000000000001",
  "10000000-0000-4000-8000-000000000002",
  "10000000-0000-4000-8000-000000000003",
];
const users = [fx.scorer, fx.praiser, fx.quiet];
const players = [fx.scorerPlayer, fx.praiserPlayer, fx.quietPlayer];

let db: Client;

async function cleanup() {
  await db.query("delete from kut.user_notifications where user_id=any($1::uuid[])", [users]);
  await db.query("delete from kut.session_report_requests where user_id=any($1::uuid[])", [users]);
  await db.query("delete from kut.session_report_results where session_id=$1", [fx.session]);
  await db.query("delete from kut.session_report_rewards where session_id=$1", [fx.session]);
  await db.query("delete from kut.session_kudos where session_id=$1", [fx.session]);
  await db.query("delete from kut.session_reports where session_id=$1", [fx.session]);
  await db.query("delete from kut.session_survey_eligibility where session_id=$1", [fx.session]);
  await db.query("delete from kut.session_surveys where session_id=$1", [fx.session]);
  await db.query("delete from kut.attendance_rewards where session_id=$1", [fx.session]);
  await db.query("delete from kut.attendance where session_id=$1", [fx.session]);
  await db.query("delete from kut.match_sessions where id=$1", [fx.session]);
  await db.query("delete from kut.player_rating_snapshots where season_id=$1", [fx.season]);
  await db.query("delete from kut.player_season_state where season_id=$1", [fx.season]);
  await db.query("delete from kut.season_rating_rules where season_id=$1", [fx.season]);
  await db.query("delete from kut.seasons where id=$1", [fx.season]);
  await db.query("delete from kut.wallet_ledger where user_id=any($1::uuid[])", [users]);
  await db.query("delete from kut.wallets where user_id=any($1::uuid[])", [users]);
  await db.query("delete from kut.profiles where id=any($1::uuid[])", [users]);
  await db.query("delete from auth.users where id=any($1::uuid[])", [users]);
  await db.query("delete from kut.players where id=any($1::uuid[])", [players]);
}

/**
 * Seeds one published session whose 24-hour report window closed an hour ago —
 * exactly the state the scheduled finalizer is supposed to pick up.
 *
 * All three attendees submit and nominate, so turnout reaches the 3 the kudos
 * rules require. The scorer is nominated in the same category by both other
 * players, which is the >= 2 distinct nominators a category needs to qualify.
 */
async function seedDueSession() {
  await db.query(
    `insert into auth.users(id,email,aud,role,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
     select u.id,u.email,'authenticated','authenticated','{}','{}',now(),now()
     from (values($1::uuid,'finalizer-scorer@example.test'),($2,'finalizer-praiser@example.test'),($3,'finalizer-quiet@example.test')) u(id,email)`,
    users,
  );
  await db.query(
    `insert into kut.players(id,slug,display_name,archetype) values
       ($1,'finalizer-scorer','Finalizer Scorer','all_rounder'),
       ($2,'finalizer-praiser','Finalizer Praiser','all_rounder'),
       ($3,'finalizer-quiet','Finalizer Quiet','all_rounder')`,
    players,
  );
  await db.query(
    `insert into kut.profiles(id,display_name,role,player_id) values
       ($1,'Finalizer Scorer','user',$4),($2,'Finalizer Praiser','user',$5),($3,'Finalizer Quiet','user',$6)`,
    [...users, ...players],
  );
  await db.query(
    "insert into kut.wallets(user_id,balance) values($1,500),($2,500),($3,500)",
    users,
  );
  await db.query(
    "insert into kut.seasons(id,name,starts_on,is_active) values($1,'Finalizer Readiness',current_date,false)",
    [fx.season],
  );
  await db.query(
    `insert into kut.match_sessions(id,season_id,session_date,session_type,status,published_at,rating_rules_version)
     values($1,$2,current_date,'other','published',now(),2)`,
    [fx.session, fx.season],
  );
  await db.query(
    `insert into kut.attendance(session_id,player_id,goals) values($1,$2,2),($1,$3,0),($1,$4,0)`,
    [fx.session, ...players],
  );
  // The survey's check constraint pins closes_at to opened_at + 24h, so a due
  // window is made by backdating opened_at, never by moving closes_at.
  await db.query(
    `insert into kut.session_surveys(session_id,opened_at,closes_at,category_ids,selection_seed)
     values($1,now()-interval '25 hours',now()-interval '1 hour',$2,$3)`,
    [fx.session, categories, fx.seed],
  );
  await db.query(
    `insert into kut.session_survey_eligibility(session_id,player_id,user_id) values
       ($1,$2,$5),($1,$3,$6),($1,$4,$7)`,
    [fx.session, ...players, ...users],
  );
  await db.query(
    `insert into kut.session_reports(session_id,player_id,submitted_by,goals,status,submitted_at) values
       ($1,$2,$5,2,'submitted',now()-interval '2 hours'),
       ($1,$3,$6,0,'submitted',now()-interval '2 hours'),
       ($1,$4,$7,0,'submitted',now()-interval '2 hours')`,
    [fx.session, ...players, ...users],
  );
  // Two distinct nominators name the scorer in categories[0]; the scorer names
  // the praiser once, which is one nominator and must NOT qualify.
  await db.query(
    `insert into kut.session_kudos(session_id,nominator_player_id,category_id,recipient_player_id) values
       ($1,$3,$5,$2),($1,$4,$5,$2),($1,$2,$5,$3)`,
    [fx.session, fx.scorerPlayer, fx.praiserPlayer, fx.quietPlayer, categories[0]],
  );
}

async function asServiceRole<T>(run: () => Promise<T>): Promise<T> {
  await db.query("begin");
  try {
    await db.query("set local role service_role");
    await db.query("select set_config('request.jwt.claim.role','service_role',true)");
    const value = await run();
    await db.query("commit");
    return value;
  } catch (error) {
    await db.query("rollback");
    throw error;
  }
}

beforeAll(async () => {
  db = new Client({ connectionString: url });
  await db.connect();
  await cleanup();
  await seedDueSession();
});

afterAll(async () => {
  await cleanup();
  await db.end();
});

describe("session-survey finalizer readiness", () => {
  it("is callable only by service_role", async () => {
    const privileges = await db.query(
      `select
         has_function_privilege('service_role','kut.finalize_session_surveys(integer)','execute') service,
         has_function_privilege('authenticated','kut.finalize_session_surveys(integer)','execute') member,
         has_function_privilege('anon','kut.finalize_session_surveys(integer)','execute') anonymous`,
    );
    expect(privileges.rows[0]).toEqual({ service: true, member: false, anonymous: false });
  });

  it("finalizes a due session end to end and records a clean job", async () => {
    const jobsBefore = await db.query(
      "select coalesce(max(id),0)::int high from kut.session_survey_jobs",
    );
    const processed = await asServiceRole(async () =>
      db.query("select kut.finalize_session_surveys(20) processed"),
    );
    // >= 1, not == 1: a developer's local stack may carry other due surveys.
    // Every assertion below is scoped to this suite's own session.
    expect(processed.rows[0].processed).toBeGreaterThanOrEqual(1);

    // The survey is closed, and closed on the automatic path: ADR-067 uses null
    // finalized_by/finalized_reason to mean "closed at its own deadline".
    const survey = await db.query(
      "select status,finalized_at,finalized_by,finalized_reason from kut.session_surveys where session_id=$1",
      [fx.session],
    );
    expect(survey.rows[0].status).toBe("finalized");
    expect(survey.rows[0].finalized_at).not.toBeNull();
    expect(survey.rows[0].finalized_by).toBeNull();
    expect(survey.rows[0].finalized_reason).toBeNull();

    // One result row per attendee, not per reporter.
    const results = await db.query(
      `select player_id,effective_goals,goal_form,kudos_form,session_input,qualified_category_ids
       from kut.session_report_results where session_id=$1 order by player_id`,
      [fx.session],
    );
    expect(results.rows).toHaveLength(3);
    const byPlayer = Object.fromEntries(results.rows.map((row) => [row.player_id, row]));

    // The scorer reported 2 goals and cleared one category with two nominators:
    // goal_form 1.25 + kudos_form 1 on the ADR-063 ladder.
    expect(byPlayer[fx.scorerPlayer]).toMatchObject({ effective_goals: 2 });
    expect(Number(byPlayer[fx.scorerPlayer].goal_form)).toBe(1.25);
    expect(Number(byPlayer[fx.scorerPlayer].kudos_form)).toBe(1);
    expect(byPlayer[fx.scorerPlayer].qualified_category_ids).toEqual([categories[0]]);

    // The praiser was named by exactly one nominator, which is below the
    // two-nominator bar, so nothing qualifies.
    expect(byPlayer[fx.praiserPlayer].qualified_category_ids).toEqual([]);
    expect(Number(byPlayer[fx.praiserPlayer].kudos_form)).toBe(0);

    for (const row of results.rows) {
      expect(Number(row.session_input)).toBeCloseTo(
        Math.min(3.5, Number(row.goal_form) + Number(row.kudos_form)),
        5,
      );
      expect(Number(row.session_input)).toBeGreaterThanOrEqual(0);
      expect(Number(row.session_input)).toBeLessThanOrEqual(3.5);
    }

    // The season rebuild ran, which is what writes the weekly snapshots the
    // Chronicle graph reads.
    const snapshots = await db.query(
      "select count(*)::int count from kut.player_rating_snapshots where season_id=$1",
      [fx.season],
    );
    expect(snapshots.rows[0].count).toBeGreaterThan(0);

    // A job row exists for this run and carries no suppressed error. The
    // deployed runner swallows failures, so an unnoticed error_text here is the
    // exact shape of the defect this test exists to catch.
    const job = await db.query(
      "select processed_count,finished_at,error_text from kut.session_survey_jobs where id>$1 order by id desc limit 1",
      [jobsBefore.rows[0].high],
    );
    expect(job.rows).toHaveLength(1);
    expect(job.rows[0].error_text).toBeNull();
    expect(job.rows[0].finished_at).not.toBeNull();
    expect(job.rows[0].processed_count).toBeGreaterThanOrEqual(1);

    // Everyone eligible is told, including the member who reported nothing.
    const notices = await db.query(
      `select count(*)::int count from kut.user_notifications
       where event_type='session_results' and reference_id=$1 and user_id=any($2::uuid[])`,
      [fx.session, users],
    );
    expect(notices.rows[0].count).toBe(3);
  });

  it("does not finalize the same session twice", async () => {
    const before = await db.query(
      "select finalized_at,revision from kut.session_surveys where session_id=$1",
      [fx.session],
    );
    const processed = await asServiceRole(async () =>
      db.query("select kut.finalize_session_surveys(20) processed"),
    );
    // The batch selects status='open' rows only, so a finalized survey is not
    // picked up again and no rating movement is replayed. The proof is that
    // this survey's finalized_at and revision are untouched, not the count.
    expect(processed.rows[0].processed).toBe(0);
    const after = await db.query(
      "select finalized_at,revision from kut.session_surveys where session_id=$1",
      [fx.session],
    );
    expect(after.rows[0]).toEqual(before.rows[0]);
  });

  it("rejects an out-of-range batch limit", async () => {
    await expect(
      asServiceRole(async () => db.query("select kut.finalize_session_surveys(0)")),
    ).rejects.toThrow(/batch limit/);
  });
});
