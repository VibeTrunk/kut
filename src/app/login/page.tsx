import Link from "next/link";
import { LoginForm } from "./login-form";

type LoginPageProps = { searchParams: Promise<{ welcome?: string }> };

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const query = await searchParams;

  return (
    <main className="min-h-screen bg-slate-950 p-6 text-slate-50 sm:p-10">
      <section className="mx-auto max-w-md space-y-8">
        <Link className="text-sm font-semibold text-amber-400" href="/">
          ← Player ratings
        </Link>
        <header className="space-y-3">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-amber-400">KUT admin</p>
          <h1 className="text-4xl font-black tracking-tight">Sign in</h1>
          <p className="text-slate-300">Admin accounts are provisioned by an existing administrator; public sign-up is not available.</p>
        </header>
        {query.welcome === "1" && <p className="rounded-xl bg-emerald-950 p-4 text-emerald-200">Your KUT account is ready. Sign in to continue.</p>}
        <LoginForm />
      </section>
    </main>
  );
}
