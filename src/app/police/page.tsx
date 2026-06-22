"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import "../bones/registry";
import { Skeleton } from "boneyard-js/react";
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertTriangle, Camera, CheckCircle2, ClipboardList, MapPin, Navigation, Search, Shield, Siren, Users, X } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { GridSightMap } from "@/components/map/gridsight-map";
import { VoiceAgent } from "@/components/voice/voice-agent";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useViolationPoliceStore, useVoiceStore } from "@/store";
import { toMapHotspots } from "@/data/violations";
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

function getMockEvidenceImage(vehicleType: string): string {
  const type = (vehicleType || "").toLowerCase();
  if (type.includes("truck") || type.includes("hgv") || type.includes("bus")) {
    return "https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?w=600&auto=format&fit=crop&q=80";
  }
  if (type.includes("two") || type.includes("bike") || type.includes("motorcycle") || type.includes("scooter")) {
    return "https://images.unsplash.com/photo-1485965120184-e220f721d03e?w=600&auto=format&fit=crop&q=80";
  }
  return "https://images.unsplash.com/photo-1506015391300-4802dc74de2e?w=600&auto=format&fit=crop&q=80";
}

function getImpactColor(delay: number = 0): string {
  if (delay >= 30) return "#ef4444"; // red
  if (delay >= 15) return "#f59e0b"; // amber
  return "#10b981"; // green
}

function LiveTrafficImpact({ selectedCase }: { selectedCase: ViolationCase }) {
  const [prediction, setPrediction] = useState<{
    congestionScore: number;
    predictedDelayMinutes: number;
    speedDropKmh: number;
    recommendation: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!selectedCase) return;

    let active = true;
    const getPrediction = async () => {
      setLoading(true);
      try {
        const hour = selectedCase.createdDatetime 
          ? new Date(selectedCase.createdDatetime).getHours() 
          : 12;

        const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
        const res = await fetch(`${apiBase}/api/ml/predict-impact`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            latitude: selectedCase.latitude,
            longitude: selectedCase.longitude,
            hour_of_day: isNaN(hour) ? 12 : hour,
            vehicle_type: selectedCase.vehicleType,
            violation_type: selectedCase.violationTypes?.[0] || "WRONG PARKING",
            cluster_size: 10,
          }),
        });

        if (!res.ok) throw new Error("Prediction API error");
        const data = await res.json();
        if (active) {
          setPrediction(data);
        }
      } catch (err) {
        console.error("Traffic delay prediction failed:", err);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    getPrediction();

    return () => {
      active = false;
    };
  }, [selectedCase]);

  if (loading) {
    return (
      <div className="mt-4 rounded-lg border border-slate-800 bg-slate-950 p-3 text-center text-xs text-slate-400">
        <div className="mx-auto mb-1 h-4 w-4 animate-spin rounded-full border border-amber-500 border-t-transparent" />
        Running Random Forest traffic impact inference...
      </div>
    );
  }

  if (!prediction) return null;

  return (
    <div className="mt-4 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
      <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
        <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">ML Traffic Congestion Impact</span>
        <Badge severity={prediction.predictedDelayMinutes > 35 ? "severe" : prediction.predictedDelayMinutes > 20 ? "high" : "medium"}>
          Score: {Math.round(prediction.congestionScore * 100)}
        </Badge>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
        <div>
          <span className="text-slate-500">Predicted Delay:</span>{" "}
          <span className="font-semibold text-slate-200">{prediction.predictedDelayMinutes} min</span>
        </div>
        <div>
          <span className="text-slate-500">Est. Speed Drop:</span>{" "}
          <span className="font-semibold text-slate-200">-{prediction.speedDropKmh} km/h</span>
        </div>
      </div>
      <p className="mt-2 text-[10px] leading-relaxed text-slate-400">
        <span className="font-semibold text-amber-300">Action:</span> {prediction.recommendation}
      </p>
    </div>
  );
}

function CctvSimulator({ activeHotspot, polygon }: { activeHotspot: any; polygon: [number, number][] }) {
  const [simStatus, setSimStatus] = useState<"idle" | "running" | "completed">("idle");
  const [simFrame, setSimFrame] = useState(0);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [caseId, setCaseId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const fetchCases = useViolationPoliceStore((s) => s.fetchCases);

  useEffect(() => {
    if (simStatus !== "running") return;

    let timer: any;
    const runFrame = async (frame: number) => {
      setLoading(true);
      try {
        const camId = `CAM-${activeHotspot.name.toUpperCase().replace(/\s/g, "-")}`;
        const res = await fetch("http://localhost:8000/api/violations/detect-parking", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            camera_id: camId,
            junction_name: activeHotspot.name,
            polygon: polygon,
            frame_index: frame,
            standing_threshold_seconds: 10.0,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          setVehicles(data.detected_vehicles);
          if (data.violation_triggered && data.violation_case_id) {
            setCaseId(data.violation_case_id);
            // Refresh queue list on the dashboard
            fetchCases();
          }
        }
      } catch (err) {
        console.error("Vision simulation frame error:", err);
      } finally {
        setLoading(false);
      }
    };

    runFrame(simFrame);

    timer = setInterval(() => {
      setSimFrame((f) => {
        const next = f + 1;
        if (next >= 5) {
          setSimStatus("completed");
          clearInterval(timer);
          return 5;
        }
        runFrame(next);
        return next;
      });
    }, 2500);

    return () => clearInterval(timer);
  }, [simStatus, simFrame, activeHotspot, polygon, fetchCases]);

  const startSimulation = () => {
    setSimStatus("running");
    setSimFrame(0);
    setVehicles([]);
    setCaseId(null);
  };

  const resetSimulation = () => {
    setSimStatus("idle");
    setSimFrame(0);
    setVehicles([]);
    setCaseId(null);
  };

  return (
    <div className="space-y-2 mt-2">
      {/* CCTV Screen aspect-ratio video */}
      <div className="aspect-video w-full rounded-lg bg-slate-950 border border-slate-900 relative overflow-hidden flex flex-col justify-between p-2">
        {/* Flashing AI Banner */}
        <div className="absolute top-2 left-2 flex items-center gap-1.5 rounded bg-slate-950/80 border border-slate-800 px-2 py-0.5 text-[9px] font-semibold tracking-wider text-slate-350 pointer-events-none z-10 font-mono">
          {simStatus === "running" ? (
            <>
              <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
              <span className="text-red-400">LIVE FEED</span>
            </>
          ) : (
            <>
              <span className="h-1.5 w-1.5 rounded-full bg-slate-500" />
              <span>CCTV MOCK</span>
            </>
          )}
        </div>

        {/* Video simulation frames */}
        {simStatus === "idle" ? (
          <div className="flex-1 flex flex-col items-center justify-center text-[10px] text-slate-500 space-y-1">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-slate-600">
              <path d="M23 7l-7 5 7 5V7z" />
              <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
            </svg>
            <span>CCTV camera online. Ready for AI inspection.</span>
          </div>
        ) : (
          <div className="flex-1 relative">
            {/* Draw bounding boxes */}
            {vehicles.map((v) => {
              const left = (v.bbox[0] / 640) * 100;
              const top = (v.bbox[1] / 360) * 100;
              const width = (v.bbox[2] / 640) * 100;
              const height = (v.bbox[3] / 360) * 100;
              const isInside = v.is_inside_polygon;

              return (
                <div
                  key={v.vehicle_number}
                  className={cn(
                    "absolute border-2 transition-all duration-300 rounded flex flex-col justify-between p-0.5",
                    isInside 
                      ? (v.stationary_seconds >= 10.0 ? "border-red-500 bg-red-500/10" : "border-amber-500 bg-amber-500/5")
                      : "border-emerald-500 bg-emerald-500/5"
                  )}
                  style={{
                    left: `${left}%`,
                    top: `${top}%`,
                    width: `${width}%`,
                    height: `${height}%`
                  }}
                >
                  <div className={cn(
                    "px-1 py-0.5 text-[7px] text-white font-bold font-mono rounded absolute -top-4 -left-0.5 flex items-center gap-1 shadow",
                    isInside 
                      ? (v.stationary_seconds >= 10.0 ? "bg-red-500" : "bg-amber-500")
                      : "bg-emerald-500"
                  )}>
                    <span>{v.vehicle_number}</span>
                    <span>{Math.round(v.confidence * 100)}%</span>
                  </div>
                  {isInside && v.stationary_seconds > 0 && (
                    <div className="text-[6px] text-white bg-slate-950/80 px-0.5 py-0.2 rounded font-mono font-bold self-start mt-auto">
                      Timer: {v.stationary_seconds}s
                    </div>
                  )}
                </div>
              );
            })}

            {/* Simulated background road schematic grid */}
            <div className="absolute inset-0 pointer-events-none opacity-20 border border-slate-900 border-dashed" />
          </div>
        )}

        {/* Info overlay footer */}
        <div className="flex justify-between items-center text-[8px] text-slate-500 font-mono border-t border-slate-900/60 pt-1 mt-auto">
          <span>{activeHotspot.name.toUpperCase()}</span>
          <span>Frame: {simFrame}/5</span>
        </div>
      </div>

      {/* Control Buttons */}
      <div className="flex gap-2">
        {simStatus === "idle" ? (
          <Button
            size="sm"
            onClick={startSimulation}
            className="w-full bg-blue-650 hover:bg-blue-650 text-slate-100 flex items-center justify-center gap-1 h-7 text-[10px]"
          >
            Start Camera Detection
          </Button>
        ) : (
          <div className="w-full space-y-1.5">
            {caseId && (
              <div className="rounded border border-red-500/35 bg-red-500/10 p-2 text-[10px] text-red-300 leading-normal animate-in zoom-in duration-200">
                <span className="font-bold">🚨 Auto-Generated Violation Ticket:</span>
                <p className="mt-0.5 font-mono text-[9px]">Case: {caseId} created inside MongoDB validation queue.</p>
              </div>
            )}
            <div className="flex gap-1.5">
              <Button
                size="sm"
                variant="ghost"
                onClick={resetSimulation}
                className="flex-1 text-[10px] text-slate-400 hover:bg-slate-800 cursor-pointer h-7"
              >
                Reset
              </Button>
              {simStatus === "running" && (
                <div className="flex-1 h-7 flex items-center justify-center text-[10px] text-slate-500 font-mono italic">
                  Analyzing Feed...
                </div>
              )}
              {simStatus === "completed" && (
                <div className="flex-1 h-7 flex items-center justify-center text-[10px] text-emerald-400 font-mono font-semibold">
                  Scan Completed
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function PoliceDashboardPage() {
  const router = useRouter();
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activePanel, setActivePanel] = useState<"cases" | "validation" | "offenders" | "devices">("cases");
  const [selectedCaseIds, setSelectedCaseIds] = useState<Set<string>>(new Set());
  const [batchAction, setBatchAction] = useState<ValidationStatus | null>(null);
  const [selectedTimeOfDay, setSelectedTimeOfDay] = useState<string | null>(null);
  const [selectedHotspot, setSelectedHotspot] = useState<any>(null);

  useEffect(() => {
    const handleSwitch = (e: Event) => {
      const tab = (e as CustomEvent).detail;
      if (tab === "cases" || tab === "validation" || tab === "offenders" || tab === "devices") {
        setActivePanel(tab);
      }
    };
    window.addEventListener("switch-police-tab", handleSwitch);
    return () => window.removeEventListener("switch-police-tab", handleSwitch);
  }, []);

  const meta = useViolationPoliceStore((s) => s.meta);
  const violationTypes = useViolationPoliceStore((s) => s.violationTypes);
  const stations = useViolationPoliceStore((s) => s.stations);
  const stationSummary = useViolationPoliceStore((s) => s.stationWorkload);
  const rawViolationDistribution = useViolationPoliceStore((s) => s.violationDistribution);
  const violationDistribution = useMemo(() => {
    return Object.entries(rawViolationDistribution)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, value]) => ({ name, value }));
  }, [rawViolationDistribution]);

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
    fetchCases,
    fetchHotspots,
    fetchPriorities,
    fetchRepeatOffenders,
    fetchDeviceProductivity,
    fetchMeta,
    fetchStations,
    fetchViolationTypes,
    fetchStationWorkload,
    fetchViolationDistribution,
    patrolRoute,
    isFetchingRoute,
    fetchPatrolRoute,
    clearPatrolRoute,
    drawingJunction,
    cameraZones,
    setCameraZone,
    setDrawingJunction,
  } = useViolationPoliceStore();

  // Fetch all data from FastAPI on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const sessionStr = localStorage.getItem("gridsight_session");
      if (!sessionStr) {
        router.push("/auth?redirect=/police");
        return;
      }
      try {
        const session = JSON.parse(sessionStr);
        const now = Date.now();
        if (now - session.createdAt >= 6 * 60 * 60 * 1000) {
          localStorage.removeItem("gridsight_session");
          router.push("/auth?redirect=/police");
          return;
        }
      } catch (e) {
        localStorage.removeItem("gridsight_session");
        router.push("/auth?redirect=/police");
        return;
      }

      useVoiceStore.getState().setPersona("police");

      // Fetch all data exclusively from FastAPI — no static stubs
      Promise.all([
        fetchHotspots(),
        fetchPriorities(),
        fetchRepeatOffenders(),
        fetchDeviceProductivity(),
        fetchMeta(),
        fetchStations(),
        fetchViolationTypes(),
        fetchStationWorkload(),
        fetchViolationDistribution(),
      ]).finally(() => {
        setIsLoading(false);
      });
    }
  }, [router, fetchHotspots, fetchPriorities, fetchRepeatOffenders, fetchDeviceProductivity, fetchMeta, fetchStations, fetchViolationTypes, fetchStationWorkload, fetchViolationDistribution]);

  // Debounced backend cases query search
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchCases({
        q: searchQuery || undefined,
        status: selectedStatus || undefined,
        station: selectedStation || undefined,
      });
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, selectedStatus, selectedStation, fetchCases]);

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
  const activeHotspot = useMemo(() => {
    if (!selectedHotspot) return null;
    return mapHotspots.find((h) => h.id === selectedHotspot.id) || selectedHotspot;
  }, [mapHotspots, selectedHotspot]);
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
            { label: "CSV cases analyzed", value: meta?.totalCases?.toLocaleString("en-IN") ?? "0", icon: ClipboardList, color: "text-amber-400" },
            { label: "Loaded demo sample", value: meta?.sampledCases?.toLocaleString("en-IN") ?? "0", icon: Camera, color: "text-blue-400" },
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
          <Card id="map-section" className="border-slate-800 bg-slate-900/15">
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-amber-400" />
                    Enforcement map
                  </CardTitle>
                  <CardDescription>Junction hotspots ranked by violation concentration and downstream congestion risk.</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Badge severity="high">Map-first workflow</Badge>
                  {patrolRoute ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-orange-500/40 text-orange-400 hover:bg-orange-500/10 text-[10px] font-semibold py-1 px-2.5 h-auto cursor-pointer"
                      onClick={clearPatrolRoute}
                    >
                      Clear Patrol Route
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      className="bg-orange-600 hover:bg-orange-700 text-slate-100 text-[10px] font-semibold py-1 px-2.5 h-auto cursor-pointer flex items-center gap-1 shadow-lg shadow-orange-950/40"
                      onClick={() => fetchPatrolRoute(5)}
                      disabled={isFetchingRoute}
                    >
                      {isFetchingRoute ? (
                        <>
                          <div className="h-2 w-2 animate-spin rounded-full border border-slate-100 border-t-transparent" />
                          Routing...
                        </>
                      ) : (
                        "Patrol Route"
                      )}
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className={cn("lg:col-span-2", patrolRoute ? "lg:col-span-2" : "lg:col-span-3")}>
                <GridSightMap
                  className="h-[300px] sm:h-[420px]"
                  hotspots={mapHotspots}
                  incidents={[]}
                  showHeatmap
                  showHotspots
                  showIncidents={false}
                  patrolRoute={patrolRoute}
                  onSelectHotspot={(hotspot) => {
                    setStationFilter(hotspot.corridor);
                    setSelectedHotspot(hotspot);
                  }}
                  filterTimeOfDay={selectedTimeOfDay}
                  filterStation={selectedStation}
                  filterViolationType={selectedViolationType}
                />
              </div>
              {patrolRoute && (
                <div className="flex flex-col gap-2 rounded-xl border border-slate-800 bg-slate-950/40 p-3 overflow-y-auto max-h-[300px] sm:max-h-[420px]">
                  <h4 className="text-xs font-bold text-orange-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Navigation className="h-3.5 w-3.5 rotate-45" />
                    Patrol Route
                  </h4>
                  <div className="space-y-2">
                    {patrolRoute.waypoints?.map((wp, idx) => (
                      <div key={idx} className="relative flex items-start gap-3 rounded-lg border border-slate-800 bg-[#070b14]/80 p-2.5 hover:border-orange-500/30 transition-all">
                        <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-orange-500/10 text-[10px] font-extrabold text-orange-400 border border-orange-500/25">
                          {idx + 1}
                        </div>
                        <div className="flex-1 space-y-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-[11px] font-bold text-slate-200 truncate">{wp.junction}</p>
                            <span className="shrink-0 rounded bg-slate-900 border border-slate-800 px-1 py-0.5 text-[8px] font-bold text-orange-400">
                              Score: {wp.score}
                            </span>
                          </div>
                          <p className="text-[9px] text-slate-400">Jurisdiction: {wp.policeStation}</p>
                          <div className="flex items-center gap-1.5 mt-1">
                            <span className="rounded bg-orange-950/40 px-1 py-0.5 text-[8px] font-semibold text-orange-300 capitalize border border-orange-900/30">
                              Action: {wp.suggestedAction}
                            </span>
                            <span className="rounded bg-slate-950 px-1 py-0.5 text-[8px] text-slate-500 border border-slate-900 text-center font-mono">
                              {wp.latitude.toFixed(4)}, {wp.longitude.toFixed(4)}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 rounded border border-orange-500/15 bg-orange-500/5 p-2 text-[9px] text-orange-300/85 leading-relaxed">
                    <strong>Optimization Factors:</strong> Route optimized using multi-factor TSP cost balancing road network distance, violation priority scores, and live congestion case loads.
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card id="cases-section">
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
              <div className="grid gap-2 lg:grid-cols-6">
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
                <select value={selectedTimeOfDay ?? ""} onChange={(e) => setSelectedTimeOfDay(e.target.value || null)} className="h-10 rounded-lg border border-slate-700 bg-slate-950 px-3 text-xs text-slate-300">
                  <option value="">All times of day</option>
                  <option value="morning">Peak Morning (08:00 - 11:00)</option>
                  <option value="midday">Midday (11:00 - 16:00)</option>
                  <option value="evening">Peak Evening (17:00 - 20:00)</option>
                  <option value="night">Night (20:00 - 08:00)</option>
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
                      {/* Violation Evidence Image Feed */}
                      <div className="mt-4 overflow-hidden rounded-lg border border-slate-800 bg-[#070b14] relative group aspect-video flex items-center justify-center">
                        {selectedCase.evidenceImageUrl ? (
                          <>
                            <img
                              src={selectedCase.evidenceImageUrl}
                              alt="Violation Evidence"
                              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105 cursor-zoom-in"
                              onClick={() => setZoomedImage(selectedCase.evidenceImageUrl ?? null)}
                            />
                            <div className="absolute top-2 left-2 rounded bg-emerald-500/10 border border-emerald-500/25 px-2 py-0.5 text-[9px] font-semibold text-emerald-400 pointer-events-none">
                              Live Camera Evidence
                            </div>
                            <div className="absolute bottom-2 right-2 rounded bg-slate-950/80 px-2 py-0.5 text-[9px] text-slate-400 border border-slate-800 pointer-events-none">
                              Click to zoom
                            </div>
                          </>
                        ) : (
                          <>
                            <img
                              src={getMockEvidenceImage(selectedCase.vehicleType)}
                              alt="Simulated Violation Evidence"
                              className="h-full w-full object-cover opacity-65 transition-transform duration-300 group-hover:scale-105 cursor-zoom-in"
                              onClick={() => setZoomedImage(getMockEvidenceImage(selectedCase.vehicleType))}
                            />
                            <div className="absolute inset-0 bg-slate-950/30 pointer-events-none" />
                            <div className="absolute top-2 left-2 rounded bg-amber-500/10 border border-amber-500/25 px-2 py-0.5 text-[9px] font-semibold text-amber-400 pointer-events-none">
                              Simulated Camera Feed
                            </div>
                            <div className="absolute bottom-2 right-2 rounded bg-slate-950/80 px-2 py-0.5 text-[9px] text-slate-400 border border-slate-800 pointer-events-none">
                              Click to zoom
                            </div>
                          </>
                        )}
                      </div>

                      <LiveTrafficImpact selectedCase={selectedCase} />
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
          {/* Hotspot & Priority Inspector Card */}
          {activeHotspot ? (
            <Card className="border-amber-500 bg-amber-950/20 backdrop-blur shadow-2xl relative overflow-hidden animate-in slide-in-from-right duration-300">
              <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-amber-500 to-red-500" />
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-sm font-bold text-slate-100 flex items-center gap-1.5">
                      <Siren className="h-4 w-4 text-amber-400 animate-pulse" />
                      Hotspot Inspector
                    </CardTitle>
                    <CardDescription className="text-[11px] text-slate-400">Centroid-based spatial cluster analysis</CardDescription>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0 rounded-full text-slate-500 hover:text-slate-300 hover:bg-slate-800 cursor-pointer flex items-center justify-center"
                    onClick={() => setSelectedHotspot(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3.5 text-xs">
                <div className="rounded-lg bg-slate-950/85 border border-slate-800 p-3 space-y-2">
                  <div className="flex items-baseline justify-between gap-2 border-b border-slate-800/85 pb-1.5">
                    <span className="font-bold text-slate-100 text-sm leading-tight">{activeHotspot.name}</span>
                    <Badge severity={activeHotspot.severity}>{activeHotspot.severity}</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-300 pt-0.5">
                    <p><span className="text-slate-500">Road:</span> {activeHotspot.affectedRoad || activeHotspot.name}</p>
                    <p><span className="text-slate-500">Peak Hours:</span> {activeHotspot.peakHours ?? "09:00, 18:00"}</p>
                    <p><span className="text-slate-500">Dominant Type:</span> {activeHotspot.dominantViolationType}</p>
                    <p><span className="text-slate-500">Repeat Freq:</span> {Math.round((activeHotspot.repeatFrequency ?? 0) * 100)}%</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Congestion Impact Quantification</span>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-lg bg-[#070b14]/75 border border-slate-800 p-2.5">
                      <span className="text-[9px] text-slate-500 uppercase tracking-wider">Expected Delay</span>
                      <p className="text-lg font-black text-slate-100 mt-0.5">{activeHotspot.expectedDelayMinutes?.toFixed(1) ?? 0} <span className="text-xs font-normal text-slate-400">mins</span></p>
                    </div>
                    <div className="rounded-lg bg-[#070b14]/75 border border-slate-800 p-2.5">
                      <span className="text-[9px] text-slate-500 uppercase tracking-wider">Speed Drop</span>
                      <p className="text-lg font-black text-red-400 mt-0.5">-{activeHotspot.estimatedSpeedDrop?.toFixed(1) ?? 0} <span className="text-xs font-normal text-slate-500">km/h</span></p>
                    </div>
                  </div>
                  <div className="rounded-lg bg-[#070b14]/75 border border-slate-800 p-2.5 space-y-1.5">
                    <div className="flex justify-between text-[10px]">
                      <span className="text-slate-500">Congestion Severity Score</span>
                      <span className="font-semibold text-slate-200">{Math.round((activeHotspot.congestionScore ?? 0) * 100)} / 100</span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden">
                      <div 
                        className="h-full rounded-full transition-all duration-500" 
                        style={{ 
                          width: `${Math.round((activeHotspot.congestionScore ?? 0) * 100)}%`,
                          backgroundColor: getImpactColor(activeHotspot.expectedDelayMinutes) 
                        }} 
                      />
                    </div>
                    <div className="flex justify-between text-[9px] text-slate-500 font-mono">
                      <span>Source: {activeHotspot.evidenceSource}</span>
                      <span>Conf: {Math.round((activeHotspot.confidence ?? 0.85) * 100)}%</span>
                    </div>
                    {activeHotspot.nearbySensitivePlaces && activeHotspot.nearbySensitivePlaces.length > 0 && (
                      <div className="border-t border-slate-800/80 pt-1.5 mt-1.5">
                        <span className="text-[9px] text-slate-500 uppercase">Sensitive Zones:</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {activeHotspot.nearbySensitivePlaces.map((place: string) => (
                            <span key={place} className="rounded bg-slate-900 border border-slate-800 px-1.5 py-0.5 text-[9px] text-slate-450 font-semibold capitalize">{place}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* CCTV Camera Feed Simulator & Zone Setup */}
                <div id="cctv-section" className="border-t border-slate-800/80 pt-3 space-y-2">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">CCTV AI Camera & Zone Setup</span>
                  <div className="rounded-lg border border-slate-800 bg-[#070b14]/50 p-2.5 space-y-2 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">AI tracking zone:</span>
                      {cameraZones[activeHotspot.name] && cameraZones[activeHotspot.name].length >= 3 ? (
                        <span className="text-emerald-400 font-semibold text-[10px] flex items-center gap-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          Configured ({cameraZones[activeHotspot.name].length} pts)
                        </span>
                      ) : (
                        <span className="text-amber-400 font-semibold text-[10px]">Not defined</span>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setDrawingJunction(activeHotspot.name);
                        }}
                        className="flex-1 text-[10px] border-slate-700 bg-slate-900 hover:bg-slate-800 cursor-pointer h-7"
                      >
                        {cameraZones[activeHotspot.name] ? "Re-draw camera Zone" : "Draw Camera Zone"}
                      </Button>
                      {cameraZones[activeHotspot.name] && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setCameraZone(activeHotspot.name, []);
                          }}
                          className="text-[10px] text-red-400 hover:bg-red-500/10 cursor-pointer h-7"
                        >
                          Clear
                        </Button>
                      )}
                    </div>

                    {/* Camera simulation panel */}
                    <div className="pt-2 border-t border-slate-900">
                      {cameraZones[activeHotspot.name] && cameraZones[activeHotspot.name].length >= 3 ? (
                        <CctvSimulator activeHotspot={activeHotspot} polygon={cameraZones[activeHotspot.name]} />
                      ) : (
                        <div className="text-[10px] text-slate-500 py-3 text-center leading-normal font-sans">
                          💡 Draw a no-parking zone polygon on the map first to enable the live camera AI verification console.
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Simulated Before/After Outcome Feedback Loop */}
                <div className="border-t border-slate-800/80 pt-3 space-y-2">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Enforcement Feedback Loop</span>
                  
                  {!activeHotspot.patrolDispatched && !activeHotspot.actionTaken && !activeHotspot.caseClosed && (
                    <div className="space-y-2">
                      <p className="text-[11px] text-slate-400">No active patrol has been assigned to this spatial cluster hotspot.</p>
                      <Button 
                        onClick={() => useViolationPoliceStore.getState().dispatchPatrol(activeHotspot.name)} 
                        className="w-full bg-amber-600 hover:bg-amber-700 text-slate-100 flex items-center justify-center gap-1.5 shadow-lg shadow-amber-950/20"
                      >
                        <Siren className="h-4 w-4 animate-bounce" />
                        Dispatch Patrol Unit
                      </Button>
                    </div>
                  )}

                  {activeHotspot.patrolDispatched && !activeHotspot.actionTaken && !activeHotspot.caseClosed && (
                    <div className="rounded-lg border border-amber-500/35 bg-amber-500/10 p-3 space-y-3 font-sans">
                      <div className="flex items-center gap-2">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                        </span>
                        <span className="text-[11px] font-bold text-amber-300">Patrol unit dispatched (en route)</span>
                      </div>
                      <p className="text-[10px] text-slate-300 leading-normal">Officer is navigating to coordinates. Confirm physical intervention once gridlock is cleared.</p>
                      <Button 
                        size="sm"
                        onClick={() => useViolationPoliceStore.getState().takeAction(activeHotspot.name)}
                        className="w-full bg-amber-500 text-slate-950 font-bold hover:bg-amber-400"
                      >
                        ✓ Confirm Action Taken
                      </Button>
                    </div>
                  )}

                  {activeHotspot.patrolDispatched && activeHotspot.actionTaken && !activeHotspot.caseClosed && (
                    <div className="rounded-lg border border-orange-500/35 bg-orange-500/15 p-3 space-y-3 font-sans">
                      <div className="flex items-center gap-2">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span>
                        </span>
                        <span className="text-[11px] font-bold text-orange-300">Action taken: clearing corridor</span>
                      </div>
                      <p className="text-[10px] text-slate-300 leading-normal">Citations logged & obstructing vehicle towed. Close case to release downstream flow sensors.</p>
                      <Button 
                        size="sm"
                        onClick={() => useViolationPoliceStore.getState().closeCase(activeHotspot.name)}
                        className="w-full bg-red-650 text-slate-100 hover:bg-red-500"
                      >
                        🔒 Close Case & Recalculate
                      </Button>
                    </div>
                  )}

                  {activeHotspot.caseClosed && (
                    <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 space-y-2.5 animate-in zoom-in duration-200 font-sans">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                        <span className="text-[11px] font-bold text-emerald-400">Case Resolved & Closed</span>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2 pt-1 border-t border-emerald-500/20 text-[11px]">
                        <div>
                          <span className="text-slate-400 font-normal">Delay reduction:</span>
                          <p className="font-bold text-emerald-400 font-mono">-{activeHotspot.expectedDelayReduction?.toFixed(1) ?? 0} mins</p>
                        </div>
                        <div>
                          <span className="text-slate-400 font-normal">Hotspot score:</span>
                          <p className="font-bold text-emerald-400 font-mono">Reduced (-{activeHotspot.scoreReduced})</p>
                        </div>
                      </div>

                      <Button 
                        size="sm"
                        variant="ghost"
                        onClick={() => useViolationPoliceStore.getState().resetSimulation(activeHotspot.name)}
                        className="w-full h-7 text-[10px] text-slate-400 hover:text-slate-200 hover:bg-slate-800 mt-1 cursor-pointer"
                      >
                        Reset Simulation
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-slate-850 bg-slate-900/10 p-4 text-center">
              <CardDescription className="text-xs text-slate-500">
                Select a hotspot on the map or click a priority item below to inspect spatial parameters, congestion impact quantification, and trigger the patrol dispatch feedback loop.
              </CardDescription>
            </Card>
          )}

          <Card id="performance-section" className="border-amber-500/20 bg-amber-500/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Siren className="h-4 w-4 text-amber-400 animate-pulse" />
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
                    const hs = mapHotspots.find((h) => h.name === item.junction);
                    if (hs) {
                      setSelectedHotspot(hs);
                    }
                  }}
                  className={cn(
                    "w-full rounded-lg border p-3 text-left transition-colors hover:border-amber-500/40 hover:bg-amber-500/10",
                    activeHotspot?.name === item.junction 
                      ? "border-amber-500 bg-amber-500/10" 
                      : "border-slate-800 bg-slate-950/50"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="flex items-baseline gap-2 font-mono">
                        <p className="text-sm font-semibold text-slate-100">#{idx + 1} {item.junction}</p>
                        <Badge severity={item.priority} className="text-xs">{item.priority}</Badge>
                      </div>
                      <p className="text-xs text-slate-500">{item.policeStation}</p>
                      <div className="mt-2 grid gap-1 text-[10px] text-slate-400 font-sans">
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


      {/* Lightbox Zoom Overlay Modal */}
      {zoomedImage && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setZoomedImage(null)}
        >
          <button
            onClick={() => setZoomedImage(null)}
            className="absolute top-4 right-4 rounded-lg bg-slate-900 border border-slate-800 p-2 text-slate-400 hover:text-slate-200 cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
          <div className="max-w-[90vw] max-h-[85vh] relative overflow-hidden rounded-xl border border-slate-800 bg-[#070b14]" onClick={(e) => e.stopPropagation()}>
            <img 
              src={zoomedImage} 
              alt="High Resolution Evidence View" 
              className="max-w-full max-h-[80vh] object-contain"
            />
            <div className="bg-[#0c1220] border-t border-slate-800 p-3 text-center text-slate-400 text-xs">
              Camera Feed Verification Console · Inspecting license plate details
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
