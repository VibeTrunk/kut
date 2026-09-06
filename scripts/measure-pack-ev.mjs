import pg from "pg";

const connectionString = process.env.KUT_LOCAL_DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const client = new pg.Client({ connectionString });
await client.connect();
try {
  const { rows } = await client.query(`
    with eligible as (
      select case coalesce(state.rarity_tier,'common') when 'common' then 100 when 'bronze' then 60 when 'silver' then 30 when 'gold' then 12 when 'holo' then 4 when 'elite' then 1 end::numeric weight,
        round(10*power(1.08::numeric,coalesce(state.live_ovr,30)-30))::numeric discard_value
      from kut.card_editions edition join kut.players player on player.id=edition.player_id
      left join kut.seasons season on season.is_active
      left join kut.player_season_state state on state.player_id=player.id and state.season_id=season.id
      where edition.is_live and edition.edition_type='live' and player.is_active and player.is_collectible
    ), measured as (
      select count(*)::integer eligible_live_count,sum(weight*discard_value)/nullif(sum(weight),0) expected_slot from eligible
    ) select eligible_live_count,round(expected_slot,2) expected_discard_per_slot,
      round(expected_slot*3,2) expected_discard_per_pack,round(expected_slot*3/175,4) expected_discard_return_ratio
    from measured
  `);
  console.log(JSON.stringify({ measuredAt: new Date().toISOString(), source: "local active roster", packPrice: 175, cardsPerPack: 3, ...rows[0] }, null, 2));
} finally {
  await client.end();
}
