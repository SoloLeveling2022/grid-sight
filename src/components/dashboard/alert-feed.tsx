"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatRelativeTime, severityBadgeClass } from "@/lib/utils";
import type { Alert, Recommendation } from "@/types";
import { AlertTriangle, Shield, Truck, Eye, Route } from "lucide-react";

const REC_ICONS: Record<string, React.ReactNode> = {
  tow_recommendation: <Truck className="h-4 w-4" />,
  barricade_recommendation: <Shield className="h-4 w-4" />,
  patrol_dispatch: <Shield className="h-4 w-4" />,
  monitor: <Eye className="h-4 w-4" />,
  diversion: <Route className="h-4 w-4" />,
};

export function AlertFeed({ alerts }: { alerts: Alert[] }) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-red-400" />
          Active alerts
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 max-h-64 overflow-y-auto">
        {alerts.map((a) => (
          <div key={a.id} className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
            <div className="flex items-start justify-between gap-2">
              <p className="text-xs font-medium text-slate-200">{a.title}</p>
              <Badge severity={a.severity}>{a.severity}</Badge>
            </div>
            <p className="mt-1 text-[10px] text-slate-500 line-clamp-2">{a.message}</p>
            <p className="mt-1 text-[10px] text-slate-600">{formatRelativeTime(a.timestamp)}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function RecommendationPanel({ recommendations }: { recommendations: Recommendation[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Enforcement recommendations</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {recommendations.map((r) => (
          <div
            key={r.id}
            className={`rounded-lg border p-3 ${severityBadgeClass(r.priority)}`}
          >
            <div className="flex items-center gap-2 text-sm font-medium">
              {REC_ICONS[r.type]}
              {r.title}
            </div>
            <p className="mt-1 text-xs opacity-80">{r.description}</p>
            <div className="mt-2 flex items-center justify-between text-[10px]">
              <span>Score: {r.enforcementScore}/100</span>
              <span className="uppercase">{r.type.replace(/_/g, " ")}</span>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
