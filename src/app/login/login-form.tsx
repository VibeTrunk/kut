"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function LoginForm() {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function signIn(formData: FormData) {
    setErrorMessage(null);
    setIsSubmitting(true);

    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");
    const { error } = await createClient().auth.signInWithPassword({ email, password });

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
        <span className="font-semibold">Email</span>
        <input
          autoComplete="email"
          className="min-h-12 w-full rounded-xl border border-slate-600 bg-slate-900 px-4"
          name="email"
          required
          type="email"
        />
      </label>
      <label className="block space-y-2">
        <span className="font-semibold">Password</span>
        <input
          autoComplete="current-password"
          className="min-h-12 w-full rounded-xl border border-slate-600 bg-slate-900 px-4"
          minLength={8}
          name="password"
          required
          type="password"
        />
      </label>
      {errorMessage && <p className="rounded-xl bg-rose-950 p-3 text-sm text-rose-200">{errorMessage}</p>}
      <button
        className="min-h-12 w-full rounded-xl bg-amber-400 px-4 py-3 font-bold text-slate-950 disabled:bg-slate-700 disabled:text-slate-400"
        disabled={isSubmitting}
        type="submit"
      >
        {isSubmitting ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
