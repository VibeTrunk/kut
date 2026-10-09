import { BRAND } from "@/lib/brand";
import { LoginForm } from "./login-form";

type LoginPageProps = { searchParams: Promise<{ welcome?: string }> };

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const query = await searchParams;

  return (
    <main className="board-ground flex min-h-screen items-center justify-center p-6 text-ink sm:p-10">
      <section className="w-full max-w-md space-y-8">
        <header className="space-y-4">
          {/* The crest lockup (design/flut/HANDOFF.md §2): the full name on two fixed lines. */}
          <p className="mb-2 flex items-center gap-4">
            <span aria-hidden="true" className="clip-pennant h-20 w-[70px] shrink-0 bg-brass" />
            <span className="grid gap-2">
              <span className="text-[40px] font-black leading-none tracking-[-0.02em] text-ink">
                {BRAND.shortName}
              </span>
              <span className="text-[0.7rem] font-extrabold uppercase leading-[1.45] tracking-[0.26em] text-brass">
                <span className="block">Football League</span>
                <span className="block">Ultimate Team</span>
              </span>
            </span>
          </p>
          <h1 className="display text-5xl">Sign in</h1>
          <p className="leading-relaxed text-ink-dim">
            {BRAND.shortName} is private for invited members. Public sign-up is not available.
          </p>
        </header>
        {query.welcome === "1" && (
          <p className="rounded-xl border border-moss-line/40 bg-moss-bg/50 p-4 font-bold text-moss">
            Your {BRAND.shortName} account is ready. Sign in to continue.
          </p>
        )}
        <LoginForm />
      </section>
    </main>
  );
}
