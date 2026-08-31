import { LoginForm } from "./login-form";

type LoginPageProps = { searchParams: Promise<{ welcome?: string }> };

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const query = await searchParams;

  return (
    <main className="board-ground flex min-h-screen items-center justify-center p-6 text-ink sm:p-10">
      <section className="w-full max-w-md space-y-8">
        <header className="space-y-4">
          <p className="flex items-center gap-2.5 text-xl font-black tracking-tight text-ink">
            <span aria-hidden="true" className="clip-pennant h-4 w-3.5 shrink-0 bg-brass" />
            KUT
          </p>
          <p className="text-[0.7rem] font-extrabold uppercase tracking-[0.26em] text-brass">Kelderklasse Ultimate Team</p>
          <h1 className="display text-5xl">Sign in</h1>
          <p className="leading-relaxed text-ink-dim">KUT is private for invited members. Public sign-up is not available.</p>
        </header>
        {query.welcome === "1" && (
          <p className="rounded-xl border border-moss-line/40 bg-moss-bg/50 p-4 font-bold text-moss">
            Your KUT account is ready. Sign in to continue.
          </p>
        )}
        <LoginForm />
      </section>
    </main>
  );
}
