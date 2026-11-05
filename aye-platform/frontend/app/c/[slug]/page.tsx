import { PageShell }  from "@/components/layout/PageShell";
import { GradeDisplay } from "@/components/ui/GradeDisplay";
import { StatusBadge }  from "@/components/ui/StatusBadge";
import Link from "next/link";

const API_BASE = (process.env.BACKEND_URL ?? "http://localhost:4000") + "/api/v1";

async function getScoreboard(slug: string) {
  try {
    const res = await fetch(`${API_BASE}/public/scoreboard/${slug}`, {
      next: { revalidate: 60 }, // ISR — revalidate every 60 seconds
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

interface ExperienceSnippet {
  post_id:     string;
  title:       string;
  category:    string;
  aye_count:   number;
  status:      string;
  created_at:  string;
  hide_handle: boolean;
  ghost_handle: string;
}

interface ScoreboardData {
  college: {
    name:              string;
    slug:              string;
    city:              string;
    reality_grade:     string;
    resolution_rate:   number;
    total_experiences: number;
    total_resolved:    number;
  };
  trending:        ExperienceSnippet[];
  longest_ignored: ExperienceSnippet[];
}

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const data: ScoreboardData | null = await getScoreboard(params.slug);
  if (!data) return { title: "College Not Found — AYE Platform" };
  return {
    title: `${data.college.name} — AYE Platform Reality Score`,
    description: `Grade ${data.college.reality_grade} | ${(data.college.resolution_rate ?? 0).toFixed(0)}% resolution rate | ${data.college.total_experiences} reported issues`,
  };
}

export default async function CollegeScoreboardPage({
  params,
}: {
  params: { slug: string };
}) {
  const data: ScoreboardData | null = await getScoreboard(params.slug);

  if (!data) {
    return (
      <PageShell>
        <div className="max-w-3xl mx-auto py-20 text-center">
          <div className="section-label mb-4 inline-block">404 / NOT FOUND</div>
          <h1 className="font-mono font-bold text-4xl uppercase mb-6">COLLEGE NOT FOUND</h1>
          <Link href="/" className="btn-secondary">
            ← BACK TO SCOREBOARD
          </Link>
        </div>
      </PageShell>
    );
  }

  const { college, trending, longest_ignored } = data;
  const daysSince = (iso: string) =>
    Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));

  return (
    <PageShell>
      <div className="max-w-3xl mx-auto">
        <div className="section-label mb-6 inline-block">PUBLIC / COLLEGE SCOREBOARD</div>

        {/* SEO breadcrumb */}
        <nav className="font-mono text-xs text-ink/40 uppercase mb-4" aria-label="Breadcrumb">
          <Link href="/" className="hover:underline">Scoreboard</Link>
          <span className="mx-2">/</span>
          <span>{college.name}</span>
        </nav>

        {/* Hero */}
        <div className="brute-card p-8 mb-6 flex flex-col sm:flex-row items-start gap-6">
          <GradeDisplay grade={college.reality_grade} size="xl" />
          <div className="flex-1">
            <h1 className="font-mono font-bold text-3xl uppercase leading-tight mb-2">
              {college.name}
            </h1>
            <p className="font-mono text-sm text-ink/50 uppercase mb-4">{college.city}</p>
            <div className="flex flex-wrap gap-4">
              {[
                { label: "TOTAL ISSUES",    value: college.total_experiences },
                { label: "RESOLVED",        value: college.total_resolved },
                { label: "UNRESOLVED",      value: college.total_experiences - college.total_resolved },
                { label: "RESOLUTION RATE", value: `${(college.resolution_rate ?? 0).toFixed(0)}%` },
              ].map((s) => (
                <div key={s.label} className="border-2 border-ink px-4 py-2 text-center">
                  <div className="font-mono font-bold text-2xl">{s.value}</div>
                  <div className="font-mono text-[10px] text-ink/40 uppercase tracking-widest">
                    {s.label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Call to action */}
        <div className="flex gap-3 mb-8">
          <Link href="/auth?tab=register" className="btn-primary">
            JOIN THIS CAMPUS
          </Link>
          <Link href="/auth" className="btn-secondary">
            LOGIN
          </Link>
        </div>

        {/* Trending */}
        {trending.length > 0 && (
          <div className="mb-6">
            <div className="section-label mb-4 inline-block">⚡ TRENDING NOW</div>
            <div className="flex flex-col gap-3">
              {trending.map((p) => (
                <div
                  key={p.post_id}
                  className="brute-card p-4 flex items-center justify-between gap-4 border-t-4 border-t-amber"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-mono text-sm font-bold truncate uppercase">{p.title}</p>
                    <p className="font-mono text-xs text-amber uppercase mt-1">
                      {p.aye_count} AYES • {daysSince(p.created_at)}d AGO
                    </p>
                  </div>
                  <StatusBadge status={p.status as "UNRESOLVED" | "TRENDING" | "FIX_PROPOSED" | "RESOLVED" | "HIDDEN_JUNK"} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Longest ignored */}
        {longest_ignored.length > 0 && (
          <div className="mb-6">
            <div className="section-label mb-4 inline-block">LONGEST IGNORED PROBLEMS</div>
            <div className="flex flex-col gap-3">
              {longest_ignored.map((p) => (
                <div
                  key={p.post_id}
                  className="brute-card p-4 flex items-center justify-between gap-4"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-mono text-sm font-bold truncate uppercase">{p.title}</p>
                    <p className="font-mono text-xs text-danger uppercase mt-1">
                      ● IGNORED FOR {daysSince(p.created_at)} DAYS — {p.aye_count} AYES
                    </p>
                  </div>
                  <StatusBadge status={p.status as "UNRESOLVED" | "TRENDING" | "FIX_PROPOSED" | "RESOLVED" | "HIDDEN_JUNK"} />
                </div>
              ))}
            </div>
          </div>
        )}

        {trending.length === 0 && longest_ignored.length === 0 && (
          <div className="brute-card p-12 text-center">
            <p className="font-mono text-sm text-ink/40 uppercase tracking-widest">
              NO EXPERIENCES REPORTED YET — BE THE FIRST
            </p>
          </div>
        )}
      </div>
    </PageShell>
  );
}
