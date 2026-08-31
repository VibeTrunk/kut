"use client";

import { useActionState } from "react";
import { manageAccount, type LinkActionState } from "./actions";

export type LinkAccount = {
  id: string;
  display_name: string;
  username: string | null;
  role: string;
  is_disabled: boolean;
  linked_player_id: string | null;
  linked_player_name: string | null;
  wallet_balance: number;
  reset_idempotency_key: string;
};

export type LinkablePlayer = { id: string; display_name: string; slug: string };

export function LinksTable({
  accounts,
  availablePlayers,
  currentUserId,
  currentUserRole,
}: {
  accounts: LinkAccount[];
  availablePlayers: LinkablePlayer[];
  currentUserId: string;
  currentUserRole: string;
}) {
  const [state, formAction, isPending] = useActionState<LinkActionState, FormData>(manageAccount, null);

  return (
    <div className="space-y-3">
      <h2 className="display text-2xl">Accounts ({accounts.length})</h2>
      {state && !state.ok && <p className="rounded-xl bg-brick-bg p-3 text-sm text-brick">{state.error}</p>}
      {state?.ok && <p className="rounded-xl bg-moss-bg p-3 text-sm text-moss">{state.message}</p>}

      <ul className="space-y-3">
        {accounts.map((account) => {
          const isSelf = account.id === currentUserId;
          const isPrivileged = account.role !== "user";
          // Only a superadmin may disable/delete an admin; nobody may here for a
          // superadmin or their own account. The RPC re-checks all of this.
          const canModerate =
            !isSelf &&
            account.role !== "superadmin" &&
            (account.role === "user" || currentUserRole === "superadmin");

          return (
            <li className="rounded-2xl border border-line/60 bg-board-deep/40 p-4" key={account.id}>
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <span className="font-bold">{account.display_name}</span>
                {isPrivileged && (
                  <span className="rounded bg-panel-2 px-1.5 py-0.5 text-xs font-bold text-ink-faint">{account.role}</span>
                )}
                {account.is_disabled && (
                  <span className="rounded bg-brick-bg px-1.5 py-0.5 text-xs font-bold text-brick">disabled</span>
                )}
                {isSelf && <span className="text-xs text-ink-faint">(you)</span>}
              </div>
              <p className="mt-1 text-sm text-ink-dim">
                Username: {account.username ?? "—"} · Linked player: {account.linked_player_name ?? "not linked"} ·
                Wallet: {account.wallet_balance.toLocaleString("en-GB")} KUT Coins
              </p>

              <div className="mt-3 flex flex-wrap gap-2">
                {account.linked_player_id ? (
                  <form action={formAction}>
                    <input name="intent" type="hidden" value="unlink" />
                    <input name="user_id" type="hidden" value={account.id} />
                    <button
                      className="rounded-lg border border-line px-3 py-1.5 text-xs font-bold text-ink-dim hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={isPending}
                      type="submit"
                    >
                      Unlink
                    </button>
                  </form>
                ) : (
                  <form action={formAction} className="flex flex-wrap items-center gap-2">
                    <input name="intent" type="hidden" value="link" />
                    <input name="user_id" type="hidden" value={account.id} />
                    <select
                      className="min-h-9 rounded-lg border border-line bg-board-deep/60 px-2 text-xs"
                      disabled={isPending || availablePlayers.length === 0}
                      name="player_id"
                      required
                    >
                      <option value="">Pick a player…</option>
                      {availablePlayers.map((player) => (
                        <option key={player.id} value={player.id}>
                          {player.display_name} ({player.slug})
                        </option>
                      ))}
                    </select>
                    <button
                      className="rounded-lg border border-brass px-3 py-1.5 text-xs font-bold text-brass disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={isPending || availablePlayers.length === 0}
                      type="submit"
                    >
                      Link
                    </button>
                  </form>
                )}

                {canModerate && (
                  <form action={formAction}>
                    <input name="intent" type="hidden" value={account.is_disabled ? "enable" : "disable"} />
                    <input name="user_id" type="hidden" value={account.id} />
                    <button
                      className="rounded-lg border border-line px-3 py-1.5 text-xs font-bold text-ink-dim hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={isPending}
                      type="submit"
                    >
                      {account.is_disabled ? "Enable" : "Disable"}
                    </button>
                  </form>
                )}

                {canModerate && (
                  <form
                    action={formAction}
                    onSubmit={(event) => {
                      if (
                        !window.confirm(
                          `Reset ${account.display_name}'s club? Their wallet, cards, pack history and messages are wiped and a fresh 250-coin starter is granted. Their login and trade history stay. This cannot be undone.`,
                        )
                      ) {
                        event.preventDefault();
                      }
                    }}
                  >
                    <input name="intent" type="hidden" value="reset_account" />
                    <input name="user_id" type="hidden" value={account.id} />
                    <input name="idempotency_key" type="hidden" value={account.reset_idempotency_key} />
                    <button
                      className="rounded-lg border border-brick-line/60 px-3 py-1.5 text-xs font-bold text-brick hover:bg-brick-bg disabled:cursor-not-allowed disabled:opacity-40"
                      disabled={isPending}
                      type="submit"
                    >
                      Reset club
                    </button>
                  </form>
                )}

                {canModerate && (
                  <form
                    action={formAction}
                    onSubmit={(event) => {
                      if (
                        !window.confirm(
                          `Permanently delete ${account.display_name}? Their wallet, cards and account are removed. This cannot be undone.`,
                        )
                      ) {
                        event.preventDefault();
                      }
                    }}
                  >
                    <input name="intent" type="hidden" value="delete" />
                    <input name="user_id" type="hidden" value={account.id} />
                    <button
                      className="rounded-lg border border-brick-line/60 px-3 py-1.5 text-xs font-bold text-brick hover:bg-brick-bg disabled:cursor-not-allowed disabled:opacity-40"
                      disabled={isPending}
                      type="submit"
                    >
                      Delete
                    </button>
                  </form>
                )}
              </div>

              {canModerate && (
                <form action={formAction} className="mt-2 flex flex-wrap items-center gap-2">
                  <input name="intent" type="hidden" value="adjust_coins" />
                  <input name="user_id" type="hidden" value={account.id} />
                  <input
                    aria-label={`Coin adjustment for ${account.display_name}`}
                    className="min-h-9 w-24 rounded-lg border border-line bg-board-deep/60 px-2 text-xs"
                    inputMode="numeric"
                    name="amount"
                    placeholder="+/- coins"
                    required
                    type="number"
                  />
                  <input
                    aria-label={`Reason for adjusting ${account.display_name}`}
                    className="min-h-9 flex-1 rounded-lg border border-line bg-board-deep/60 px-2 text-xs"
                    maxLength={200}
                    name="reason"
                    placeholder="Reason (required)"
                    required
                    type="text"
                  />
                  <button
                    className="rounded-lg border border-brass px-3 py-1.5 text-xs font-bold text-brass disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={isPending}
                    type="submit"
                  >
                    Adjust coins
                  </button>
                </form>
              )}
            </li>
          );
        })}
      </ul>

      <p className="text-sm text-ink-faint">
        Linking connects a member&rsquo;s account to a player card so they earn attendance coins and can edit that
        card; it does <strong>not</strong> back-pay coins for sessions before the link. <strong>Adjust coins</strong>
        credits or claws back KUT Coins (audited, never below zero, max{" "}
        {(100_000).toLocaleString("en-GB")} per adjustment). <strong>Reset club</strong> wipes wallet, cards, pack
        history and messages and re-grants the starter, keeping the login and all trade history.{" "}
        <strong>Disable</strong> blocks sign-in and removes the account from the leaderboard (reversible).{" "}
        <strong>Delete</strong> is permanent and only goes through for an account with no completed market trades —
        otherwise disable it.
      </p>
    </div>
  );
}
