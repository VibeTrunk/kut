"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type LogoutButtonProps = {
  variant?: "button" | "menu-item";
};

export function LogoutButton({ variant = "button" }: LogoutButtonProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);

  async function signOut() {
    setError(null);
    setIsSigningOut(true);

    const { error: signOutError } = await createClient().auth.signOut({ scope: "local" });

    if (signOutError) {
      setError("Could not sign out. Please try again.");
      setIsSigningOut(false);
      return;
    }

    router.replace("/");
    router.refresh();
  }

  if (variant === "menu-item") {
    return (
      <div className="flex flex-col gap-1">
        <button
          className="flex min-h-11 w-full items-center justify-between rounded-lg px-3 text-sm font-bold text-ink-dim hover:bg-panel-2 disabled:text-ink-faint"
          disabled={isSigningOut}
          onClick={signOut}
          type="button"
        >
          {isSigningOut ? "Signing out..." : "Sign out"}
        </button>
        {error && <p className="px-3 text-xs text-brick">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        className="min-h-10 rounded-xl border border-line px-3 text-sm font-bold text-ink-dim hover:border-brass hover:text-brass disabled:border-line disabled:text-ink-faint"
        disabled={isSigningOut}
        onClick={signOut}
        type="button"
      >
        {isSigningOut ? "Signing out..." : "Sign out"}
      </button>
      {error && <p className="max-w-48 text-right text-xs text-brick">{error}</p>}
    </div>
  );
}
