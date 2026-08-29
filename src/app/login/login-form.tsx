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
      setErrorMessage("Sign-in failed. Check your email and password.");
      setIsSubmitting(false);
      return;
    }

    router.replace("/admin/attendance");
    router.refresh();
  }

  return (
    <form action={signIn} className="space-y-5">
      <label className="block space-y-2">
        <span className="font-semibold">Username</span>
        <input
          autoCapitalize="none"
          autoComplete="username"
          className="min-h-12 w-full rounded-xl border border-line bg-board px-4"
          name="identifier"
          required
          spellCheck={false}
          type="text"
        />
        <span className="block text-sm text-ink-faint">
          Members from before usernames existed: enter your email address here.
        </span>
      </label>
      <label className="block space-y-2">
        <span className="font-semibold">Password</span>
        <input
          autoComplete="current-password"
          className="min-h-12 w-full rounded-xl border border-line bg-board px-4"
          minLength={8}
          name="password"
          required
          type="password"
        />
      </label>
      {errorMessage && <p className="rounded-xl bg-brick-bg p-3 text-sm text-brick">{errorMessage}</p>}
      <button
        className="min-h-12 w-full rounded-xl bg-brass px-4 py-3 font-bold text-ink-on-accent disabled:bg-line disabled:text-ink-faint"
        disabled={isSubmitting}
        type="submit"
      >
        {isSubmitting ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
