"use client";

import { useEffect, useState, useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAnalytics } from "@/data";
import { severityColor } from "@/lib/utils";

const CAUSE_LABELS: Record<string, string> = {
  vehicle_breakdown: "Breakdown",
  others: "Others",
  pot_holes: "Potholes",
  water_logging: "Water logging",
  tree_fall: "Tree fall",
  accident: "Accident",
  congestion: "Congestion",
  construction: "Construction",
  public_event: "Public event",
};

export function AnalyticsPanel() {
  const analytics = getAnalytics();

  const hourlyData = useMemo(
    () =>
      Object.entries(analytics.hourlyDistribution)
        .map(([hour, count]) => ({ hour: `${hour}h`, count }))
        .sort((a, b) => parseInt(a.hour) - parseInt(b.hour)),
    [analytics.hourlyDistribution]
  );

  const causeData = useMemo(
    () =>
      Object.entries(analytics.causeDistribution)
        .slice(0, 8)
        .map(([cause, value]) => ({
          name: CAUSE_LABELS[cause] ?? cause,
          value,
        })),
    [analytics.causeDistribution]
  );

  const corridorData = useMemo(
    () =>
      Object.entries(analytics.corridorDistribution).map(([name, count]) => ({
        name: name.length > 14 ? name.slice(0, 12) + "…" : name,
        count,
      })),
    [analytics.corridorDistribution]
  );

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const COLORS = ["#f59e0b", "#ef4444", "#3b82f6", "#22c55e", "#a855f7", "#ec4899", "#14b8a6", "#64748b"];

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Hourly incident pattern</CardTitle>
        </CardHeader>
        <CardContent className="h-48 min-h-48">
          {mounted ? (
            <ResponsiveContainer width="100%" height={180} minWidth={0} minHeight={0}>
              <LineChart data={hourlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="hour" tick={{ fill: "#94a3b8", fontSize: 10 }} />
                <YAxis tick={{ fill: "#94a3b8", fontSize: 10 }} />
                <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #334155" }} />
                <Line type="monotone" dataKey="count" stroke="#f59e0b" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[180px] w-full bg-slate-900/10 rounded-lg flex items-center justify-center text-xs text-slate-500 animate-pulse border border-slate-800/40">
              Loading hourly pattern...
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Top corridors</CardTitle>
        </CardHeader>
        <CardContent className="h-48 min-h-48">
          {mounted ? (
            <ResponsiveContainer width="100%" height={180} minWidth={0} minHeight={0}>
              <BarChart data={corridorData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                <XAxis type="number" tick={{ fill: "#94a3b8", fontSize: 10 }} />
                <YAxis dataKey="name" type="category" width={80} tick={{ fill: "#94a3b8", fontSize: 9 }} />
                <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #334155" }} />
                <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[180px] w-full bg-slate-900/10 rounded-lg flex items-center justify-center text-xs text-slate-500 animate-pulse border border-slate-800/40">
              Loading top corridors...
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle>Event cause distribution</CardTitle>
        </CardHeader>
        <CardContent className="h-52 min-h-52 flex items-center justify-center">
          {mounted ? (
            <ResponsiveContainer width="100%" height={200} minWidth={0} minHeight={0}>
              <PieChart>
                <Pie data={causeData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}>
                  {causeData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #334155" }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[200px] w-full bg-slate-900/10 rounded-lg flex items-center justify-center text-xs text-slate-500 animate-pulse border border-slate-800/40">
              Loading event cause distribution...
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function SeverityLegend() {
  const items = ["severe", "high", "medium", "low"];
  return (
    <div className="flex flex-wrap gap-3 text-xs text-slate-400">
      {items.map((s) => (
        <span key={s} className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: severityColor(s) }} />
          {s}
        </span>
      ))}
    </div>
  );
}
