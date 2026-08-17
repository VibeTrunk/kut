import { LoginForm } from "./login-form";

type LoginPageProps = { searchParams: Promise<{ welcome?: string }> };

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const query = await searchParams;

  return (
    <main className="min-h-screen bg-slate-950 p-6 text-slate-50 sm:p-10">
      <section className="mx-auto max-w-md space-y-8">
        <header className="space-y-3">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-amber-400">Kelderklasse Ultimate Team</p>
          <h1 className="text-4xl font-black tracking-tight">Sign in</h1>
          <p className="text-slate-300">KUT is private for invited members. Public sign-up is not available.</p>
        </header>
        {query.welcome === "1" && <p className="rounded-xl bg-emerald-950 p-4 text-emerald-200">Your KUT account is ready. Sign in to continue.</p>}
        <LoginForm />
      </section>
    </main>
  );
}
