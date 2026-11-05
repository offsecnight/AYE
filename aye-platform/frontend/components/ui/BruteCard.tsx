import { cn } from "@/lib/utils";

interface BruteCardProps {
  children: React.ReactNode;
  className?: string;
  accent?: "acid" | "danger" | "amber" | "emerald" | "none";
}

const accentMap = {
  acid:    "border-t-4 border-t-acid",
  danger:  "border-t-4 border-t-danger",
  amber:   "border-t-4 border-t-amber",
  emerald: "border-t-4 border-t-emerald",
  none:    "",
};

export function BruteCard({ children, className, accent = "none" }: BruteCardProps) {
  return (
    <div className={cn("brute-card", accentMap[accent], className)}>
      {children}
    </div>
  );
}
