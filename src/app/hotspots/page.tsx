"use client";

import { useMemo, useState, useEffect } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { GridSightMap } from "@/components/map/gridsight-map";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useViolationPoliceStore } from "@/store";
import { toMapHotspots } from "@/data/violations";
import { MapPin, AlertTriangle, RefreshCw, Flame, Clock, Navigation } from "lucide-react";
import { VoiceAgent } from "@/components/voice/voice-agent";

export default function HotspotsPage() {
  const { junctions, fetchHotspots } = useViolationPoliceStore();
  const [selectedJuncName, setSelectedJuncName] = useState<string | null>(null);

  useEffect(() => {
    fetchHotspots().catch(() => { });
  }, [fetchHotspots]);

  // Convert store junctions into standard map markers format
  const mapHotspots = useMemo(() => {
    return toMapHotspots(junctions);
  }, [junctions]);

  // Sort junctions by violation count
  const sortedJunctions = useMemo(() => {
    return [...junctions].sort((a, b) => b.violationCount - a.violationCount);
  }, [junctions]);

  // Find currently selected junction structure
  const activeJunction = useMemo(() => {
    if (!selectedJuncName && sortedJunctions.length > 0) {
      return sortedJunctions[0];
    }
    return sortedJunctions.find((j) => j.junctionName === selectedJuncName) || sortedJunctions[0] || null;
  }, [sortedJunctions, selectedJuncName]);

  // Set initial selected name once hotspots load
  useEffect(() => {
    if (activeJunction && !selectedJuncName) {
      setSelectedJuncName(activeJunction.junctionName);
    }
  }, [activeJunction, selectedJuncName]);

  // Compute total hotspots statistics
  const stats = useMemo(() => {
    const total = junctions.length;
    const severeCount = junctions.filter((h) => h.enforcementPriority === "severe" || h.enforcementPriority === "high").length;
    const totalViolations = junctions.reduce((sum, h) => sum + h.violationCount, 0);
    const maxDelay = junctions.reduce((max, h) => Math.max(max, h.expectedDelayMinutes || 0), 0);
    return { total, severeCount, totalViolations, maxDelay };
  }, [junctions]);

  return (
    <AppShell title="Hotspots & Corridors">
      {/* Top Stats Cards */}
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Centroid Hotspots", value: stats.total, icon: MapPin, color: "text-amber-400" },
          { label: "High Risk Corridors", value: stats.severeCount, icon: Flame, color: "text-red-400" },
          { label: "Cluster Violations", value: stats.totalViolations.toLocaleString(), icon: AlertTriangle, color: "text-orange-400" },
          { label: "Peak Delay Detected", value: `${Math.round(stats.maxDelay)} mins`, icon: RefreshCw, color: "text-blue-400" },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label} className="border-slate-800 bg-slate-900/20">
            <CardContent className="flex items-center gap-3 p-4">
              <div className="rounded-lg bg-slate-950 p-2 border border-slate-800">
                <Icon className={`h-5 w-5 ${color}`} />
              </div>
              <div>
                <p className="text-xl font-bold text-slate-100">{value}</p>
                <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">{label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        {/* Junction Ranking List (Left 6 columns) */}
        <div className="lg:col-span-6 flex flex-col gap-3">
          <Card className="flex-1 border-slate-800 bg-slate-900/10 flex flex-col">
            <CardHeader className="pb-2 border-b border-slate-850">
              <CardTitle className="text-sm font-semibold text-slate-200">Violation Hotspot Density Rankings</CardTitle>
              <CardDescription className="text-slate-500">
                DBSCAN-clustered coordinates sorted by active roadside ticket frequency.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0 flex-1 overflow-y-auto max-h-[560px] divide-y divide-slate-850 scrollbar-thin">
              {sortedJunctions.map((j, i) => (
                <div
                  key={j.junctionName}
                  onClick={() => {
                    setSelectedJuncName(j.junctionName);
                  }}
                  className={`p-3.5 cursor-pointer transition-all ${
                    activeJunction?.junctionName === j.junctionName
                      ? "bg-amber-500/10 border-l-2 border-amber-500"
                      : "hover:bg-slate-900/30"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-200 truncate pr-2">
                      #{i + 1} {j.junctionName}
                    </span>
                    <Badge severity={j.enforcementPriority}>{j.enforcementPriority}</Badge>
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-500">
                    <span>
                      {j.violationCount} cases · {j.uniqueVehicles} unique plates
                    </span>
                    <span>
                      Congestion Impact: <strong className="text-slate-400">{Math.round((j.congestionScore ?? 0) * 100)}%</strong>
                    </span>
                  </div>
                  <p className="mt-1 text-[9px] text-slate-600 truncate">
                    Dominant Infraction: {(j.dominantViolationType ?? "N/A").replace(/_/g, " ")}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Junction Details and Map Canvas (Right 6 columns) */}
        <div className="lg:col-span-6 flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-1">
            {/* Selected Hotspot Details */}
            <Card className="border-slate-800 bg-slate-900/15 min-h-[260px] flex flex-col justify-between">
              <CardHeader className="pb-1">
                <span className="text-[9px] text-slate-500 uppercase tracking-widest font-bold">
                  Cluster Intelligence Details
                </span>
                <CardTitle className="text-sm font-bold text-slate-100 pt-1">
                  {activeJunction?.junctionName} ({activeJunction?.policeStation})
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-slate-350 space-y-2.5 pb-4 flex-1 flex flex-col justify-between">
                {activeJunction && (
                  <div className="space-y-3">
                    <p className="leading-relaxed">
                      This intersection is classified as a <strong className="text-amber-400 capitalize">{activeJunction.enforcementPriority}</strong> enforcement zone due to high parking obstruction rates on adjacent roads.
                    </p>

                    <div className="grid grid-cols-3 gap-2 text-[9px] bg-slate-950 p-2.5 rounded border border-slate-900">
                      <div>
                        <span className="text-slate-500 block">Est. Delay</span>
                        <span className="text-slate-200 font-bold text-xs">{Math.round(activeJunction.expectedDelayMinutes ?? 0)} mins</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Speed Drop</span>
                        <span className="text-red-400 font-bold text-xs">-{Math.round(activeJunction.estimatedSpeedDrop ?? 0)} km/h</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Repeat Rate</span>
                        <span className="text-slate-200 font-bold text-xs">{Math.round((activeJunction.repeatFrequency ?? 0) * 100)}%</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-[10px]">
                      <span className="text-slate-500 flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5 text-amber-500" />
                        Peak: {activeJunction.peakHours ?? "N/A"}
                      </span>
                      <span className="text-slate-500 flex items-center gap-1 ml-2">
                        <Navigation className="h-3.5 w-3.5 text-blue-400" />
                        Zones: {activeJunction.nearbySensitivePlaces?.join(", ") ?? "None"}
                      </span>
                    </div>
                  </div>
                )}

                <div className="text-[10px] text-slate-600 italic mt-auto border-t border-slate-900 pt-2 font-mono">
                  Centroid: {activeJunction ? `${activeJunction.latitude.toFixed(5)}, ${activeJunction.longitude.toFixed(5)}` : ""} · Confidence {activeJunction ? Math.round((activeJunction.confidence ?? 0) * 100) : 0}%
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Interactive Map */}
          <Card className="border-slate-800 bg-slate-900/15 overflow-hidden flex flex-col h-[300px]">
            <CardHeader className="p-3 pb-1 border-b border-slate-850">
              <CardTitle className="text-xs font-semibold text-slate-400 flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5 text-amber-400" />
                Live Telemetry Centroids Map
              </CardTitle>
            </CardHeader>
            <div className="flex-1 relative">
              {activeJunction && (
                <GridSightMap
                  className="absolute inset-0 h-full w-full rounded-none border-none"
                  hotspots={mapHotspots}
                  junctions={[]}
                  showHeatmap
                  showHotspots
                  showIncidents={false}
                  selectedId={activeJunction.junctionName}
                  onSelectHotspot={(hs) => {
                    setSelectedJuncName(hs.id);
                  }}
                />
              )}
            </div>
          </Card>
        </div>
      </div>
      <VoiceAgent persona="police" />
    </AppShell>
  );
}
