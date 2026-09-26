import { createClient } from "@supabase/supabase-js";
import { Client } from "pg";
import { assertLocalTarget } from "../support/local-target";
import { removeMidweekFixture } from "./midweek-fixture";

const fixtureEmails = ["release_member@users.kut.local", "release_admin@users.kut.local"];

export default async function globalTeardown() {
  const url = process.env.API_URL ?? "http://127.0.0.1:54321";
  const serviceKey = process.env.SERVICE_ROLE_KEY;
  const databaseUrl = process.env.DB_URL;
  if (!serviceKey) throw new Error("Authenticated E2E teardown requires SERVICE_ROLE_KEY.");
  if (!databaseUrl) throw new Error("Authenticated E2E teardown requires DB_URL.");
  // Teardown deletes users by email and the Midweek fixture by id. Same guard
  // as setup.
  assertLocalTarget(url, process.env.API_URL ? "API_URL" : "the built-in default");
  assertLocalTarget(databaseUrl, "DB_URL");
  const database = new Client({ connectionString: databaseUrl });
  await database.connect();
  try {
    await removeMidweekFixture(database);
  } finally {
    await database.end();
  }
  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const listed = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (listed.error) throw listed.error;
  for (const user of listed.data.users.filter(
    ({ email }) => email && fixtureEmails.includes(email),
  )) {
    const removed = await admin.auth.admin.deleteUser(user.id);
    if (removed.error) throw removed.error;
  }
}
