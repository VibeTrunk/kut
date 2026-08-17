import Link from "next/link";
import { ClaimInviteForm } from "./claim-invite-form";

type InvitePageProps = { params: Promise<{ token: string }> };

export default async function InvitePage({ params }: InvitePageProps) {
  const { token } = await params;

  return (
    <main className="min-h-screen bg-board p-6 text-ink sm:p-10">
      <section className="mx-auto max-w-md space-y-8">
        <Link className="text-sm font-semibold text-brass" href="/">← Player ratings</Link>
        <header className="space-y-3">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brass">You’re invited</p>
          <h1 className="text-4xl font-black tracking-tight">Join KUT</h1>
          <p className="text-ink-dim">Create your account to follow the live ratings and build your future collection.</p>
        </header>
        <ClaimInviteForm token={token} />
      </section>
    </main>
  );
}
