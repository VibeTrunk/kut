import { redirect } from "next/navigation";
import { StarterReveal } from "@/components/starter-reveal";
import { createClient } from "@/lib/supabase/server";
import { loadStarterCards } from "./starter-cards";

export const metadata = { title: "Welcome to KUT" };

export default async function WelcomePage() {
  const supabase = await createClient();
  const { data: claims, error: claimsError } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;

  if (claimsError || typeof userId !== "string") {
    redirect("/login");
  }

  const { data: profile, error: profileError } = await supabase
    .schema("kut")
    .from("profiles")
    .select("is_disabled, starter_opened_at")
    .eq("id", userId)
    .maybeSingle();

  if (profileError || !profile || profile.is_disabled) {
    redirect("/login");
  }
  if (profile.starter_opened_at) {
    redirect("/");
  }

  const cards = await loadStarterCards(supabase);

  return (
    <main className="board-ground min-h-screen p-5 text-ink sm:p-10">
      <section className="mx-auto max-w-3xl space-y-6">
        <header className="text-center">
          <p className="text-[0.7rem] font-extrabold uppercase tracking-[0.26em] text-brass">
            Welcome to KUT
          </p>
          <h1 className="display mt-3 text-5xl sm:text-6xl">Your starter pack is waiting</h1>
        </header>
        <StarterReveal cards={cards} />
      </section>
    </main>
  );
}
