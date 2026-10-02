import { CompeteTabs } from "@/components/app-shell/compete-tabs";
import { MIDWEEK_PAGE, MidweekPageHead } from "@/components/midweek/page-head";
import { MidweekWeekList } from "@/components/midweek/week-list";
import { MIDWEEK } from "@/game/midweek/config";
import { requireUser } from "@/lib/auth/user";
import { pastWeeks } from "@/lib/midweek/evening";
import { loadPastWeeks } from "@/lib/midweek/results";
import { runDueMidweek } from "@/lib/midweek/run-due";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Midweek Madness: past weeks" };

/**
 * `/midweek/past` (Weeks-Past, ADR-113): every finished week, newest first,
 * each opening its bracket. Readable with Midweek switched off, like every
 * past bracket (ADR-097).
 */
export default async function MidweekPastPage() {
  const user = await requireUser();
  await runDueMidweek();
  const supabase = await createClient();
  const data = await loadPastWeeks(supabase);
  const weeks = pastWeeks({ ...data, userId: user.id, minEntrants: MIDWEEK.minEntrants });

  return (
    <main className={MIDWEEK_PAGE}>
      <section className="mx-auto grid max-w-2xl gap-6 py-4 sm:gap-8 sm:py-8">
        <CompeteTabs />
        <MidweekPageHead
          back={{ href: "/midweek", label: "Midweek Madness" }}
          kicker="Midweek Madness"
          title="Past weeks"
        />
        {weeks.length > 0 ? (
          <MidweekWeekList weeks={weeks} />
        ) : (
          <p className="text-ink-dim">No week has been played yet.</p>
        )}
      </section>
    </main>
  );
}
