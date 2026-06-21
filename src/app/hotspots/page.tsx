"use client";

import { useMemo, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { GridSightMap } from "@/components/map/gridsight-map";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getHotspots, getJunctionHotspots } from "@/data";
import type { Hotspot, JunctionHotspot } from "@/types";
import { MapPin, AlertTriangle, RefreshCw, Flame } from "lucide-react";
import { VoiceAgent } from "@/components/voice/voice-agent";

export default function HotspotsPage() {
  const hotspots = useMemo(() => getHotspots(), []);
  const junctions = useMemo(() => getJunctionHotspots(30), []);

  const [selectedHotspot, setSelectedHotspot] = useState<Hotspot | null>(hotspots[0] || null);
  const [selectedJunc, setSelectedJunc] = useState<JunctionHotspot | null>(null);

  // Determine current active selection on map
  const activeSelectionId = selectedJunc ? selectedJunc.id : (selectedHotspot ? selectedHotspot.id : null);

  // Compute total hotspots stats
  const stats = useMemo(() => {
    const total = hotspots.length;
    const severeCount = hotspots.filter((h) => h.severity === "severe" || h.severity === "high").length;
    const avgScore = hotspots.reduce((sum, h) => sum + h.hotspotScore, 0) / (total || 1);
    const totalIncidents = hotspots.reduce((sum, h) => sum + h.incidentCount, 0);
    return { total, severeCount, avgScore, totalIncidents };
  }, [hotspots]);

  return (
    <AppShell title="Hotspots & Corridors">
      {/* Top Stats */}
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Analyzed Corridors", value: stats.total, icon: MapPin, color: "text-amber-400" },
          { label: "High Risk Spots", value: stats.severeCount, icon: Flame, color: "text-red-400" },
          { label: "Avg Hotspot Intensity", value: `${Math.round(stats.avgScore * 100)}%`, icon: AlertTriangle, color: "text-orange-400" },
          { label: "Accumulated Incidents", value: stats.totalIncidents.toLocaleString(), icon: RefreshCw, color: "text-blue-400" },
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

      <div className="grid gap-4 lg:grid-cols-12">
        {/* Corridor Ranking (Left 6 columns) */}
        <div className="lg:col-span-6 flex flex-col gap-3">
          <Card className="flex-1 border-slate-800 bg-slate-900/10 flex flex-col">
            <CardHeader className="pb-2 border-b border-slate-850">
              <CardTitle className="text-sm font-semibold text-slate-200">Corridor Hotspot Ranking</CardTitle>
              <CardDescription className="text-slate-500">
                Ranked by incident frequency, avg ML impact score, and recurrence scoring
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0 flex-1 overflow-y-auto max-h-[560px] divide-y divide-slate-850 scrollbar-thin">
              {hotspots.map((hs, i) => (
                <div
                  key={hs.id}
                  onClick={() => {
                    setSelectedHotspot(hs);
                    setSelectedJunc(null);
                  }}
                  className={`p-3.5 cursor-pointer transition-all ${
                    selectedHotspot?.id === hs.id && !selectedJunc
                      ? "bg-amber-500/10 border-l-2 border-amber-500"
                      : "hover:bg-slate-900/30"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-200 truncate pr-2">
                      #{i + 1} {hs.name}
                    </span>
                    <Badge severity={hs.severity}>{Math.round(hs.hotspotScore * 100)}</Badge>
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-500">
                    <span>
                      {hs.incidentCount} incidents · {hs.highPriorityCount} high priority
                    </span>
                    <span>
                      Recurrence Prob: <strong className="text-slate-400">{Math.round(hs.recurrenceProbability * 100)}%</strong>
                    </span>
                  </div>
                  <p className="mt-1 text-[9px] text-slate-600 truncate">
                    Top triggers: {hs.topCauses.slice(0, 3).join(", ").replace(/_/g, " ")}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Junction Queue and Map Area (Right 6 columns) */}
        <div className="lg:col-span-6 flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Junction List */}
            <Card className="border-slate-800 bg-slate-900/10 h-[300px] flex flex-col">
              <CardHeader className="pb-2 border-b border-slate-850">
                <CardTitle className="text-sm font-semibold text-slate-200">Critical Junctions</CardTitle>
                <CardDescription className="text-[10px] text-slate-500">Intersection hotspots</CardDescription>
              </CardHeader>
              <CardContent className="p-0 overflow-y-auto flex-1 divide-y divide-slate-850 scrollbar-thin">
                {junctions.map((j) => (
                  <div
                    key={j.id}
                    onClick={() => {
                      setSelectedJunc(j);
                    }}
                    className={`p-2.5 cursor-pointer text-xs transition-all ${
                      selectedJunc?.id === j.id
                        ? "bg-cyan-500/10 border-l-2 border-cyan-400"
                        : "hover:bg-slate-900/30"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-200 truncate pr-2">{j.name}</span>
                      <Badge className="h-4 py-0 text-[8px]">{Math.round(j.hotspotScore * 100)}</Badge>
                    </div>
                    <p className="text-[9px] text-slate-500 mt-0.5">
                      {j.incidentCount} intersection incidents · Corridor: {j.corridor}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Selected Spot Details */}
            <Card className="border-slate-800 bg-slate-900/15 h-[300px] flex flex-col justify-between">
              <CardHeader className="pb-1">
                <span className="text-[9px] text-slate-500 uppercase tracking-widest font-semibold">
                  {selectedJunc ? "Selected Junction" : "Selected Corridor"}
                </span>
                <CardTitle className="text-sm font-bold text-slate-100 pt-1">
                  {selectedJunc ? selectedJunc.name : selectedHotspot?.name}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-slate-300 space-y-2.5 pb-4 flex-1 flex flex-col justify-between">
                {selectedJunc ? (
                  <div className="space-y-2">
                    <p className="text-slate-400">
                      Located at critical intersection matching coordinate cluster.
                    </p>
                    <div className="grid grid-cols-2 gap-2 text-[10px] bg-slate-950 p-2 rounded border border-slate-850">
                      <div>
                        <span className="text-slate-500">Intersection Score</span>
                        <p className="text-cyan-400 font-bold text-sm">{Math.round(selectedJunc.hotspotScore * 100)}%</p>
                      </div>
                      <div>
                        <span className="text-slate-500">Incident Count</span>
                        <p className="text-slate-200 font-bold text-sm">{selectedJunc.incidentCount}</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  selectedHotspot && (
                    <div className="space-y-2">
                      <p className="text-slate-400">
                        Top congestion triggers for this corridor segment:
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {selectedHotspot.topCauses.map((cause) => (
                          <Badge key={cause} severity={selectedHotspot.severity}>
                            {cause.replace(/_/g, " ")}
                          </Badge>
                        ))}
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[10px] bg-slate-950 p-2 rounded border border-slate-850 mt-2">
                        <div>
                          <span className="text-slate-500">Recurrence Rate</span>
                          <p className="text-amber-400 font-bold text-sm">{Math.round(selectedHotspot.recurrenceProbability * 100)}%</p>
                        </div>
                        <div>
                          <span className="text-slate-500">ML Priority Intensity</span>
                          <p className="text-slate-200 font-bold text-sm">{Math.round(selectedHotspot.hotspotScore * 100)}%</p>
                        </div>
                      </div>
                    </div>
                  )
                )}

                <div className="text-[10px] text-slate-500 italic mt-auto border-t border-slate-850 pt-2">
                  Coordinates: {selectedJunc ? `${selectedJunc.latitude}, ${selectedJunc.longitude}` : selectedHotspot ? `${selectedHotspot.latitude}, ${selectedHotspot.longitude}` : ""}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Interactive Map */}
          <Card className="border-slate-800 bg-slate-900/15 overflow-hidden flex flex-col h-[280px]">
            <CardHeader className="p-3 pb-1 border-b border-slate-850">
              <CardTitle className="text-xs font-semibold text-slate-400 flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5 text-amber-400" />
                Live Geospatial Distribution
              </CardTitle>
            </CardHeader>
            <div className="flex-1 relative">
              <GridSightMap
                className="absolute inset-0 h-full w-full rounded-none border-none"
                hotspots={hotspots}
                junctions={junctions}
                showHeatmap
                showHotspots
                showJunctions
                selectedId={activeSelectionId}
                selectedCorridor={selectedJunc ? selectedJunc.corridor : (selectedHotspot ? selectedHotspot.name : null)}
                onSelectHotspot={(hs) => {
                  setSelectedHotspot(hs);
                  setSelectedJunc(null);
                }}
                onSelectJunction={(j) => {
                  setSelectedJunc(j);
                  setSelectedHotspot(null);
                }}
              />
            </div>
          </Card>
        </div>
      </div>
      <VoiceAgent persona="police" />
    </AppShell>
  );
}
