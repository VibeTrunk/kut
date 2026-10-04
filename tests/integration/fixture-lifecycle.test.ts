import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { localDatabaseUrl } from "../support/local-target";
import {
  advanceFixtureEvening,
  endFixtureEvening,
  removeMidweekFixture,
  seedMidweekFixture,
  startFixtureEvening,
} from "../e2e-authenticated/midweek-fixture";

const url = localDatabaseUrl();
const member = "00000098-0000-4000-8000-000000000001";
const unrelated = "00000098-0000-4000-8000-000000000002";
let database: Client;
let ownsLifecycle = false;

async function state() {
  return (
    await database.query(`select
      (select md5(string_agg(id::text || ':' || archetype::text, ',' order by id))
        from kut.players where id::text not like '00000097-%') as archetypes,
      (select md5(string_agg(user_id::text || ':' || balance::text, ',' order by user_id))
        from kut.wallets) as wallets,
      (select md5(string_agg(id::text || ':' || amount::text, ',' order by id))
        from kut.wallet_ledger) as ledger`)
  ).rows[0];
}

async function completeInCrashedProcess() {
  await startFixtureEvening(database);
  await advanceFixtureEvening(database, 180);
  const child = spawnSync(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      `import pg from 'pg';
       const db = new pg.Client({connectionString:process.env.DB_URL});
       await db.connect(); await db.query('begin');
       await db.query('set local role service_role');
       await db.query("set local request.jwt.claim.role = 'service_role'");
       const r = await db.query('select kut.run_midweek_due(5) as result');
       await db.query('commit');
       process.exit(r.rows[0].result.opened === 1 ? 23 : 24);`,
    ],
    { env: { ...process.env, DB_URL: url }, encoding: "utf8" },
  );
  // Exit immediately after the worker commit: no worker/test teardown runs.
  expect(child.status).toBe(23);
  const successors = await database.query(
    "select id from kut_e2e_fixture.weeks where id <> owner_id",
  );
  expect(successors.rowCount).toBe(1);
  expect(
    Number(
      (
        await database.query(
          "select count(*) from kut.midweek_archetype_rotations where tournament_id=$1",
          [successors.rows[0].id],
        )
      ).rows[0].count,
    ),
  ).toBeGreaterThan(0);
}

describe("durable local authenticated fixture ownership", () => {
  beforeAll(async () => {
    database = new Client({ connectionString: url });
    await database.connect();
    const active = await database.query(
      "select 1 from kut.midweek_tournaments where status in ('open','simulated') limit 1",
    );
    if (active.rowCount)
      throw new Error("Run the lifecycle test on a local stack without active weeks.");
    const residue = await database.query(`
      select 1 from pg_namespace where nspname = 'kut_e2e_fixture'
      union all select 1 from kut.players where id::text like '00000097-%' limit 1
    `);
    if (residue.rowCount)
      throw new Error(
        "Preserve existing fixture evidence before running the lifecycle regression.",
      );
    await database.query(
      "insert into auth.users(id,email,aud,role) values ($1,'fixture_lifecycle@users.kut.local','authenticated','authenticated')",
      [member],
    );
    ownsLifecycle = true;
    await database.query(
      "insert into kut.profiles(id,display_name,role) values ($1,'Fictional Lifecycle Member','user')",
      [member],
    );
    await database.query("insert into kut.wallets(user_id,balance) values ($1,500)", [member]);
  });

  afterAll(async () => {
    if (!database) return;
    // A refused preflight must never tear down another runner's fixtures.
    if (!ownsLifecycle) {
      await database.end();
      return;
    }
    try {
      await database.query(
        "drop trigger if exists kut_e2e_interrupt_recovery on kut.midweek_tournaments",
      );
      await database.query("drop function if exists kut_e2e_fixture.interrupt_recovery()");
      await removeMidweekFixture(database, true);
      await database.query("delete from kut.midweek_tournaments where id=$1", [unrelated]);
      await database.query("delete from auth.users where id=$1", [member]);
    } finally {
      await database.end();
    }
  });

  it("recovers a killed worker, restores the economy/archetypes, and is idempotent", async () => {
    const before = await state();
    await seedMidweekFixture(database, member);
    await completeInCrashedProcess();
    // A different connection models the next process finding the durable journal.
    const recovery = new Client({ connectionString: url });
    await recovery.connect();
    try {
      await removeMidweekFixture(recovery);
      await removeMidweekFixture(recovery);
    } finally {
      await recovery.end();
    }
    expect(await state()).toEqual(before);
    expect((await database.query("select 1 from kut_e2e_fixture.weeks")).rowCount).toBe(0);
    expect((await database.query("select 1 from kut.midweek_archetype_rotations")).rowCount).toBe(
      0,
    );
  });

  it("preserves an unrelated later week during normal and global cleanup", async () => {
    const before = await state();
    await seedMidweekFixture(database, member);
    await completeInCrashedProcess();
    await database.query(
      "insert into kut.midweek_tournaments(id,week_start,lock_at,seed_hash) values ($1,'2050-01-03','2050-01-05T19:00:00Z',$2)",
      [unrelated, createHash("sha256").update("unrelated-lifecycle-control").digest("hex")],
    );
    await endFixtureEvening(database);
    await endFixtureEvening(database);
    await removeMidweekFixture(database);
    expect(
      (await database.query("select 1 from kut.midweek_tournaments where id=$1", [unrelated]))
        .rowCount,
    ).toBe(1);
    expect(await state()).toEqual(before);
    await database.query("delete from kut.midweek_tournaments where id=$1", [unrelated]);
  });

  it("rolls back an interrupted recovery and safely retries it", async () => {
    const before = await state();
    await seedMidweekFixture(database, member);
    await completeInCrashedProcess();
    const interruptedState = await state();
    await database.query(`
      create function kut_e2e_fixture.interrupt_recovery() returns trigger
      language plpgsql as $$ begin raise exception 'intentional recovery interruption'; end $$;
      create trigger kut_e2e_interrupt_recovery before delete on kut.midweek_tournaments
      for each row execute function kut_e2e_fixture.interrupt_recovery();
    `);
    await expect(removeMidweekFixture(database)).rejects.toThrow(
      "intentional recovery interruption",
    );
    expect(await state()).toEqual(interruptedState);
    expect((await database.query("select 1 from kut_e2e_fixture.weeks")).rowCount).toBe(3);
    await database.query("drop trigger kut_e2e_interrupt_recovery on kut.midweek_tournaments");
    await database.query("drop function kut_e2e_fixture.interrupt_recovery()");
    await removeMidweekFixture(database);
    await removeMidweekFixture(database);
    expect(await state()).toEqual(before);
  });

  it("fails closed before deleting the owner when its successor journal is missing", async () => {
    const before = await state();
    await seedMidweekFixture(database, member);
    await completeInCrashedProcess();
    const record = (
      await database.query("delete from kut_e2e_fixture.weeks where id <> owner_id returning *")
    ).rows[0];
    // The owner's atomically captured successor list still identifies the gap.
    const interruptedState = await state();
    await expect(removeMidweekFixture(database)).rejects.toThrow("ownership evidence");
    expect(await state()).toEqual(interruptedState);
    await database.query(
      "insert into kut_e2e_fixture.weeks(id,owner_id,seed_hash,week_start) values($1,$2,$3,$4)",
      [record.id, record.owner_id, record.seed_hash, record.week_start],
    );
    await removeMidweekFixture(database);
    expect(await state()).toEqual(before);
  });

  it("restores an originally enabled switch without opening an unowned archived successor", async () => {
    await removeMidweekFixture(database, true);
    const original = (await database.query("select enabled from kut.midweek_config")).rows[0]
      .enabled;
    const before = await state();
    await database.query("update kut.midweek_config set enabled = true");
    await seedMidweekFixture(database, member);
    await completeInCrashedProcess();
    await removeMidweekFixture(database, true);
    await removeMidweekFixture(database, true);
    expect((await database.query("select enabled from kut.midweek_config")).rows[0].enabled).toBe(
      true,
    );
    expect(await state()).toEqual(before);
    await database.query("update kut.midweek_config set enabled = $1", [original]);
  });
});
