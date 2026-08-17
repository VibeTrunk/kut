"use client";

import { useActionState } from "react";
import { resetMemberPassword, type PasswordResetState } from "./actions";

type Account = { email: string; id: string; role: "admin" | "superadmin" | "user"; displayName: string };

const initialState: PasswordResetState = { error: null, success: null };

export function ResetPasswordForm({ accounts }: { accounts: Account[] }) {
  const [state, formAction, isPending] = useActionState(resetMemberPassword, initialState);

  if (accounts.length === 0) {
    return <p className="rounded-xl bg-slate-900 p-4 text-slate-300">There are no eligible accounts to reset.</p>;
  }

  return (
    <form action={formAction} className="space-y-4 rounded-2xl border border-slate-700 bg-slate-900 p-5">
      <label className="block space-y-2">
        <span className="font-semibold">Member</span>
        <select className="min-h-12 w-full rounded-xl border border-slate-600 bg-slate-950 px-4" defaultValue="" name="targetUserId" required>
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
          className="min-h-12 w-full rounded-xl border border-slate-600 bg-slate-950 px-4"
          minLength={12}
          name="password"
          required
          type="password"
        />
        <span className="block text-sm text-slate-400">Use at least 12 characters. It is never stored in KUT’s database or audit log.</span>
      </label>
      <label className="block space-y-2">
        <span className="font-semibold">Reason</span>
        <textarea
          className="min-h-24 w-full rounded-xl border border-slate-600 bg-slate-950 p-3"
          maxLength={500}
          minLength={3}
          name="reason"
          placeholder="For example: Alex asked for help after forgetting their password."
          required
        />
      </label>
      {state.error && <p className="rounded-xl bg-rose-950 p-3 text-sm text-rose-200">{state.error}</p>}
      {state.success && <p className="rounded-xl bg-emerald-950 p-3 text-sm text-emerald-200">{state.success}</p>}
      <button
        className="min-h-12 w-full rounded-xl bg-amber-400 px-4 py-3 font-bold text-slate-950 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
        disabled={isPending}
        type="submit"
      >
        {isPending ? "Resetting..." : "Set temporary password"}
      </button>
    </form>
  );
}
