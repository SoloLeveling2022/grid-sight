"use client";

import { useMemo, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { GridSightMap } from "@/components/map/gridsight-map";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getAllIncidents, getCorridors } from "@/data";
import type { Incident } from "@/types";
import { formatRelativeTime } from "@/lib/utils";
import { Search, MapPin, Activity, CheckCircle, ShieldAlert } from "lucide-react";
import { VoiceAgent } from "@/components/voice/voice-agent";

export default function IncidentExplorerPage() {
  const allIncidents = useMemo(() => getAllIncidents(), []);
  const corridors = useMemo(() => getCorridors(), []);

  // Filter States
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCorridor, setSelectedCorridor] = useState("all");
  const [selectedSeverity, setSelectedSeverity] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  
  // Selected incident details
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(allIncidents[0] || null);

  // Compute reactive incident lists
  const filteredIncidents = useMemo(() => {
    return allIncidents.filter((inc) => {
      // 1. Text Search matching
      const q = searchQuery.toLowerCase();
      const textMatch =
        !searchQuery ||
        inc.address.toLowerCase().includes(q) ||
        inc.eventCause.toLowerCase().includes(q) ||
        inc.policeStation.toLowerCase().includes(q) ||
        (inc.description?.toLowerCase().includes(q) ?? false);

      // 2. Corridor Filter
      const corridorMatch = selectedCorridor === "all" || inc.corridor === selectedCorridor;

      // 3. Severity Filter
      const severityMatch = selectedSeverity === "all" || inc.severity === selectedSeverity;

      // 4. Status Filter
      const statusMatch = selectedStatus === "all" || inc.status === selectedStatus;

      return textMatch && corridorMatch && severityMatch && statusMatch;
    });
  }, [allIncidents, searchQuery, selectedCorridor, selectedSeverity, selectedStatus]);

  // Compute counts
  const counts = useMemo(() => {
    const total = filteredIncidents.length;
    const active = filteredIncidents.filter((i) => i.status === "active").length;
    const resolved = filteredIncidents.filter((i) => i.status === "resolved" || i.status === "closed").length;
    const high = filteredIncidents.filter((i) => i.priority === "High").length;
    return { total, active, resolved, high };
  }, [filteredIncidents]);

  return (
    <AppShell title="Incident Explorer">
      {/* Metric Cards */}
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Matches Found", value: counts.total, icon: Search, color: "text-amber-400" },
          { label: "Active Incidents", value: counts.active, icon: Activity, color: "text-red-400" },
          { label: "Resolved / Closed", value: counts.resolved, icon: CheckCircle, color: "text-emerald-400" },
          { label: "High Priority", value: counts.high, icon: ShieldAlert, color: "text-orange-400" },
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

      {/* Filter and Content Grid */}
      <div className="grid gap-4 lg:grid-cols-12">
        {/* Main List Column (Left 8 cols) */}
        <div className="lg:col-span-8 flex flex-col gap-3">
          <Card className="border-slate-800 bg-slate-900/15">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-slate-200">Search & Filters</CardTitle>
              <CardDescription className="text-slate-500">Filter through real-time traffic events in Bengaluru</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Search bar */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search by cause, station, location description..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 pl-10 pr-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              {/* Advanced Dropdowns */}
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 text-xs">
                <div>
                  <label className="block text-[10px] text-slate-500 uppercase tracking-wider mb-1 font-semibold">Corridor</label>
                  <select
                    value={selectedCorridor}
                    onChange={(e) => setSelectedCorridor(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-slate-300 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  >
                    <option value="all">All Corridors</option>
                    {corridors.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] text-slate-500 uppercase tracking-wider mb-1 font-semibold">Severity</label>
                  <select
                    value={selectedSeverity}
                    onChange={(e) => setSelectedSeverity(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-slate-300 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  >
                    <option value="all">All Severities</option>
                    <option value="severe">Severe</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] text-slate-500 uppercase tracking-wider mb-1 font-semibold">Status</label>
                  <select
                    value={selectedStatus}
                    onChange={(e) => setSelectedStatus(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-slate-300 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  >
                    <option value="all">All Statuses</option>
                    <option value="active">Active</option>
                    <option value="closed">Closed</option>
                    <option value="resolved">Resolved</option>
                  </select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* List Results */}
          <Card id="incidents-feed-section" className="flex-1 border-slate-800 bg-slate-900/10 min-h-[400px]">
            <CardHeader className="pb-2 border-b border-slate-850">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-slate-200">Incident Feed</CardTitle>
                <span className="text-[10px] text-slate-500 font-semibold">{filteredIncidents.length} records matching</span>
              </div>
            </CardHeader>
            <CardContent className="p-0 max-h-[500px] overflow-y-auto divide-y divide-slate-850 scrollbar-thin">
              {filteredIncidents.length === 0 ? (
                <div className="text-center py-12 text-slate-500 text-sm">No incidents match your filter parameters.</div>
              ) : (
                filteredIncidents.map((inc) => (
                  <div
                    key={inc.id}
                    onClick={() => setSelectedIncident(inc)}
                    className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 cursor-pointer transition-colors ${
                      selectedIncident?.id === inc.id
                        ? "bg-amber-500/10 border-l-2 border-amber-500"
                        : "hover:bg-slate-900/30"
                    }`}
                  >
                    <div className="flex-1 space-y-1.5 min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[10px] font-bold text-slate-500 tracking-wide uppercase">{inc.id}</span>
                        <Badge severity={inc.severity}>{inc.eventCause.replace(/_/g, " ")}</Badge>
                        {inc.priority === "High" && (
                          <Badge className="bg-red-500/10 text-red-400 border-red-500/20">HIGH PRI</Badge>
                        )}
                        <span className="text-[10px] text-slate-600">{formatRelativeTime(inc.startDatetime)}</span>
                      </div>
                      <p className="text-xs font-semibold text-slate-200 truncate">{inc.address}</p>
                      <p className="text-[10px] text-slate-500 truncate">
                        Corridor: <strong className="text-slate-400">{inc.corridor}</strong> · Station: <strong className="text-slate-400">{inc.policeStation}</strong>
                      </p>
                    </div>
                    <div className="flex items-center sm:flex-col sm:items-end justify-between sm:justify-center gap-2">
                      <span className="text-[10px] text-slate-500 sm:text-right uppercase font-semibold">Impact</span>
                      <span className="text-sm font-bold text-amber-500">{Math.round(inc.impactScore * 100)}</span>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {/* Selected Sidebar Card (Right 4 cols) */}
        <div className="lg:col-span-4 flex flex-col gap-3">
          {selectedIncident ? (
            <>
              {/* Info Details */}
              <Card className="border-slate-800 bg-slate-900/15">
                <CardHeader className="pb-2 border-b border-slate-850">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{selectedIncident.id}</span>
                    <Badge severity={selectedIncident.severity}>{selectedIncident.status}</Badge>
                  </div>
                  <CardTitle className="text-sm font-bold text-slate-100 pt-1.5">
                    {selectedIncident.eventCause.replace(/_/g, " ")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-3 text-xs text-slate-300 space-y-3.5">
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-semibold">Location / Address</span>
                    <p className="text-slate-200 font-medium mt-0.5">{selectedIncident.address}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase font-semibold">Corridor</span>
                      <p className="text-slate-200 mt-0.5">{selectedIncident.corridor}</p>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase font-semibold">Police Station</span>
                      <p className="text-slate-200 mt-0.5">{selectedIncident.policeStation}</p>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase font-semibold">Zone</span>
                      <p className="text-slate-200 mt-0.5">{selectedIncident.zone || "N/A"}</p>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase font-semibold">Junction</span>
                      <p className="text-slate-200 mt-0.5">{selectedIncident.junction || "Non-junction"}</p>
                    </div>
                  </div>

                  <div className="rounded-lg bg-slate-950 p-2.5 border border-slate-850 flex items-center justify-between">
                    <div>
                      <span className="text-[9px] text-slate-500 uppercase font-semibold">ML Congestion Impact Score</span>
                      <p className="text-base font-bold text-amber-500">{Math.round(selectedIncident.impactScore * 100)}%</p>
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-500 uppercase font-semibold">Priority Class</span>
                      <p className="text-base font-bold text-slate-100">{selectedIncident.priority}</p>
                    </div>
                  </div>

                  {selectedIncident.description && (
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase font-semibold">Description</span>
                      <p className="text-slate-400 mt-0.5 italic">&quot;{selectedIncident.description}&quot;</p>
                    </div>
                  )}

                  {selectedIncident.resolutionMinutes && (
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase font-semibold">Resolution Time</span>
                      <p className="text-slate-200 mt-0.5">{selectedIncident.resolutionMinutes} minutes</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Map Location */}
              <Card id="incidents-map-section" className="border-slate-800 bg-slate-900/15 overflow-hidden flex flex-col flex-1 h-[250px]">
                <CardHeader className="p-3 pb-1.5 border-b border-slate-850">
                  <CardTitle className="text-xs font-semibold text-slate-400 flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5 text-amber-400" />
                    Geospatial Location
                  </CardTitle>
                </CardHeader>
                <div className="flex-1 relative min-h-[180px]">
                  <GridSightMap
                    className="absolute inset-0 h-full w-full rounded-none border-none"
                    incidents={[selectedIncident]}
                    showIncidents
                    showHeatmap={false}
                    showHotspots={false}
                    selectedId={selectedIncident.id}
                    selectedCorridor={selectedIncident.corridor}
                  />
                </div>
              </Card>
            </>
          ) : (
            <Card className="border-slate-800 bg-slate-900/15 flex items-center justify-center p-8 text-center text-slate-500 text-xs h-full">
              Select an incident to view details and map location
            </Card>
          )}
        </div>
      </div>
    </AppShell>
  );
}
