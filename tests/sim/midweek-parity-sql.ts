/**
 * Builds `supabase/tests/database/midweek_engine_parity.test.sql` from the
 * golden vectors, so the SQL engine is held to the same file as the TypeScript
 * twin (ADR-090). `node scripts/midweek/golden.mjs` writes both files, and
 * `tests/unit/midweek-parity-sql.test.ts` fails when the SQL is stale against
 * the fixture.
 *
 * The output is a pure function of the fixture: no dates, no randomness, so
 * regenerating an unchanged fixture leaves the file byte for byte the same.
 */

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

type Golden = {
  config: Json;
  draws: Array<{ seed: string; tag: string; draw: number }>;
  ovrFactors: Array<{ ovr: number; ppm: number }>;
  formRolls: Array<{ seed: string; tag: string; ppm: number }>;
  dayRolls: Array<{ seed: string; tag: string; ppm: number }>;
  pickShares: Array<{ picks: number; owners: number; sharePpm: number; pickFactorPpm: number }>;
  lineMults: Record<string, { attPpm: number; midPpm: number; defPpm: number }>;
  powerShares: Array<{ a: number; b: number; k: number; ppm: number }>;
  payouts: Array<{ rounds: number; pays: number[] }>;
  schedule: Array<{ weekStart: string; lockAt: string; round1RevealAt: string }>;
  matches: Array<{
    name: string;
    seed: string;
    prefix: string;
    sides: [Json, Json];
    outcome: Json;
  }>;
  tournaments: Array<{
    name: string;
    seed: string;
    seedHash: string;
    entrants: Json;
    result: { status: string; matches?: Json[] } & Record<string, Json | undefined>;
  }>;
};

function text(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function json(value: unknown): string {
  return `${text(JSON.stringify(value))}::jsonb`;
}

function seed(hex: string): string {
  return `decode(${text(hex)},'hex')`;
}

export function buildParitySql(golden: Golden): string {
  const asserts: string[] = [];
  const setup: string[] = [];
  const add = (sql: string) => asserts.push(sql);

  add(
    `select is(kut._mm_config(), ${json(golden.config)}, 'the SQL engine reads the configuration the TypeScript twin was built from');`,
  );

  for (const d of golden.draws) {
    add(
      `select is(kut._mm_draw(${seed(d.seed)}, ${text(d.tag)}), ${d.draw}::bigint, ${text(`draw for tag "${d.tag}"`)});`,
    );
  }
  for (const o of golden.ovrFactors) {
    add(
      `select is(kut._mm_ovr_factor(${o.ovr}), ${o.ppm}::bigint, ${text(`OVR factor at ${o.ovr}`)});`,
    );
  }
  for (const f of golden.formRolls) {
    add(
      `select is(kut._mm_form_roll(${seed(f.seed)}, ${text(f.tag)}), ${f.ppm}::bigint, ${text(`form roll ${f.tag}`)});`,
    );
  }
  for (const d of golden.dayRolls) {
    add(
      `select is(kut._mm_day_roll(${seed(d.seed)}, ${text(d.tag)}), ${d.ppm}::bigint, ${text(`day roll ${d.tag}`)});`,
    );
  }
  for (const p of golden.pickShares) {
    add(
      `select is(kut._mm_pick_share(${p.picks}, ${p.owners}), ${p.sharePpm}::bigint, ${text(`pick share, ${p.picks} of ${p.owners}`)});`,
    );
    add(
      `select is(kut._mm_pick_factor(${p.sharePpm}), ${p.pickFactorPpm}::bigint, ${text(`pick factor at share ${p.sharePpm}`)});`,
    );
  }
  for (const [archetype, lines] of Object.entries(golden.lineMults)) {
    add(
      `select is((select jsonb_build_object('attPpm', att_ppm, 'midPpm', mid_ppm, 'defPpm', def_ppm) from kut._mm_lines(${text(archetype)})), ${json(lines)}, ${text(`line multipliers of ${archetype}`)});`,
    );
  }
  for (const s of golden.powerShares) {
    add(
      `select is(kut._mm_power_share(${s.a}, ${s.b}, ${s.k}), ${s.ppm}::bigint, ${text(`power share ${s.a}, ${s.b}, k = ${s.k}`)});`,
    );
  }
  for (const p of golden.payouts) {
    add(
      `select is(kut._mm_round_payouts(${p.rounds}), array[${p.pays.join(",")}]::integer[], ${text(`payouts over ${p.rounds} rounds`)});`,
    );
  }
  for (const s of golden.schedule) {
    add(
      `select is(kut._mm_lock_at(${text(s.weekStart)}::date), ${text(s.lockAt)}::timestamptz, ${text(`lock of the week of ${s.weekStart}`)});`,
    );
    add(
      `select is(kut._mm_reveal_at(kut._mm_lock_at(${text(s.weekStart)}::date), 1), ${text(s.round1RevealAt)}::timestamptz, ${text(`round 1 reveal of the week of ${s.weekStart}`)});`,
    );
  }

  golden.matches.forEach((m, index) => {
    add(
      `select is(kut._mm_play_match(${seed(m.seed)}, ${text(m.prefix)}, ${json(m.sides[0])}, ${json(m.sides[1])}), ${json(m.outcome)}, ${text(`match ${index + 1}: ${m.name}`)});`,
    );
  });

  setup.push(
    "create temp table mw_parity_tournament (name text primary key, got jsonb not null, expected jsonb not null) on commit drop;",
  );
  for (const t of golden.tournaments) {
    setup.push(
      `insert into mw_parity_tournament values (${text(t.name)}, kut._mm_simulate(${seed(t.seed)}, ${json(t.entrants)}), ${json(t.result)});`,
    );
  }
  for (const t of golden.tournaments) {
    const part = (path: string) =>
      `(select ${path} from mw_parity_tournament where name = ${text(t.name)})`;
    add(
      `select is(encode(sha256(${seed(t.seed)}), 'hex'), ${text(t.seedHash)}, ${text(`${t.name}: seed hash`)});`,
    );
    if (t.result.status !== "simulated") {
      add(`select is(${part("got")}, ${part("expected")}, ${text(`${t.name}: result`)});`);
      continue;
    }
    add(
      `select is(${part("got - 'entries' - 'pickShares' - 'byes' - 'matches' - 'payouts'")}, ${part("expected - 'entries' - 'pickShares' - 'byes' - 'matches' - 'payouts'")}, ${text(`${t.name}: status, size, rounds and champion`)});`,
    );
    for (const key of ["entries", "pickShares", "byes", "payouts"]) {
      add(
        `select is(${part(`got->'${key}'`)}, ${part(`expected->'${key}'`)}, ${text(`${t.name}: ${key}`)});`,
      );
    }
    add(
      `select is(${part("jsonb_array_length(got->'matches')")}, ${t.result.matches!.length}, ${text(`${t.name}: match count`)});`,
    );
    t.result.matches!.forEach((_, index) => {
      add(
        `select is(${part(`got->'matches'->${index}`)}, ${part(`expected->'matches'->${index}`)}, ${text(`${t.name}: match ${index + 1}`)});`,
      );
    });
  }

  return [
    "-- GENERATED by `node scripts/midweek/golden.mjs` from tests/fixtures/midweek-golden.json.",
    "-- Do not edit by hand: tests/unit/midweek-parity-sql.test.ts fails when this file",
    "-- is stale against the fixture.",
    "--",
    "-- Midweek Madness engine parity (BUILD_SPEC §44.8, ADR-090): the SQL engine in",
    "-- 20261005000000_midweek_engine.sql reproduces every golden value the TypeScript",
    "-- twin in src/game/midweek/ produced, draw for draw.",
    "begin;",
    "create extension if not exists pgtap with schema extensions;",
    "set local search_path to extensions,kut,public;",
    "",
    `select plan(${asserts.length});`,
    "",
    ...setup,
    "",
    ...asserts,
    "",
    "select * from finish();",
    "rollback;",
    "",
  ].join("\n");
}
