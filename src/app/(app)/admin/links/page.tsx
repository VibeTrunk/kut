import { requireAdmin } from "@/lib/auth/admin";
import { createClient } from "@/lib/supabase/server";
import { LinksTable, type LinkAccount, type LinkablePlayer } from "./links-table";

export const metadata = { title: "Accounts" };

export default async function AccountLinksPage() {
  const admin = await requireAdmin();
  const supabase = await createClient();

  const [profilesRes, playersRes, walletsRes] = await Promise.all([
    supabase
      .schema("kut")
      .from("profiles")
      .select("id, display_name, username, role, is_disabled, player_id")
      .order("display_name"),
    supabase.schema("kut").from("players").select("id, display_name, slug, is_active").order("display_name"),
    supabase.schema("kut").from("wallets").select("user_id, balance"),
  ]);

  if (profilesRes.error || playersRes.error || walletsRes.error) {
    throw new Error("Could not load account links.");
  }

  const players = playersRes.data ?? [];
  const playerName = new Map(players.map((player) => [player.id, player.display_name]));
  const balanceByUserId = new Map((walletsRes.data ?? []).map((wallet) => [wallet.user_id, wallet.balance]));
  const linkedPlayerIds = new Set(
    (profilesRes.data ?? []).flatMap((profile) => (profile.player_id ? [profile.player_id] : [])),
  );

  const accounts: LinkAccount[] = (profilesRes.data ?? []).map((profile) => ({
    id: profile.id,
    display_name: profile.display_name,
    username: profile.username ?? null,
    role: profile.role,
    is_disabled: profile.is_disabled,
    linked_player_id: profile.player_id ?? null,
    linked_player_name: profile.player_id ? playerName.get(profile.player_id) ?? "Unknown player" : null,
    wallet_balance: balanceByUserId.get(profile.id) ?? 0,
    // Stable per page load so a double-submit of the same Reset form is idempotent.
    reset_idempotency_key: crypto.randomUUID(),
    // Same idea for the "Grant myself coins" form.
    self_grant_idempotency_key: crypto.randomUUID(),
  }));

  const availablePlayers: LinkablePlayer[] = players
    .filter((player) => player.is_active && !linkedPlayerIds.has(player.id))
    .map((player) => ({ id: player.id, display_name: player.display_name, slug: player.slug }));

  return (
    <main className="board-ground min-h-screen p-6 text-ink sm:p-10">
      <section className="mx-auto max-w-2xl space-y-8">
        <header className="space-y-3">
          <h1 className="text-4xl font-black tracking-tight">Accounts</h1>
          <p className="text-ink-dim">
            Connect a member&rsquo;s account to their TFH player card, adjust their KUT Coins, reset their club, disable
            an account, or permanently delete one. Members are normally linked automatically when they claim an invite.
          </p>
        </header>
        <LinksTable
          accounts={accounts}
          availablePlayers={availablePlayers}
          currentUserId={admin.id}
          currentUserRole={admin.role}
        />
      </section>
    </main>
  );
}
