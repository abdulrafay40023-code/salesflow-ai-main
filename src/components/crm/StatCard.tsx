import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  trend,
  tone = "primary",
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon: LucideIcon;
  trend?: string;
  tone?: "primary" | "success" | "warning" | "info" | "destructive";
}) {
  const tones: Record<string, string> = {
    primary: "bg-primary/10 text-primary",
    success: "bg-success/12 text-success",
    warning: "bg-warning/15 text-warning",
    info: "bg-info/12 text-info",
    destructive: "bg-destructive/10 text-destructive",
  };

  return (
    <div className="panel group p-5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[var(--shadow-float)]">
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 truncate text-sm font-medium text-muted-foreground">{label}</p>
        <span className={cn("grid size-9 shrink-0 place-items-center rounded-xl", tones[tone])}>
          <Icon className="size-4.5" />
        </span>
      </div>
      <p className="mt-3 font-display text-3xl font-bold tabular-nums">{value}</p>
      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
        {trend ? (
          <span className="rounded-full bg-success/12 px-2 py-0.5 font-semibold text-success">
            {trend}
          </span>
        ) : null}
        {hint ? <span className="text-muted-foreground">{hint}</span> : null}
      </div>
    </div>
  );
}
