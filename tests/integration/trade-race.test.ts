import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const databaseUrl = process.env.KUT_LOCAL_DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const fx = {
  seller: "00000000-0000-4000-8000-0000000f0a01",
  proposerA: "00000000-0000-4000-8000-0000000f0a02",
  proposerB: "00000000-0000-4000-8000-0000000f0a03",
  player: "00000000-0000-4000-8000-000000000001",
  edition: "00000000-0000-4000-8000-0000000f0a04",
  card: "00000000-0000-4000-8000-0000000f0a05",
  listing: "00000000-0000-4000-8000-0000000f0a06",
};
const users = [fx.seller, fx.proposerA, fx.proposerB];
let admin: Client;
let sellerConn1: Client;
let sellerConn2: Client;

async function cleanup() {
  await admin.query("delete from kut.user_notifications where user_id = any($1::uuid[])", [users]);
  await admin.query(
    "delete from kut.wallet_ledger where user_id = any($1::uuid[]) or reason in ('trade_escrow','trade_unescrow','trade_sale')",
    [users],
  );
  await admin.query(
    "delete from kut.trade_offer_cards where offer_id in (select id from kut.trade_offers where listing_id = $1)",
    [fx.listing],
  );
  await admin.query("delete from kut.trade_offers where listing_id = $1", [fx.listing]);
  await admin.query("delete from kut.market_sales where listing_id = $1", [fx.listing]);
  await admin.query("delete from kut.market_listings where id = $1", [fx.listing]);
  await admin.query("delete from kut.user_cards where id = $1", [fx.card]);
  await admin.query("delete from kut.card_editions where id = $1", [fx.edition]);
  await admin.query("delete from kut.wallets where user_id = any($1::uuid[])", [users]);
  await admin.query("delete from kut.profiles where id = any($1::uuid[])", [users]);
  await admin.query("delete from auth.users where id = any($1::uuid[])", [users]);
}

async function asUser(client: Client, userId: string, sql: string, params: unknown[] = []) {
  await client.query("begin");
  await client.query("set local role authenticated");
  await client.query("select set_config('request.jwt.claim.sub', $1, true)", [userId]);
  try {
    const result = await client.query(sql, params);
    await client.query("commit");
    return { error: null as unknown, rows: result.rows };
  } catch (error) {
    await client.query("rollback");
    return { error, rows: [] as Record<string, unknown>[] };
  }
}

describe("local two-client trade-offer accept race", () => {
  beforeAll(async () => {
    admin = new Client({ connectionString: databaseUrl });
    sellerConn1 = new Client({ connectionString: databaseUrl });
    sellerConn2 = new Client({ connectionString: databaseUrl });
    await Promise.all([admin.connect(), sellerConn1.connect(), sellerConn2.connect()]);
    await cleanup();
    await admin.query(
      "insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values ($1,'trace-seller@example.test','authenticated','authenticated','{}'::jsonb,'{}'::jsonb,now(),now()),($2,'trace-a@example.test','authenticated','authenticated','{}'::jsonb,'{}'::jsonb,now(),now()),($3,'trace-b@example.test','authenticated','authenticated','{}'::jsonb,'{}'::jsonb,now(),now())",
      [fx.seller, fx.proposerA, fx.proposerB],
    );
    await admin.query(
      "insert into kut.profiles (id, display_name, role) values ($1,'Trace Seller','user'),($2,'Trace A','user'),($3,'Trace B','user')",
      [fx.seller, fx.proposerA, fx.proposerB],
    );
    await admin.query("insert into kut.wallets (user_id, balance) values ($1,0),($2,500),($3,500)", [
      fx.seller,
      fx.proposerA,
      fx.proposerB,
    ]);
    await admin.query(
      "insert into kut.card_editions (id, player_id, edition_type, title, is_live, snapshot_ovr, snapshot_pac, snapshot_sho, snapshot_pas, snapshot_dri, snapshot_def, snapshot_phy, special_discard_multiplier) values ($1,$2,'other','Trade race fixture',false,50,50,50,50,50,50,50,1)",
      [fx.edition, fx.player],
    );
    await admin.query("insert into kut.user_cards (id, edition_id, owner_id, source) values ($1,$2,$3,'pack')", [
      fx.card,
      fx.edition,
      fx.seller,
    ]);
    await admin.query("insert into kut.market_listings (id, card_id, seller_id, price) values ($1,$2,$3,200)", [
      fx.listing,
      fx.card,
      fx.seller,
    ]);

    // Each proposer makes a coin offer on the same listing.
    await asUser(sellerConn1, fx.proposerA, "select kut.propose_trade($1,120,'{}'::uuid[],$2)", [
      fx.listing,
      "00000000-0000-4000-8000-0000000faa01",
    ]);
    await asUser(sellerConn2, fx.proposerB, "select kut.propose_trade($1,150,'{}'::uuid[],$2)", [
      fx.listing,
      "00000000-0000-4000-8000-0000000faa02",
    ]);
  });

  afterAll(async () => {
    await cleanup();
    await Promise.all([admin.end(), sellerConn1.end(), sellerConn2.end()]);
  });

  it("lets the seller accept exactly one of two offers on the same listing", async () => {
    const offers = await admin.query(
      "select id, proposer_idempotency_key from kut.trade_offers where listing_id = $1 order by offered_coins",
      [fx.listing],
    );
    const offerA = offers.rows.find((r) => r.proposer_idempotency_key === "00000000-0000-4000-8000-0000000faa01");
    const offerB = offers.rows.find((r) => r.proposer_idempotency_key === "00000000-0000-4000-8000-0000000faa02");

    const [resA, resB] = await Promise.all([
      asUser(sellerConn1, fx.seller, "select kut.respond_to_trade($1, true, $2)", [
        offerA!.id,
        "00000000-0000-4000-8000-0000000fbb01",
      ]),
      asUser(sellerConn2, fx.seller, "select kut.respond_to_trade($1, true, $2)", [
        offerB!.id,
        "00000000-0000-4000-8000-0000000fbb02",
      ]),
    ]);

    const succeeded = [resA, resB].filter((r) => r.error === null);
    expect(succeeded).toHaveLength(1);

    const [listing, card, sales, wallets, offerRows] = await Promise.all([
      admin.query("select status, buyer_id from kut.market_listings where id = $1", [fx.listing]),
      admin.query("select owner_id from kut.user_cards where id = $1", [fx.card]),
      admin.query("select count(*)::int as n from kut.market_sales where listing_id = $1", [fx.listing]),
      admin.query("select user_id, balance from kut.wallets where user_id = any($1::uuid[])", [users]),
      admin.query("select proposer_id, status from kut.trade_offers where listing_id = $1", [fx.listing]),
    ]);

    expect(listing.rows[0].status).toBe("sold");
    const winner = listing.rows[0].buyer_id as string;
    expect([fx.proposerA, fx.proposerB]).toContain(winner);
    expect(card.rows[0].owner_id).toBe(winner);
    expect(sales.rows[0].n).toBe(0); // trades never touch market_sales

    // Exactly one offer accepted, the other rejected + refunded.
    const accepted = offerRows.rows.filter((r) => r.status === "accepted");
    const rejected = offerRows.rows.filter((r) => r.status === "rejected");
    expect(accepted).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    const balances = new Map(wallets.rows.map((w) => [w.user_id, Number(w.balance)]));
    const loser = winner === fx.proposerA ? fx.proposerB : fx.proposerA;
    expect(balances.get(loser)).toBe(500); // fully refunded
    const winnerOffer = winner === fx.proposerA ? 120 : 150;
    expect(balances.get(winner)).toBe(500 - winnerOffer);
    const tax = Math.max(1, Math.ceil(winnerOffer * 0.05));
    expect(balances.get(fx.seller)).toBe(winnerOffer - tax);
  });
});
