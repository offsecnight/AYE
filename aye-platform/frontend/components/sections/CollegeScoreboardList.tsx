"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Search, RefreshCw } from "lucide-react";
import { GradeDisplay }      from "@/components/ui/GradeDisplay";
import { collegesApi, CollegePublic } from "@/lib/api";

export function CollegeScoreboardList() {
  const [colleges, setColleges] = useState<CollegePublic[]>([]);
  const [query,    setQuery]    = useState("");
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);

  function fetchColleges() {
    setLoading(true);
    setError(null);
    collegesApi.list()
      .then((d) => setColleges(d.colleges))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  }

  useEffect(() => { fetchColleges(); }, []);

  const filtered = colleges.filter(
    (c) =>
      c.name.toLowerCase().includes(query.toLowerCase()) ||
      c.city.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <section className="py-6 sm:py-8">
      <div className="section-label mb-5 inline-block">
        COLLEGE REALITY SCOREBOARD
      </div>

      {/* SEARCH */}
      <div className="flex gap-2 mb-5 max-w-md">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink/40 pointer-events-none" />
          <input
            className="brute-input pl-10"
            placeholder="Search any college..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search colleges"
          />
        </div>
        <button
          onClick={fetchColleges}
          className="min-w-[48px] min-h-[48px] flex items-center justify-center border-3 border-ink bg-white shadow-brutal"
          aria-label="Refresh scoreboard"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {/* ERROR */}
      {error && (
        <div className="brute-card p-4 mb-4 border-t-4 border-danger">
          <p className="font-mono text-sm text-danger uppercase">{error}</p>
          <button onClick={fetchColleges} className="btn-secondary text-xs mt-2">RETRY</button>
        </div>
      )}

      {/* TABLE — horizontally scrollable on mobile */}
      <div className="border-3 border-ink shadow-brutal overflow-x-auto -mx-4 sm:mx-0">
        {/* Scroll hint gradient on mobile */}
        <div className="relative">
          <table className="w-full min-w-[560px]">
            <thead className="bg-ink text-acid">
              <tr>
                {["COLLEGE", "CITY", "GRADE", "RESOLUTION", "ISSUES", "RESOLVED"].map((h) => (
                  <th
                    key={h}
                    className="px-3 sm:px-4 py-3 text-left font-mono text-xs uppercase tracking-widest border-r-2 border-acid/20 last:border-r-0"
                    scope="col"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i} className="border-t-2 border-ink">
                    {Array.from({ length: 6 }).map((_, j) => (
                      <td key={j} className="px-3 sm:px-4 py-4">
                        <div className="h-4 bg-ink/10 animate-pulse rounded" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : (
                filtered.map((c) => (
                  <tr
                    key={c.college_id}
                    className="border-t-2 border-ink hover:bg-acid/10 transition-colors"
                  >
                    <td className="px-3 sm:px-4 py-4 max-w-[200px]">
                      <Link
                        href={`/c/${c.slug}`}
                        className="font-mono font-bold text-sm hover:underline underline-offset-4 decoration-2 block truncate"
                      >
                        {c.name}
                      </Link>
                    </td>
                    <td className="px-3 sm:px-4 py-4 font-mono text-xs text-ink/60 uppercase whitespace-nowrap">
                      {c.city}
                    </td>
                    <td className="px-3 sm:px-4 py-4">
                      <GradeDisplay grade={c.reality_grade} size="sm" />
                    </td>
                    <td className="px-3 sm:px-4 py-4">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-3 border-2 border-ink bg-paper min-w-[60px] overflow-hidden">
                          <div
                            className="h-full"
                            style={{
                              width: `${c.resolution_rate ?? 0}%`,
                              background:
                                (c.resolution_rate ?? 0) >= 70 ? "#10B981" :
                                (c.resolution_rate ?? 0) >= 50 ? "#F59E0B" : "#E11D48",
                            }}
                          />
                        </div>
                        <span className="font-mono text-xs font-bold whitespace-nowrap">
                          {(c.resolution_rate ?? 0).toFixed(0)}%
                        </span>
                      </div>
                    </td>
                    <td className="px-3 sm:px-4 py-4 font-mono text-sm font-bold">
                      {c.total_experiences}
                    </td>
                    <td className="px-3 sm:px-4 py-4 font-mono text-sm font-bold text-emerald">
                      {c.total_resolved}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {!loading && filtered.length === 0 && (
          <div className="py-12 text-center font-mono text-sm text-ink/40 uppercase tracking-wider">
            {query ? "NO COLLEGES MATCH SEARCH" : "NO COLLEGES REGISTERED YET"}
          </div>
        )}
      </div>

      {/* Mobile hint */}
      <p className="font-mono text-[10px] text-ink/30 uppercase mt-2 text-right sm:hidden">
        ← SCROLL TO SEE MORE →
      </p>
    </section>
  );
}
