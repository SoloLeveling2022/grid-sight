"use client";

import { Badge } from "@/components/ui/badge";
import { cn, formatRelativeTime } from "@/lib/utils";
import type { Hotspot, Incident } from "@/types";

export function HotspotRankingList({
  hotspots,
  selectedId,
  onSelect,
}: {
  hotspots: Hotspot[];
  selectedId?: string | null;
  onSelect?: (h: Hotspot) => void;
}) {
  return (
    <div className="space-y-1">
      {hotspots.slice(0, 10).map((hs, i) => (
        <button
          key={hs.id}
          type="button"
          onClick={() => onSelect?.(hs)}
          className={cn(
            "w-full rounded-lg border px-3 py-2 text-left transition-colors",
            selectedId === hs.id
              ? "border-amber-500/50 bg-amber-500/10"
              : "border-slate-800 bg-slate-950/40 hover:border-slate-700"
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-200">
              #{i + 1} {hs.name}
            </span>
            <Badge severity={hs.severity}>{Math.round(hs.hotspotScore * 100)}</Badge>
          </div>
          <p className="text-[10px] text-slate-500 mt-0.5">
            {hs.incidentCount} incidents · {Math.round(hs.recurrenceProbability * 100)}% recurrence
          </p>
        </button>
      ))}
    </div>
  );
}

export function IncidentQueue({
  incidents,
  selectedId,
  onSelect,
}: {
  incidents: Incident[];
  selectedId?: string | null;
  onSelect?: (i: Incident) => void;
}) {
  const sorted = [...incidents].sort((a, b) => b.impactScore - a.impactScore);

  return (
    <div className="space-y-1 max-h-80 overflow-y-auto">
      {sorted.slice(0, 20).map((inc) => (
        <button
          key={inc.id}
          type="button"
          onClick={() => onSelect?.(inc)}
          className={cn(
            "w-full rounded-lg border px-3 py-2 text-left transition-colors",
            selectedId === inc.id
              ? "border-amber-500/50 bg-amber-500/10"
              : "border-slate-800 bg-slate-950/40 hover:border-slate-700"
          )}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-slate-200 truncate flex-1">
              {inc.eventCause.replace(/_/g, " ")} · {inc.corridor}
            </span>
            <Badge severity={inc.severity}>{inc.priority}</Badge>
          </div>
          <p className="text-[10px] text-slate-500 truncate">{inc.address}</p>
          <p className="text-[10px] text-slate-600">{formatRelativeTime(inc.startDatetime)} · Impact {Math.round(inc.impactScore * 100)}</p>
        </button>
      ))}
    </div>
  );
}
