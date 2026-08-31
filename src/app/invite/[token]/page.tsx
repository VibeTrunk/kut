import Link from "next/link";
import { ClaimInviteForm } from "./claim-invite-form";

type InvitePageProps = { params: Promise<{ token: string }> };

export default async function InvitePage({ params }: InvitePageProps) {
  const { token } = await params;

  return (
    <main className="board-ground min-h-screen p-6 text-ink sm:p-10">
      <section className="mx-auto max-w-md space-y-8">
        <Link className="text-sm font-bold text-brass hover:underline" href="/">&larr; Player ratings</Link>
        <header className="space-y-3">
          <p className="text-[0.7rem] font-extrabold uppercase tracking-[0.26em] text-brass">You’re invited</p>
          <h1 className="display text-5xl">Join KUT</h1>
          <p className="text-ink-dim">Create your account to follow the live ratings and build your future collection.</p>
        </header>
        <ClaimInviteForm token={token} />
      </section>
    </main>
  );
}
