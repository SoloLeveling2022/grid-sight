"use client";

import { useEffect, useMemo, useState } from "react";
import "../bones/registry";
import { Skeleton } from "boneyard-js/react";
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertTriangle, Camera, CheckCircle2, ClipboardList, MapPin, Search, Shield, Siren, Users } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { GridSightMap } from "@/components/map/gridsight-map";
import { VoiceAgent } from "@/components/voice/voice-agent";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useViolationPoliceStore, useVoiceStore } from "@/store";
import {
  getStationList,
  getStationViolationSummary,
  getViolationMeta,
  getViolationTypeDistribution,
  getViolationTypes,
  toMapHotspots,
} from "@/data/violations";
import type { ValidationStatus, ViolationCase } from "@/types";
import { cn } from "@/lib/utils";

const statusOptions: Array<ValidationStatus | "all"> = ["all", "pending", "processing", "approved", "rejected", "duplicate"];
const chartColors = ["#f59e0b", "#f97316", "#ef4444", "#22c55e", "#38bdf8", "#a78bfa"];

function formatDate(value: string | null) {
  if (!value) return "Not available";
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function evidenceLabel(c: ViolationCase) {
  return `${c.deviceId} / ${c.centerCode}`;
}

export default function PoliceDashboardPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [activePanel, setActivePanel] = useState<"cases" | "validation" | "offenders" | "devices">("cases");
  const [selectedCaseIds, setSelectedCaseIds] = useState<Set<string>>(new Set());
  const [batchAction, setBatchAction] = useState<ValidationStatus | null>(null);

  useEffect(() => {
    useVoiceStore.getState().setPersona("police");
    const timer = setTimeout(() => setIsLoading(false), 800);
    return () => clearTimeout(timer);
  }, []);

  const meta = getViolationMeta();
  const violationTypes = getViolationTypes();
  const stations = getStationList();
  const stationSummary = getStationViolationSummary().slice(0, 8);
  const violationDistribution = Object.entries(getViolationTypeDistribution())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([name, value]) => ({ name, value }));

  const {
    cases,
    junctions,
    repeatOffenders,
    deviceProductivity,
    enforcementPriorities,
    searchQuery,
    selectedViolationType,
    selectedStation,
    selectedJunction,
    selectedStatus,
    selectedCaseId,
    setSearchQuery,
    setViolationTypeFilter,
    setStationFilter,
    setJunctionFilter,
    setStatusFilter,
    selectCase,
    approveCase,
    rejectCase,
    flagDuplicate,
  } = useViolationPoliceStore();

  const filteredCases = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return cases.filter((c) => {
      const matchesQuery =
        !q ||
        [c.vehicleNumber, c.updatedVehicleNumber ?? "", c.location, c.policeStation, c.junctionName, ...c.violationTypes]
          .join(" ")
          .toLowerCase()
          .includes(q);
      return (
        matchesQuery &&
        (!selectedViolationType || c.violationTypes.includes(selectedViolationType)) &&
        (!selectedStation || c.policeStation === selectedStation) &&
        (!selectedJunction || c.junctionName === selectedJunction) &&
        (!selectedStatus || c.validationStatus === selectedStatus)
      );
    });
  }, [cases, searchQuery, selectedViolationType, selectedStation, selectedJunction, selectedStatus]);

  const selectedCase = cases.find((c) => c.id === selectedCaseId) ?? filteredCases[0] ?? null;
  const queueCases = filteredCases.filter((c) => c.validationStatus !== "approved").slice(0, 10);
  const mapHotspots = toMapHotspots(junctions);
  const uniqueJunctionNames = Array.from(new Set(junctions.slice(0, 30).map((j) => j.junctionName)));

  const approvedCount = cases.filter((c) => c.validationStatus === "approved").length;
  const openCount = cases.filter((c) => c.validationStatus !== "approved").length;
  const duplicateCount = cases.filter((c) => c.validationStatus === "duplicate").length;

  const handleBatchAction = (status: ValidationStatus) => {
    selectedCaseIds.forEach((id) => {
      if (status === "approved") approveCase(id);
      else if (status === "rejected") rejectCase(id);
      else if (status === "duplicate") flagDuplicate(id);
    });
    setSelectedCaseIds(new Set());
    setBatchAction(null);
  };

  const toggleCaseSelection = (id: string) => {
    const newSet = new Set(selectedCaseIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedCaseIds(newSet);
  };

  const selectAllFiltered = () => {
    setSelectedCaseIds(new Set(filteredCases.map((c) => c.id)));
  };

  const clearSelection = () => {
    setSelectedCaseIds(new Set());
  };

  return (
    <AppShell title="Police Violation Intelligence">
      <Skeleton name="police-violation-kpis" loading={isLoading}>
        <div className="mb-4 grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
          {[
            { label: "CSV cases analyzed", value: meta.totalCases.toLocaleString("en-IN"), icon: ClipboardList, color: "text-amber-400" },
            { label: "Loaded demo sample", value: meta.sampledCases.toLocaleString("en-IN"), icon: Camera, color: "text-blue-400" },
            { label: "Open validation", value: openCount.toLocaleString("en-IN"), icon: AlertTriangle, color: "text-orange-400" },
            { label: "Approved cases", value: approvedCount.toLocaleString("en-IN"), icon: CheckCircle2, color: "text-emerald-400" },
            { label: "Repeat plates", value: repeatOffenders.length.toLocaleString("en-IN"), icon: Users, color: "text-red-400" },
          ].map(({ label, value, icon: Icon, color }, idx) => (
            <Card key={label} className={cn("border-slate-800 bg-slate-900/20", idx === 4 && "col-span-2 sm:col-span-1 lg:col-span-1")}>
              <CardContent className="flex items-center gap-3 p-4">
                <div className="rounded-lg border border-slate-800 bg-slate-950 p-2">
                  <Icon className={cn("h-5 w-5", color)} />
                </div>
                <div>
                  <p className="text-xl font-bold text-slate-100">{value}</p>
                  <p className="text-[10px] uppercase tracking-wider text-slate-500">{label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </Skeleton>

      <div className="grid gap-4 lg:grid-cols-12">
        <section className="space-y-4 lg:col-span-8">
          <Card className="border-slate-800 bg-slate-900/15">
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-amber-400" />
                    Enforcement map
                  </CardTitle>
                  <CardDescription>Junction hotspots ranked by violation concentration and downstream congestion risk.</CardDescription>
                </div>
                <Badge severity="high">Map-first workflow</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <GridSightMap
                className="h-[300px] sm:h-[420px]"
                hotspots={mapHotspots}
                incidents={[]}
                showHeatmap
                showHotspots
                showIncidents={false}
                onSelectHotspot={(hotspot) => setStationFilter(hotspot.corridor)}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle>Violation intake and case management</CardTitle>
                  <CardDescription>Search plates, filter stations, inspect case evidence, and move validation status locally.</CardDescription>
                </div>
                <div className="flex rounded-lg border border-slate-800 bg-slate-950 p-0.5">
                  {(["cases", "validation", "offenders", "devices"] as const).map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setActivePanel(tab)}
                      className={cn(
                        "rounded-md px-2.5 py-1 text-[10px] font-semibold capitalize transition-colors",
                        activePanel === tab ? "bg-amber-500 text-slate-950" : "text-slate-400 hover:text-slate-200"
                      )}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-2 lg:grid-cols-5">
                <label className="relative lg:col-span-2">
                  <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                  <input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search plate, station, junction, violation"
                    className="h-10 w-full rounded-lg border border-slate-700 bg-slate-950 pl-9 pr-3 text-sm text-slate-200 outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </label>
                <select value={selectedViolationType ?? ""} onChange={(e) => setViolationTypeFilter(e.target.value || null)} className="h-10 rounded-lg border border-slate-700 bg-slate-950 px-3 text-xs text-slate-300">
                  <option value="">All violation types</option>
                  {violationTypes.map((type) => <option key={type} value={type}>{type}</option>)}
                </select>
                <select value={selectedStation ?? ""} onChange={(e) => setStationFilter(e.target.value || null)} className="h-10 rounded-lg border border-slate-700 bg-slate-950 px-3 text-xs text-slate-300">
                  <option value="">All stations</option>
                  {stations.map((station) => <option key={station} value={station}>{station}</option>)}
                </select>
                <select value={selectedStatus ?? "all"} onChange={(e) => setStatusFilter(e.target.value === "all" ? null : (e.target.value as ValidationStatus))} className="h-10 rounded-lg border border-slate-700 bg-slate-950 px-3 text-xs text-slate-300">
                  {statusOptions.map((status) => <option key={status} value={status}>{status}</option>)}
                </select>
              </div>

              {activePanel === "cases" && (
                <div className="grid gap-3 lg:grid-cols-2">
                  <div className="max-h-[430px] overflow-y-auto rounded-lg border border-slate-800">
                    {filteredCases.slice(0, 40).map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => selectCase(c.id)}
                        className={cn(
                          "block w-full border-b border-slate-800 p-3 text-left transition-colors last:border-b-0 hover:bg-slate-800/40",
                          selectedCase?.id === c.id && "bg-amber-500/10"
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-sm font-semibold text-slate-100">{c.updatedVehicleNumber ?? c.vehicleNumber}</span>
                          <Badge>{c.validationStatus}</Badge>
                        </div>
                        <p className="mt-1 text-xs text-slate-400">{c.policeStation} / {c.junctionName}</p>
                        <p className="mt-1 line-clamp-1 text-[11px] text-slate-500">{c.violationTypes.join(", ")}</p>
                      </button>
                    ))}
                  </div>
                  {selectedCase && (
                    <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-mono text-lg font-bold text-slate-100">{selectedCase.updatedVehicleNumber ?? selectedCase.vehicleNumber}</p>
                          <p className="text-xs text-slate-500">{selectedCase.vehicleType} / evidence {evidenceLabel(selectedCase)}</p>
                        </div>
                        <Badge severity={selectedCase.validationStatus === "approved" ? "low" : "high"}>{selectedCase.validationStatus}</Badge>
                      </div>
                      <div className="mt-4 grid gap-3 text-xs text-slate-300 sm:grid-cols-2">
                        <p><span className="text-slate-500">Station:</span> {selectedCase.policeStation}</p>
                        <p><span className="text-slate-500">Junction:</span> {selectedCase.junctionName}</p>
                        <p><span className="text-slate-500">Captured:</span> {formatDate(selectedCase.createdDatetime)}</p>
                        <p><span className="text-slate-500">SCITA:</span> {selectedCase.dataSentToScita ? "sent" : "not sent"}</p>
                      </div>
                      <p className="mt-3 text-xs text-slate-500">{selectedCase.location}</p>
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {selectedCase.violationTypes.map((type) => <Badge key={type} severity="medium">{type}</Badge>)}
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Button size="sm" onClick={() => approveCase(selectedCase.id)}>Approve</Button>
                        <Button size="sm" variant="outline" onClick={() => rejectCase(selectedCase.id)}>Reject</Button>
                        <Button size="sm" variant="secondary" onClick={() => flagDuplicate(selectedCase.id)}>Duplicate</Button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activePanel === "validation" && (
                <div className="space-y-3">
                  {selectedCaseIds.size > 0 && (
                    <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-amber-300">{selectedCaseIds.size} case{selectedCaseIds.size !== 1 ? "s" : ""} selected</p>
                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" onClick={() => handleBatchAction("approved")} className="bg-emerald-600 hover:bg-emerald-700">Approve All</Button>
                          <Button size="sm" onClick={() => handleBatchAction("rejected")} variant="outline">Reject All</Button>
                          <Button size="sm" onClick={() => handleBatchAction("duplicate")} variant="secondary">Mark Duplicates</Button>
                          <Button size="sm" variant="outline" onClick={clearSelection}>Clear</Button>
                        </div>
                      </div>
                    </div>
                  )}
                  {queueCases.length > 0 && selectedCaseIds.size === 0 && (
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={selectAllFiltered}>Select All {queueCases.length}</Button>
                    </div>
                  )}
                  {queueCases.map((c) => (
                    <div key={c.id} className={cn("flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3 transition-colors", selectedCaseIds.has(c.id) ? "border-amber-500 bg-amber-500/20" : "border-slate-800 bg-slate-950/40 hover:border-slate-700")}>
                      <input
                        type="checkbox"
                        checked={selectedCaseIds.has(c.id)}
                        onChange={() => toggleCaseSelection(c.id)}
                        className="h-4 w-4 cursor-pointer rounded border-slate-600 bg-slate-900"
                      />
                      <div className="flex-1">
                        <p className="font-mono text-sm font-semibold text-slate-100">{c.vehicleNumber}</p>
                        <p className="text-xs text-slate-500">{c.violationTypes.slice(0, 2).join(", ")} / {c.policeStation}</p>
                        <p className="mt-1 text-[10px] text-slate-600">{formatDate(c.createdDatetime)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge>{c.validationStatus}</Badge>
                        <Button size="sm" onClick={() => approveCase(c.id)}>Approve</Button>
                        <Button size="sm" variant="outline" onClick={() => rejectCase(c.id)}>Reject</Button>
                      </div>
                    </div>
                  ))}
                  {queueCases.length === 0 && <p className="rounded-lg border border-slate-800 bg-slate-950/40 p-3 text-center text-sm text-slate-500">All cases in the queue are approved. Great work!</p>}
                </div>
              )}

              {activePanel === "offenders" && (
                <div className="grid gap-2 md:grid-cols-2">
                  {repeatOffenders.slice(0, 12).map((offender) => (
                    <button
                      key={offender.vehicleNumber}
                      type="button"
                      onClick={() => {
                        setSearchQuery(offender.vehicleNumber);
                        setActivePanel("cases");
                      }}
                      className="rounded-lg border border-slate-800 bg-slate-950/40 p-3 text-left transition-colors hover:border-red-500/40 hover:bg-red-500/5"
                    >
                      <div className="flex items-center justify-between">
                        <p className="font-mono text-sm font-bold text-slate-100">{offender.vehicleNumber}</p>
                        <Badge severity={offender.enforcementScore > 70 ? "severe" : offender.enforcementScore > 40 ? "high" : "medium"}>{offender.enforcementScore}</Badge>
                      </div>
                      <p className="mt-2 text-xs text-slate-500">{offender.caseCount} violations / {offender.policeStations.length} station{offender.policeStations.length !== 1 ? "s" : ""}</p>
                      <div className="mt-2 space-y-1">
                        <p className="line-clamp-1 text-[11px] text-slate-400">Types: {offender.violationTypes.slice(0, 3).join(", ")}</p>
                        <p className="text-[10px] text-slate-600">Last seen: {offender.lastSeen.split("T")[0]}</p>
                        <p className="text-[10px] text-slate-600">Hotspot: {offender.mostFrequentJunction}</p>
                      </div>
                      <div className="mt-2 pt-2 border-t border-slate-800">
                        <p className="text-[10px] uppercase tracking-wider text-amber-400">Pattern: Repeat offender × {offender.policeStations.length} jurisdictions</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {activePanel === "devices" && (
                <div className="grid gap-2 md:grid-cols-2">
                  {deviceProductivity.slice(0, 12).map((device) => (
                    <button
                      key={device.deviceId}
                      type="button"
                      onClick={() => {
                        setStationFilter(device.mostCommonStation);
                        setActivePanel("cases");
                      }}
                      className="rounded-lg border border-slate-800 bg-slate-950/40 p-3 text-left transition-colors hover:border-blue-500/40 hover:bg-blue-500/5"
                    >
                      <div className="flex items-center justify-between">
                        <p className="font-mono text-sm font-bold text-slate-100">{device.deviceId}</p>
                        <Badge severity={device.approvalRate > 80 ? "low" : device.approvalRate > 60 ? "medium" : "high"}>{Math.round(device.approvalRate)}%</Badge>
                      </div>
                      <p className="mt-2 text-xs text-slate-500">{device.totalCasesCaptured.toLocaleString("en-IN")} captures / {device.mostCommonStation}</p>
                      <div className="mt-2 grid grid-cols-2 gap-1 text-[10px] text-slate-400">
                        <p>✅ Approved: {device.approvedCases}</p>
                        <p>❌ Rejected: {device.rejectedCases}</p>
                        <p>⏳ Pending: {device.pendingCases}</p>
                        <p>📍 {device.mostCommonViolation}</p>
                      </div>
                      <p className="mt-2 pt-2 border-t border-slate-800 text-[10px] text-slate-600">Last active: {device.lastActiveDate.split("T")[0]}</p>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        <aside className="space-y-4 lg:col-span-4">
          <Card className="border-amber-500/20 bg-amber-500/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Siren className="h-4 w-4 text-amber-400" />
                Enforcement priority
              </CardTitle>
              <CardDescription>Ranked by violation count, open load, repeat patterns, and sensitive-zone flags. Lower score = higher priority for patrol.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {enforcementPriorities.slice(0, 10).map((item, idx) => (
                <button
                  key={`${item.junction}-${item.policeStation}`}
                  type="button"
                  onClick={() => {
                    setJunctionFilter(item.junction);
                    setStationFilter(item.policeStation);
                    setActivePanel("cases");
                  }}
                  className="w-full rounded-lg border border-slate-800 bg-slate-950/50 p-3 text-left transition-colors hover:border-amber-500/40 hover:bg-amber-500/10"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="flex items-baseline gap-2">
                        <p className="text-sm font-semibold text-slate-100">#{idx + 1} {item.junction}</p>
                        <Badge severity={item.priority} className="text-xs">{item.priority}</Badge>
                      </div>
                      <p className="text-xs text-slate-500">{item.policeStation}</p>
                      <div className="mt-2 grid gap-1 text-[10px] text-slate-400">
                        <p>📍 {item.openCases} open cases | 🔁 {item.repeatOffenderCount} repeat plates</p>
                        {item.sensitiveZoneFlags.length > 0 && <p>⚠️ Sensitive: {item.sensitiveZoneFlags.join(", ")}</p>}
                        <p>💡 Action: <span className="font-semibold text-amber-300">{item.suggestedAction === "tow" ? "Deploy tow truck" : item.suggestedAction === "patrol" ? "Increase patrol" : item.suggestedAction === "camera" ? "Install traffic camera" : "Monitor"}</span></p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <Badge className="whitespace-nowrap">{item.score}</Badge>
                      <p className="text-[10px] text-slate-600">score</p>
                    </div>
                  </div>
                </button>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Station workload</CardTitle>
              <CardDescription>Top stations in the loaded frontend sample.</CardDescription>
            </CardHeader>
            <CardContent className="h-56">
              {!isLoading ? (
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                  <BarChart data={stationSummary} layout="vertical" margin={{ left: 12, right: 12 }}>
                    <XAxis type="number" hide />
                    <YAxis dataKey="policeStation" type="category" width={88} tick={{ fill: "#94a3b8", fontSize: 10 }} />
                    <Tooltip cursor={{ fill: "#1e293b55" }} contentStyle={{ background: "#020617", border: "1px solid #334155", color: "#e2e8f0" }} />
                    <Bar dataKey="totalCases" radius={[0, 6, 6, 0]} fill="#f59e0b" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full w-full bg-slate-900/10 rounded-lg flex items-center justify-center text-xs text-slate-500 animate-pulse border border-slate-800/40">
                  Loading workload...
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Violation mix</CardTitle>
              <CardDescription>Classification groups from the CSV violation_type array.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-[150px_1fr]">
              <div className="h-36">
                {!isLoading ? (
                  <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                    <PieChart>
                      <Pie data={violationDistribution} dataKey="value" nameKey="name" innerRadius={34} outerRadius={62} paddingAngle={2}>
                        {violationDistribution.map((entry, index) => <Cell key={entry.name} fill={chartColors[index % chartColors.length]} />)}
                      </Pie>
                      <Tooltip contentStyle={{ background: "#020617", border: "1px solid #334155", color: "#e2e8f0" }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full w-full bg-slate-900/10 rounded-lg flex items-center justify-center text-xs text-slate-500 animate-pulse border border-slate-800/40">
                    Loading...
                  </div>
                )}
              </div>
              <div className="space-y-2">
                {violationDistribution.map((entry, index) => (
                  <div key={entry.name} className="flex items-center justify-between gap-2 text-xs">
                    <span className="line-clamp-1 text-slate-300"><MapPin className="mr-1 inline h-3 w-3" style={{ color: chartColors[index % chartColors.length] }} />{entry.name}</span>
                    <span className="font-semibold text-slate-100">{entry.value}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Focused junction filter</CardTitle>
              <CardDescription>Quickly narrow case intake by high-volume junction.</CardDescription>
            </CardHeader>
            <CardContent>
              <select value={selectedJunction ?? ""} onChange={(e) => setJunctionFilter(e.target.value || null)} className="h-10 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-xs text-slate-300">
                <option value="">All junctions</option>
                {uniqueJunctionNames.map((junction, idx) => <option key={`junction-${idx}-${junction}`} value={junction}>{junction}</option>)}
              </select>
              <p className="mt-3 text-xs text-slate-500">{filteredCases.length.toLocaleString("en-IN")} cases match the current filters. Duplicates in sample: {duplicateCount.toLocaleString("en-IN")}.</p>
            </CardContent>
          </Card>
        </aside>
      </div>

      <VoiceAgent persona="police" />
    </AppShell>
  );
}
