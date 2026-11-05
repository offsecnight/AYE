import { cn } from "@/lib/utils";

type Status = "UNRESOLVED" | "TRENDING" | "FIX_PROPOSED" | "RESOLVED" | "HIDDEN_JUNK";
type Severity = "NORMAL" | "HIGH" | "CRITICAL";

const statusConfig: Record<Status, { label: string; cls: string }> = {
  UNRESOLVED:   { label: "UNRESOLVED",    cls: "badge badge-red" },
  TRENDING:     { label: "⚡ TRENDING",   cls: "badge badge-amber" },
  FIX_PROPOSED: { label: "🔧 FIX PROPOSED", cls: "badge bg-amber/20 text-ink border-2 border-amber" },
  RESOLVED:     { label: "✓ RESOLVED",   cls: "badge badge-green" },
  HIDDEN_JUNK:  { label: "JUNK",         cls: "badge bg-ink/20 text-ink" },
};

const severityConfig: Record<Severity, { label: string; cls: string }> = {
  NORMAL:   { label: "NORMAL",   cls: "badge badge-outline" },
  HIGH:     { label: "HIGH",     cls: "badge badge-amber" },
  CRITICAL: { label: "CRITICAL", cls: "badge badge-red" },
};

export function StatusBadge({ status }: { status: Status }) {
  const cfg = statusConfig[status];
  return <span className={cfg.cls}>{cfg.label}</span>;
}

export function SeverityBadge({ severity }: { severity: Severity }) {
  const cfg = severityConfig[severity];
  return <span className={cfg.cls}>{cfg.label}</span>;
}

export function CategoryBadge({ category }: { category: string }) {
  return (
    <span className="badge badge-acid">{category.replace("_", " ")}</span>
  );
}

export function TrustScorePill({ score }: { score: number }) {
  const cls = cn(
    "font-mono font-bold text-xs px-2 py-0.5 border-2 border-ink",
    score >= 80 ? "bg-emerald text-white" :
    score >= 50 ? "bg-acid text-ink" :
    "bg-danger text-white"
  );
  return <span className={cls}>TRUST {score}</span>;
}
