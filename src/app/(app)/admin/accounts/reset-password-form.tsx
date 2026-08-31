"use client";

import { useActionState } from "react";
import { resetMemberPassword, type PasswordResetState } from "./actions";

type Account = { email: string; id: string; role: "admin" | "superadmin" | "user"; displayName: string };

const initialState: PasswordResetState = { error: null, success: null };

export function ResetPasswordForm({ accounts }: { accounts: Account[] }) {
  const [state, formAction, isPending] = useActionState(resetMemberPassword, initialState);

  if (accounts.length === 0) {
    return <p className="rounded-xl bg-panel p-4 text-ink-dim">There are no eligible accounts to reset.</p>;
  }

  return (
    <form action={formAction} className="space-y-4 rounded-2xl border border-line bg-panel p-5">
      <label className="block space-y-2">
        <span className="font-semibold">Member</span>
        <select className="min-h-12 w-full rounded-xl border border-line bg-board-deep/60 px-4" defaultValue="" name="targetUserId" required>
          <option disabled value="">Choose an account</option>
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>{account.displayName} · {account.email} · {account.role}</option>
          ))}
        </select>
      </label>
      <label className="block space-y-2">
        <span className="font-semibold">Temporary password</span>
        <input
          autoComplete="new-password"
          className="min-h-12 w-full rounded-xl border border-line bg-board-deep/60 px-4"
          minLength={12}
          name="password"
          required
          type="password"
        />
        <span className="block text-sm text-ink-faint">Use at least 12 characters. It is never stored in KUT’s database or audit log.</span>
      </label>
      <label className="block space-y-2">
        <span className="font-semibold">Reason</span>
        <textarea
          className="min-h-24 w-full rounded-xl border border-line bg-board-deep/60 p-3"
          maxLength={500}
          minLength={3}
          name="reason"
          placeholder="For example: Alex asked for help after forgetting their password."
          required
        />
      </label>
      {state.error && <p className="rounded-xl bg-brick-bg p-3 text-sm text-brick">{state.error}</p>}
      {state.success && <p className="rounded-xl bg-moss-bg p-3 text-sm text-moss">{state.success}</p>}
      <button
        className="min-h-12 w-full rounded-xl bg-brass px-4 py-3 font-bold text-ink-on-accent disabled:cursor-not-allowed disabled:bg-line disabled:text-ink-faint"
        disabled={isPending}
        type="submit"
      >
        {isPending ? "Resetting..." : "Set temporary password"}
      </button>
    </form>
  );
}
