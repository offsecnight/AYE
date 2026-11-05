import { cn } from "@/lib/utils";

interface GradeDisplayProps {
  grade: string;
  size?: "sm" | "lg" | "xl";
}

const gradeColors: Record<string, string> = {
  A: "bg-emerald text-white",
  B: "bg-acid text-ink",
  C: "bg-amber text-ink",
  D: "bg-orange-500 text-white",
  F: "bg-danger text-white",
  "N/A": "bg-ink/20 text-ink",
};

const sizeMap = {
  sm: "text-2xl w-10 h-10",
  lg: "text-5xl w-20 h-20",
  xl: "text-7xl w-28 h-28",
};

export function GradeDisplay({ grade, size = "lg" }: GradeDisplayProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-center font-mono font-bold border-3 border-ink shadow-brutal",
        gradeColors[grade] ?? gradeColors["N/A"],
        sizeMap[size]
      )}
    >
      {grade}
    </div>
  );
}
