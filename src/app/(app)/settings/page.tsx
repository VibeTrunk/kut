import { IconSettings } from "@/components/icons";
import { LogoutButton } from "@/components/logout-button";
import { requireUser } from "@/lib/auth/user";

export default async function SettingsPage() {
  const user = await requireUser();

  return (
    <main className="min-h-screen bg-board p-5 text-ink sm:p-10">
      <section className="mx-auto max-w-2xl space-y-8">
        <header>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brass">Account</p>
          <h1 className="mt-2 text-4xl font-black tracking-tight sm:text-5xl">Settings</h1>
        </header>
        <div className="rounded-3xl border border-line bg-panel/60 p-6">
          <p className="text-xs font-black uppercase tracking-[0.13em] text-ink-faint">Signed in as</p>
          <p className="mt-1 text-xl font-black">{user.displayName}</p>
        </div>
        <div className="flex flex-col items-center gap-4 rounded-3xl border border-dashed border-line bg-panel/60 p-10 text-center">
          <IconSettings className="h-10 w-10 text-ink-faint" />
          <h2 className="text-xl font-black">More settings coming soon</h2>
          <p className="max-w-md text-ink-faint">Notification preferences and profile photo uploads are planned for a later polish pass.</p>
        </div>
        <LogoutButton />
      </section>
    </main>
  );
}
