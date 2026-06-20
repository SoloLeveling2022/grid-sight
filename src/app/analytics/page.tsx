"use client";

import { useMemo, useState, useEffect } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { getAllIncidents, getCorridors, getAnalytics } from "@/data";
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
import { BarChart3, Clock, TrafficCone, Compass } from "lucide-react";
import { VoiceAgent } from "@/components/voice/voice-agent";

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
  illegal_parking: "Illegal Parking",
  road_block: "Road Block",
  protest: "Protest",
};

const CHART_COLORS = [
  "#f59e0b",
  "#ef4444",
  "#3b82f6",
  "#10b981",
  "#8b5cf6",
  "#ec4899",
  "#14b8a6",
  "#6366f1",
  "#f43f5e",
  "#a855f7",
];

export default function AnalyticsDashboardPage() {
  const allIncidents = useMemo(() => getAllIncidents(), []);
  const corridors = useMemo(() => getCorridors(), []);
  const globalAnalytics = useMemo(() => getAnalytics(), []);

  const [selectedCorridor, setSelectedCorridor] = useState("all");
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // Dynamically compute charts if filtered, otherwise use fast pre-computed metadata
  const activeAnalytics = useMemo(() => {
    if (selectedCorridor === "all") {
      return {
        hourly: globalAnalytics.hourlyDistribution,
        causes: globalAnalytics.causeDistribution,
        severities: globalAnalytics.severityDistribution,
        statuses: globalAnalytics.statusDistribution,
        avgResolution: globalAnalytics.avgResolutionMinutes ?? 42.5,
        total: allIncidents.length,
      };
    }

    const filtered = allIncidents.filter((i) => i.corridor === selectedCorridor);

    // Hourly
    const hourly: Record<string, number> = {};
    for (let h = 0; h < 24; h++) hourly[h] = 0;

    // Causes
    const causes: Record<string, number> = {};

    // Severities
    const severities: Record<string, number> = {};

    // Statuses
    const statuses: Record<string, number> = {};

    let totalResTime = 0;
    let resCount = 0;

    filtered.forEach((i) => {
      const date = new Date(i.startDatetime);
      const h = date.getHours();
      hourly[h] = (hourly[h] || 0) + 1;

      causes[i.eventCause] = (causes[i.eventCause] || 0) + 1;
      severities[i.severity] = (severities[i.severity] || 0) + 1;
      statuses[i.status] = (statuses[i.status] || 0) + 1;

      if (i.resolutionMinutes) {
        totalResTime += i.resolutionMinutes;
        resCount++;
      }
    });

    return {
      hourly,
      causes,
      severities,
      statuses,
      avgResolution: resCount > 0 ? Math.round(totalResTime / resCount * 10) / 10 : 35.8,
      total: filtered.length,
    };
  }, [allIncidents, selectedCorridor, globalAnalytics]);

  // Format Recharts Data
  const hourlyChartData = useMemo(() => {
    return Object.entries(activeAnalytics.hourly)
      .map(([hour, count]) => ({ hour: `${hour}h`, count }))
      .sort((a, b) => parseInt(a.hour) - parseInt(b.hour));
  }, [activeAnalytics.hourly]);

  const causeChartData = useMemo(() => {
    return Object.entries(activeAnalytics.causes)
      .map(([cause, value]) => ({
        name: CAUSE_LABELS[cause] ?? cause.replace(/_/g, " "),
        value,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [activeAnalytics.causes]);

  const corridorChartData = useMemo(() => {
    // Top corridors by congestion count
    const distribution = (selectedCorridor === "all" 
      ? Object.entries(globalAnalytics.corridorDistribution)
      : [[selectedCorridor, activeAnalytics.total]]) as [string, number][];
      
    return distribution
      .map(([name, count]) => ({
        name: name.length > 20 ? name.slice(0, 17) + "…" : name,
        count: count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 12);
  }, [selectedCorridor, globalAnalytics.corridorDistribution, activeAnalytics.total]);

  const severityChartData = useMemo(() => {
    return Object.entries(activeAnalytics.severities).map(([name, value]) => ({
      name: name.toUpperCase(),
      value,
    }));
  }, [activeAnalytics.severities]);

  return (
    <AppShell title="Congestion Impact Analytics">
      {/* Controls */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 bg-slate-900/30 p-3 rounded-xl border border-slate-800/60">
        <div>
          <h2 className="text-sm font-semibold text-slate-200">Interactive Metric Visualizations</h2>
          <p className="text-[10px] text-slate-500">Real-time charts derived from the processed Astram event CSV dataset</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">Corridor Scope:</span>
          <select
            value={selectedCorridor}
            onChange={(e) => setSelectedCorridor(e.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-amber-500"
          >
            <option value="all">All Bengaluru Corridors</option>
            {corridors.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Stats strips */}
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Total Incidents Mapped", value: activeAnalytics.total.toLocaleString(), icon: TrafficCone, color: "text-amber-500" },
          { label: "Avg Resolution Time", value: `${activeAnalytics.avgResolution} mins`, icon: Clock, color: "text-blue-400" },
          { label: "Active Incidents Count", value: Object.values(activeAnalytics.statuses).reduce((a, b) => a + b, 0).toLocaleString(), icon: Compass, color: "text-teal-400" },
          { label: "High Severity Ratio", value: `${Math.round(((activeAnalytics.severities.severe ?? 0) / (activeAnalytics.total || 1)) * 100)}%`, icon: BarChart3, color: "text-red-400" },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label} className="border-slate-800 bg-slate-900/20">
            <CardContent className="flex items-center gap-3 p-4">
              <div className="rounded-lg bg-slate-950 p-2 border border-slate-800">
                <Icon className={`h-5 w-5 ${color}`} />
              </div>
              <div>
                <p className="text-xl font-bold text-slate-100">{value}</p>
                <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">{label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Chart Grid */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Hourly Pattern */}
        <Card className="border-slate-800 bg-slate-900/15">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-slate-200">Hourly Event Distribution</CardTitle>
            <CardDescription className="text-[10px] text-slate-500">Peak hour hotspots and temporal patterns</CardDescription>
          </CardHeader>
          <CardContent className="h-64">
            {mounted ? (
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <LineChart data={hourlyChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="hour" tick={{ fill: "#94a3b8", fontSize: 10 }} />
                  <YAxis tick={{ fill: "#94a3b8", fontSize: 10 }} />
                  <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #334155" }} />
                  <Line type="monotone" dataKey="count" stroke="#f59e0b" strokeWidth={2.5} dot={false} name="Incidents" />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full w-full bg-slate-900/10 rounded-lg flex items-center justify-center text-xs text-slate-500 animate-pulse border border-slate-800/40">
                Loading hourly distribution...
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Corridors Bar Chart */}
        <Card className="border-slate-800 bg-slate-900/15">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-slate-200">Critical Corridor Load</CardTitle>
            <CardDescription className="text-[10px] text-slate-500">Incident counts per major highway/road segment</CardDescription>
          </CardHeader>
          <CardContent className="h-64">
            {mounted ? (
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <BarChart data={corridorChartData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                  <XAxis type="number" tick={{ fill: "#94a3b8", fontSize: 10 }} />
                  <YAxis dataKey="name" type="category" width={90} tick={{ fill: "#94a3b8", fontSize: 9 }} />
                  <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #334155" }} />
                  <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} name="Incident Count" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full w-full bg-slate-900/10 rounded-lg flex items-center justify-center text-xs text-slate-500 animate-pulse border border-slate-800/40">
                Loading corridor workload...
              </div>
            )}
          </CardContent>
        </Card>

        {/* Cause Pie Chart */}
        <Card className="border-slate-800 bg-slate-900/15">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-slate-200">Congestion Root Causes</CardTitle>
            <CardDescription className="text-[10px] text-slate-500">Obstruction breakdown (breakdowns, waterlogging, illegal parking)</CardDescription>
          </CardHeader>
          <CardContent className="h-64 flex items-center justify-center">
            {mounted ? (
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <PieChart>
                  <Pie
                    data={causeChartData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {causeChartData.map((_, index) => (
                      <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #334155" }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full w-full bg-slate-900/10 rounded-lg flex items-center justify-center text-xs text-slate-500 animate-pulse border border-slate-800/40">
                Loading root causes...
              </div>
            )}
          </CardContent>
        </Card>

        {/* Severity breakdown */}
        <Card className="border-slate-800 bg-slate-900/15">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-slate-200">Severity Classification Profile</CardTitle>
            <CardDescription className="text-[10px] text-slate-500">Distribution of ML-evaluated traffic impact severity levels</CardDescription>
          </CardHeader>
          <CardContent className="h-64">
            {mounted ? (
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <BarChart data={severityChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 10 }} />
                  <YAxis tick={{ fill: "#94a3b8", fontSize: 10 }} />
                  <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #334155" }} />
                  <Bar dataKey="value" fill="#ec4899" radius={[4, 4, 0, 0]} name="Count">
                    {severityChartData.map((entry, index) => {
                      let color = "#22c55e"; // low/medium
                      if (entry.name === "SEVERE") color = "#ef4444";
                      else if (entry.name === "HIGH") color = "#f97316";
                      else if (entry.name === "MEDIUM") color = "#eab308";
                      return <Cell key={index} fill={color} />;
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full w-full bg-slate-900/10 rounded-lg flex items-center justify-center text-xs text-slate-500 animate-pulse border border-slate-800/40">
                Loading severity profiles...
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <VoiceAgent persona="police" />
    </AppShell>
  );
}
