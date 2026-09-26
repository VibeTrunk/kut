import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { localDatabaseUrl } from "../support/local-target";

// KB-024: the admin page's Midweek switch failed on hosted because PostgREST
// connects as `authenticator`, which preloads safeupdate, and the switch ran an
// UPDATE without a WHERE. Every other database suite connects as postgres, which
// never loads it. This one connects as `authenticator`, as the API does, then
// takes the caller's role and claims the way PostgREST does for a request.
const databaseUrl = localDatabaseUrl();
const authenticatorUrl = (() => {
  const url = new URL(databaseUrl);
  url.username = "authenticator";
  return url.toString();
})();

const fx = {
  admin: "50000000-0000-4000-8000-000000000124",
  member: "50000000-0000-4000-8000-000000000125",
};

let owner: Client;
let api: Client;

/** One API request: a transaction as `authenticated` with the caller's JWT claims, rolled back. */
async function asCaller<T>(userId: string, sql: string): Promise<T> {
  await api.query("begin");
  try {
    await api.query("set local role authenticated");
    await api.query("select set_config('request.jwt.claims', $1, true)", [
      JSON.stringify({ sub: userId, role: "authenticated" }),
    ]);
    const result = await api.query(sql);
    return result.rows[0] as T;
  } finally {
    await api.query("rollback");
  }
}

async function cleanup() {
  await owner.query("delete from kut.profiles where id = any($1::uuid[])", [[fx.admin, fx.member]]);
  await owner.query("delete from auth.users where id = any($1::uuid[])", [[fx.admin, fx.member]]);
}

describe("local Midweek switch through the API role", () => {
  beforeAll(async () => {
    owner = new Client({ connectionString: databaseUrl });
    api = new Client({ connectionString: authenticatorUrl });
    await Promise.all([owner.connect(), api.connect()]);
    await cleanup();
    await owner.query(
      `insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
       select id, 'kb24-' || id || '@example.test', 'authenticated', 'authenticated', '{}', '{}', now(), now()
       from unnest($1::uuid[]) id`,
      [[fx.admin, fx.member]],
    );
    await owner.query(
      `insert into kut.profiles (id, display_name, role, username)
       values ($1, 'KB24 Admin', 'admin', 'kb24_admin'), ($2, 'KB24 Member', 'user', 'kb24_member')`,
      [fx.admin, fx.member],
    );
  });

  afterAll(async () => {
    await cleanup();
    await Promise.all([owner.end(), api.end()]);
  });

  it("runs with safeupdate loaded, as PostgREST does", async () => {
    await api.query("begin");
    try {
      await api.query("create temp table kb24_probe (x int) on commit drop");
      await api.query("insert into kb24_probe values (1)");
      await expect(api.query("update kb24_probe set x = 2")).rejects.toMatchObject({
        code: "21000",
      });
    } finally {
      await api.query("rollback");
    }
  });

  it("lets an admin switch Midweek Madness on and off", async () => {
    const on = await asCaller<{ result: unknown }>(
      fx.admin,
      "select kut.admin_set_midweek_enabled(true) as result",
    );
    expect(on.result).toEqual({ enabled: true });
    const off = await asCaller<{ result: unknown }>(
      fx.admin,
      "select kut.admin_set_midweek_enabled(false) as result",
    );
    expect(off.result).toEqual({ enabled: false });
  });

  it("still refuses a member", async () => {
    await expect(
      asCaller(fx.member, "select kut.admin_set_midweek_enabled(true)"),
    ).rejects.toMatchObject({ code: "42501" });
  });
});
