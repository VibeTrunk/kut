import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const databaseUrl = process.env.KUT_LOCAL_DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const fixture = { seller: "00000000-0000-4000-8000-0000000000a1", buyerA: "00000000-0000-4000-8000-0000000000a2", buyerB: "00000000-0000-4000-8000-0000000000a3", edition: "00000000-0000-4000-8000-0000000000a4", card: "00000000-0000-4000-8000-0000000000a5", listing: "00000000-0000-4000-8000-0000000000a6", player: "00000000-0000-4000-8000-000000000001" };
const fixtureUsers = [fixture.seller, fixture.buyerA, fixture.buyerB];
let admin: Client;
let buyerA: Client;
let buyerB: Client;

async function cleanup() {
  await admin.query("delete from kut.user_notifications where user_id = any($1::uuid[])", [fixtureUsers]);
  await admin.query("delete from kut.wallet_ledger where user_id = any($1::uuid[])", [fixtureUsers]);
  await admin.query("delete from kut.market_sales where listing_id = $1", [fixture.listing]);
  await admin.query("delete from kut.market_listings where id = $1", [fixture.listing]);
  await admin.query("delete from kut.user_cards where id = $1", [fixture.card]);
  await admin.query("delete from kut.card_editions where id = $1", [fixture.edition]);
  await admin.query("delete from kut.wallets where user_id = any($1::uuid[])", [fixtureUsers]);
  await admin.query("delete from kut.profiles where id = any($1::uuid[])", [fixtureUsers]);
  await admin.query("delete from auth.users where id = any($1::uuid[])", [fixtureUsers]);
}

async function prepareBuyer(client: Client, userId: string) {
  await client.query("begin");
  await client.query("set local role authenticated");
  await client.query("select set_config('request.jwt.claim.sub', $1, true)", [userId]);
}

async function attemptPurchase(client: Client, idempotencyKey: string) {
  try {
    const result = await client.query("select kut.buy_listing($1, $2) as sale", [fixture.listing, idempotencyKey]);
    await client.query("commit");
    return { error: null, sale: result.rows[0].sale };
  } catch (error) {
    await client.query("rollback");
    return { error, sale: null };
  }
}

describe("local two-client market race", () => {
  beforeAll(async () => {
    admin = new Client({ connectionString: databaseUrl }); buyerA = new Client({ connectionString: databaseUrl }); buyerB = new Client({ connectionString: databaseUrl });
    await Promise.all([admin.connect(), buyerA.connect(), buyerB.connect()]);
    await cleanup();
    await admin.query("insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values ($1, 'race-seller@example.test', 'authenticated', 'authenticated', '{}'::jsonb, '{}'::jsonb, now(), now()), ($2, 'race-buyer-a@example.test', 'authenticated', 'authenticated', '{}'::jsonb, '{}'::jsonb, now(), now()), ($3, 'race-buyer-b@example.test', 'authenticated', 'authenticated', '{}'::jsonb, '{}'::jsonb, now(), now())", [fixture.seller, fixture.buyerA, fixture.buyerB]);
    await admin.query("insert into kut.profiles (id, display_name, role) values ($1, 'Race Seller', 'user'), ($2, 'Race Buyer A', 'user'), ($3, 'Race Buyer B', 'user')", [fixture.seller, fixture.buyerA, fixture.buyerB]);
    await admin.query("insert into kut.wallets (user_id, balance) values ($1, 0), ($2, 500), ($3, 500)", [fixture.seller, fixture.buyerA, fixture.buyerB]);
    await admin.query("insert into kut.card_editions (id, player_id, edition_type, title, is_live, snapshot_ovr, snapshot_pac, snapshot_sho, snapshot_pas, snapshot_dri, snapshot_def, snapshot_phy, special_discard_multiplier) values ($1, $2, 'other', 'Two-client race fixture', false, 50, 50, 50, 50, 50, 50, 50, 1)", [fixture.edition, fixture.player]);
    await admin.query("insert into kut.user_cards (id, edition_id, owner_id, is_tradeable, source) values ($1, $2, $3, true, 'pack')", [fixture.card, fixture.edition, fixture.seller]);
    await admin.query("insert into kut.market_listings (id, card_id, seller_id, price) values ($1, $2, $3, 100)", [fixture.listing, fixture.card, fixture.seller]);
  });

  afterAll(async () => { await cleanup(); await Promise.all([admin.end(), buyerA.end(), buyerB.end()]); });

  it("permits exactly one concurrent buyer to complete the protected RPC", async () => {
    await Promise.all([prepareBuyer(buyerA, fixture.buyerA), prepareBuyer(buyerB, fixture.buyerB)]);
    const [attemptA, attemptB] = await Promise.all([attemptPurchase(buyerA, "00000000-0000-4000-8000-0000000000b1"), attemptPurchase(buyerB, "00000000-0000-4000-8000-0000000000b2")]);
    const successes = [{ userId: fixture.buyerA, attempt: attemptA }, { userId: fixture.buyerB, attempt: attemptB }].filter(({ attempt }) => attempt.error === null);
    expect(successes).toHaveLength(1);
    const winner = successes[0].userId; const loser = winner === fixture.buyerA ? fixture.buyerB : fixture.buyerA;
    const [listing, card, sales, wallets] = await Promise.all([
      admin.query("select status, buyer_id from kut.market_listings where id = $1", [fixture.listing]), admin.query("select owner_id from kut.user_cards where id = $1", [fixture.card]), admin.query("select id, buyer_id, sale_price, tax_amount, seller_receipt from kut.market_sales where listing_id = $1", [fixture.listing]), admin.query("select user_id, balance from kut.wallets where user_id = any($1::uuid[])", [fixtureUsers]),
    ]);
    expect(listing.rows[0]).toMatchObject({ status: "sold", buyer_id: winner }); expect(card.rows[0].owner_id).toBe(winner); expect(sales.rows).toHaveLength(1);
    expect(sales.rows[0]).toMatchObject({ buyer_id: winner, sale_price: "100", tax_amount: "5", seller_receipt: "95" });
    const balances = new Map(wallets.rows.map((wallet) => [wallet.user_id, Number(wallet.balance)])); expect(balances.get(fixture.seller)).toBe(95); expect(balances.get(winner)).toBe(400); expect(balances.get(loser)).toBe(500);
    const ledger = await admin.query("select user_id, amount, reason from kut.wallet_ledger where reference_id = $1", [sales.rows[0].id]); expect(ledger.rows).toHaveLength(3);
  });
});
