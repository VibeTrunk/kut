"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { loginIdentifierToEmail } from "@/lib/auth/username";
import { createClient } from "@/lib/supabase/client";

export function LoginForm() {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function signIn(formData: FormData) {
    setErrorMessage(null);
    setIsSubmitting(true);

    const identifier = String(formData.get("identifier") ?? "");
    const password = String(formData.get("password") ?? "");
    const { error } = await createClient().auth.signInWithPassword({
      email: loginIdentifierToEmail(identifier),
      password,
    });

    if (error) {
      setErrorMessage("Sign-in failed. Check your username and password.");
      setIsSubmitting(false);
      return;
    }

    router.replace("/admin/attendance");
    router.refresh();
  }

  return (
    <form action={signIn} className="space-y-5">
      <label className="block space-y-2">
        <span className="text-sm font-extrabold">Username</span>
        <input
          autoCapitalize="none"
          autoComplete="username"
          className="min-h-12 w-full rounded-xl border border-line bg-board-deep/60 px-4 font-semibold text-ink focus:border-brass/60 focus:outline-none"
          name="identifier"
          required
          spellCheck={false}
          type="text"
        />
        <span className="block text-xs leading-relaxed text-ink-faint">
          Members from before usernames existed can still sign in with their email address here.
        </span>
      </label>
      <label className="block space-y-2">
        <span className="text-sm font-extrabold">Password</span>
        <input
          autoComplete="current-password"
          className="min-h-12 w-full rounded-xl border border-line bg-board-deep/60 px-4 font-semibold text-ink focus:border-brass/60 focus:outline-none"
          minLength={8}
          name="password"
          required
          type="password"
        />
      </label>
      {errorMessage && <p className="rounded-xl border border-brick-line/40 bg-brick-bg p-3 text-sm font-bold text-brick">{errorMessage}</p>}
      <button
        className="min-h-12 w-full rounded-xl bg-gradient-to-b from-[#eebd63] to-[#d29a34] px-4 py-3 font-black text-ink-on-accent shadow-lg shadow-brass/20 hover:brightness-105 disabled:bg-none disabled:bg-line disabled:text-ink-faint disabled:shadow-none"
        disabled={isSubmitting}
        type="submit"
      >
        {isSubmitting ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
