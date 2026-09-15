import { createClient } from "@supabase/supabase-js";
import { Client } from "pg";
import { assertLocalTarget } from "../support/local-target";

const users = [
  {
    email: "release_member@users.kut.local",
    username: "release_member",
    displayName: "Release Member",
    role: "user",
    playerId: "00000000-0000-4000-8000-000000000001",
  },
  {
    email: "release_admin@users.kut.local",
    username: "release_admin",
    displayName: "Release Admin",
    role: "admin",
    playerId: null,
  },
] as const;

export default async function globalSetup() {
  const url = process.env.API_URL ?? "http://127.0.0.1:54321";
  const serviceKey = process.env.SERVICE_ROLE_KEY;
  const databaseUrl = process.env.DB_URL;
  if (!serviceKey) throw new Error("Authenticated E2E requires SERVICE_ROLE_KEY.");
  if (!databaseUrl) throw new Error("Authenticated E2E requires DB_URL.");
  // This setup deletes and recreates auth users. Prove both targets are local
  // before touching either one.
  assertLocalTarget(url, process.env.API_URL ? "API_URL" : "the built-in default");
  assertLocalTarget(databaseUrl, "DB_URL");
  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const removeFixtureUsers = async () => {
    const listed = await admin.auth.admin.listUsers({ perPage: 1000 });
    if (listed.error) throw listed.error;
    for (const fixture of users) {
      const existing = listed.data.users.find((user) => user.email === fixture.email);
      if (existing) {
        const removed = await admin.auth.admin.deleteUser(existing.id);
        if (removed.error) throw removed.error;
      }
    }
  };

  const database = new Client({ connectionString: databaseUrl });
  await database.connect();
  try {
    await removeFixtureUsers();
    for (const fixture of users) {
      const created = await admin.auth.admin.createUser({
        email: fixture.email,
        password: "fictional-release-password",
        email_confirm: true,
      });
      if (created.error) throw created.error;
      const userId = created.data.user.id;
      await database.query(
        `insert into kut.profiles(id, username, display_name, role, player_id)
         values($1, $2, $3, $4, $5)`,
        [userId, fixture.username, fixture.displayName, fixture.role, fixture.playerId],
      );
      await database.query("insert into kut.wallets(user_id, balance) values($1, 500)", [userId]);
    }
  } catch (error) {
    await removeFixtureUsers();
    throw error;
  } finally {
    await database.end();
  }
}
