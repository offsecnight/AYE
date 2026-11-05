import { PageShell } from "@/components/layout/PageShell";
import { LandingHero } from "@/components/sections/LandingHero";
import { CollegeScoreboardList } from "@/components/sections/CollegeScoreboardList";

export default function HomePage() {
  return (
    <PageShell>
      <LandingHero />
      <CollegeScoreboardList />
    </PageShell>
  );
}
