import { cn, severityBadgeClass } from "@/lib/utils";

export function Badge({
  className,
  severity,
  children,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { severity?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
        severity ? severityBadgeClass(severity) : "bg-slate-800 text-slate-300 border-slate-700",
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
