"use client";

import { useEffect, useMemo, useState } from "react";
import "../bones/registry";
import { Skeleton } from "boneyard-js/react";
import { AlertTriangle, Clock, MapPin, Search, TrendingUp } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { GridSightMap } from "@/components/map/gridsight-map";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useViolationPoliceStore } from "@/store";
import { toMapHotspots } from "@/data/violations";
import type { ViolationCase } from "@/types";
import { cn } from "@/lib/utils";

export default function ViolationsExplorerPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState("");
  const [selectedStation, setSelectedStation] = useState("");
  const [selectedJunction, setSelectedJunction] = useState("");

  const {
    cases,
    junctions,
    violationTypes,
    stations,
    meta,
    fetchCases,
    fetchHotspots,
    fetchMeta,
    fetchStations,
    fetchViolationTypes,
  } = useViolationPoliceStore();

  useEffect(() => {
    Promise.all([
      fetchMeta(),
      fetchStations(),
      fetchViolationTypes(),
      fetchHotspots(),
    ]).finally(() => {
      setIsLoading(false);
    });
  }, [fetchMeta, fetchStations, fetchViolationTypes, fetchHotspots]);

  // Debounced backend cases query search
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchCases({
        q: searchQuery || undefined,
        status: undefined,
        station: selectedStation || undefined,
        limit: 100,
      });
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, selectedStation, fetchCases]);

  const mapHotspots = toMapHotspots(junctions);
  const uniqueJunctionNames = useMemo(() => {
    return Array.from(new Set(junctions.map((h) => h.junctionName)));
  }, [junctions]);

  const filteredViolations = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return cases.filter((v) => {
      const matchesQuery =
        !q ||
        [v.vehicleNumber, v.updatedVehicleNumber ?? "", v.location, v.policeStation, v.junctionName, ...v.violationTypes]
          .join(" ")
          .toLowerCase()
          .includes(q);
      return (
        matchesQuery &&
        (!selectedType || v.violationTypes.includes(selectedType)) &&
        (!selectedStation || v.policeStation === selectedStation) &&
        (!selectedJunction || v.junctionName === selectedJunction)
      );
    });
  }, [cases, searchQuery, selectedType, selectedStation, selectedJunction]);

  const stats = useMemo(() => {
    return {
      total: filteredViolations.length,
      pending: filteredViolations.filter((v) => v.validationStatus === "pending").length,
      approved: filteredViolations.filter((v) => v.validationStatus === "approved").length,
      duplicate: filteredViolations.filter((v) => v.validationStatus === "duplicate").length,
      critical: filteredViolations.filter((v) =>
        v.violationTypes.some((t) => t.toLowerCase().includes("main road") || t.toLowerCase().includes("crossing") || t.toLowerCase().includes("speed") || t.toLowerCase().includes("helmet"))
      ).length,
    };
  }, [filteredViolations]);

  return (
    <AppShell title="Violation Cases Explorer">
      <Skeleton name="violations-kpis" loading={isLoading}>
        <div className="mb-4 grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
          {[
            { label: "Total cases", value: stats.total, icon: AlertTriangle, color: "text-orange-400" },
            { label: "Pending review", value: stats.pending, icon: Clock, color: "text-amber-400" },
            { label: "Approved", value: stats.approved, icon: TrendingUp, color: "text-emerald-400" },
            { label: "Critical violations", value: stats.critical, icon: AlertTriangle, color: "text-red-400" },
            { label: "Duplicates", value: stats.duplicate, icon: Search, color: "text-slate-400" },
          ].map(({ label, value, icon: Icon, color }, idx) => (
            <Card key={label} className={cn("border-slate-800 bg-slate-900/20", idx === 4 && "col-span-2 sm:col-span-1 lg:col-span-1")}>
              <CardContent className="flex items-center gap-3 p-4">
                <div className="rounded-lg border border-slate-800 bg-slate-950 p-2">
                  <Icon className={cn("h-5 w-5", color)} />
                </div>
                <div>
                  <p className="text-xl font-bold text-slate-100">{value.toLocaleString("en-IN")}</p>
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
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-blue-400" />
                Violation hotspots map
              </CardTitle>
              <CardDescription>Junction clustering by enforcement activity and concentration.</CardDescription>
            </CardHeader>
            <CardContent>
              <GridSightMap
                className="h-[280px] sm:h-[400px]"
                hotspots={mapHotspots}
                incidents={[]}
                showHeatmap
                showHotspots
                onSelectHotspot={(h) => setSelectedJunction(h.name)}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Cases matching filters</CardTitle>
              <CardDescription>Search and filter violation cases. Showing {filteredViolations.length.toLocaleString("en-IN")} of {meta?.sampledCases?.toLocaleString("en-IN") ?? 0} demo cases.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-2 lg:grid-cols-4">
                <label className="relative lg:col-span-2">
                  <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                  <input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search plate, junction, location, violation type"
                    className="h-10 w-full rounded-lg border border-slate-700 bg-slate-950 pl-9 pr-3 text-sm text-slate-200 outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </label>
                <select value={selectedType} onChange={(e) => setSelectedType(e.target.value)} className="h-10 rounded-lg border border-slate-700 bg-slate-950 px-3 text-xs text-slate-300">
                  <option value="">All violation types</option>
                  {violationTypes.map((type) => <option key={type} value={type}>{type}</option>)}
                </select>
                <select value={selectedStation} onChange={(e) => setSelectedStation(e.target.value)} className="h-10 rounded-lg border border-slate-700 bg-slate-950 px-3 text-xs text-slate-300">
                  <option value="">All stations</option>
                  {stations.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              <div className="max-h-96 space-y-2 overflow-y-auto">
                {filteredViolations.slice(0, 50).map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setSelectedJunction(v.junctionName)}
                    className="w-full rounded-lg border border-slate-800 bg-slate-950/40 p-3 text-left transition-colors hover:border-amber-500/40 hover:bg-amber-500/5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex-1">
                        <p className="font-mono text-sm font-semibold text-slate-100">{v.updatedVehicleNumber ?? v.vehicleNumber}</p>
                        <p className="text-xs text-slate-500">{v.policeStation} / {v.junctionName}</p>
                        <p className="mt-1 line-clamp-1 text-[11px] text-slate-400">{v.violationTypes.join(", ")}</p>
                      </div>
                      <Badge className="whitespace-nowrap">{v.validationStatus}</Badge>
                    </div>
                  </button>
                ))}
              </div>

              {filteredViolations.length === 0 && (
                <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-6 text-center">
                  <p className="text-sm text-slate-500">No violations match the current filters. Try adjusting your search.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        <aside className="space-y-4 lg:col-span-4">
          <Card className="border-blue-500/20 bg-blue-500/5">
            <CardHeader>
              <CardTitle className="text-sm">Quick insights</CardTitle>
              <CardDescription>Violation trend summary from loaded demo data.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              <div className="space-y-1">
                <p className="font-semibold text-slate-300">Approval rate</p>
                <div className="h-2 rounded-full bg-slate-800">
                  <div className="h-2 rounded-full bg-emerald-500" style={{ width: `${(stats.approved / stats.total * 100) || 0}%` }} />
                </div>
                <p className="text-slate-500">{stats.approved} of {stats.total} approved</p>
              </div>
              <div className="border-t border-slate-800 pt-2">
                <p className="font-semibold text-slate-300 mb-2">Top violation type</p>
                <p className="text-slate-400">{violationTypes[0]}</p>
              </div>
              <div className="border-t border-slate-800 pt-2">
                <p className="font-semibold text-slate-300 mb-2">Top station</p>
                <p className="text-slate-400">{stations[0]}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Filter by junction</CardTitle>
              <CardDescription>Choose a hotspot to focus.</CardDescription>
            </CardHeader>
            <CardContent>
              <select value={selectedJunction} onChange={(e) => setSelectedJunction(e.target.value)} className="h-10 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-xs text-slate-300">
                <option value="">All junctions</option>
                {uniqueJunctionNames.map((junction, idx) => (
                  <option key={`junc-${idx}-${junction}`} value={junction}>
                    {junction}
                  </option>
                ))}
              </select>
              {selectedJunction && (
                <Button variant="outline" size="sm" className="mt-3 w-full" onClick={() => setSelectedJunction("")}>
                  Clear filter
                </Button>
              )}
            </CardContent>
          </Card>
        </aside>
      </div>
    </AppShell>
  );
}
