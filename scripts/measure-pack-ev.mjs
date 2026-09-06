// Pack expected-value measurement for release evidence (operator handoff, C).
//
// This reads kut.pack_economy_health — the same admin projection the Economy
// screen renders — rather than re-deriving the rarity weights, the discard
// curve and the pack price. Those live in SQL and must have exactly one
// definition; an earlier version of this script kept a fifth copy of them and
// could drift from the odds the game actually ships (ADR-064).
//
// The view is security_invoker and gated on kut.is_admin(), so we resolve an
// admin profile first and then run the read as that member.
import pg from "pg";

const connectionString = process.env.KUT_LOCAL_DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const client = new pg.Client({ connectionString });
await client.connect();
try {
  await client.query("begin");
  const { rows: admins } = await client.query(
    "select id::text from kut.profiles where role in ('admin','superadmin') order by role limit 1",
  );
  if (admins.length === 0) throw new Error("No admin or superadmin profile exists; kut.pack_economy_health cannot be read.");

  // Claim first, then drop to authenticated — RLS hides kut.profiles once the
  // role is switched, so the lookup above has to happen as the connecting role.
  await client.query("select set_config('request.jwt.claim.sub',$1,true)", [admins[0].id]);
  await client.query("set local role authenticated");

  const { rows } = await client.query(`
    select slug, title, price, cards_per_pack, eligible_live_count,
           expected_discard_per_slot, expected_discard_per_pack, expected_discard_return_ratio
      from kut.pack_economy_health
     order by slug
  `);
  if (rows.length === 0) throw new Error("kut.pack_economy_health returned no active pack; nothing to measure.");

  console.log(JSON.stringify({ measuredAt: new Date().toISOString(), source: "kut.pack_economy_health", packs: rows }, null, 2));
} finally {
  await client.query("rollback").catch(() => {});
  await client.end();
}
