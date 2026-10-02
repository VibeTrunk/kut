import { buildCompeteTabs } from "@/lib/nav/routes";
import { getNavContext } from "@/lib/nav/context";
import { SectionTabs } from "./section-tabs";

/**
 * Compete's section tabs, Midweek · Standings · Players (ADR-107), at the top
 * of each section page: the picker and evening, a week's bracket, Standings
 * and the directory. Match reports keep their back link instead (DR2 mockups).
 * The status comes from the request's nav context, which the layout has
 * already loaded, so this costs no read of its own.
 */
export async function CompeteTabs() {
  const { competeStatus } = await getNavContext();
  return <SectionTabs label="Compete" tabs={buildCompeteTabs(competeStatus)} />;
}
