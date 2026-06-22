"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import "../bones/registry";
import { Skeleton } from "boneyard-js/react";
import { AlertCircle, Car, MapPin, Navigation, Search, Send, ShieldAlert } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { GridSightMap } from "@/components/map/gridsight-map";
import { VoiceAgent } from "@/components/voice/voice-agent";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useCitizenStore, useVoiceStore, useViolationPoliceStore } from "@/store";
import { toMapHotspots } from "@/data/violations";

export default function CitizenPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [fromArea, setFromArea] = useState("Koramangala");
  const [toArea, setToArea] = useState("MG Road");
  const [reportText, setReportText] = useState("");

  const {
    junctions,
    enforcementPriorities,
    fetchHotspots,
    fetchPriorities,
  } = useViolationPoliceStore();

  useEffect(() => {
    if (typeof window !== "undefined") {
      const sessionStr = localStorage.getItem("gridsight_session");
      if (!sessionStr) {
        router.push("/auth?redirect=/citizen");
        return;
      }
      try {
        const session = JSON.parse(sessionStr);
        const now = Date.now();
        if (now - session.createdAt >= 6 * 60 * 60 * 1000) {
          localStorage.removeItem("gridsight_session");
          router.push("/auth?redirect=/citizen");
          return;
        }
      } catch (e) {
        localStorage.removeItem("gridsight_session");
        router.push("/auth?redirect=/citizen");
        return;
      }

      useVoiceStore.getState().setPersona("citizen");
      
      // Fetch live hotspots and priorities from backend
      Promise.all([
        fetchHotspots(),
        fetchPriorities()
      ]).finally(() => {
        setIsLoading(false);
      });
    }
  }, [router, fetchHotspots, fetchPriorities]);

  const meta = useViolationPoliceStore((s) => s.meta);
  const hotspots = junctions;
  const mapHotspots = toMapHotspots(hotspots);
  const priorities = enforcementPriorities;

  const {
    alternateRoute,
    reportedObstructions,
    plateSearchQuery,
    plateSearchResults,
    selectedHotspotJunction,
    addReport,
    lookupPlate,
    requestRoute,
    selectHotspot,
    setAlternateRoute,
  } = useCitizenStore();

  const selectedHotspot = useMemo(
    () => hotspots.find((h) => h.junctionName === selectedHotspotJunction) ?? hotspots[0],
    [hotspots, selectedHotspotJunction]
  );

  return (
    <AppShell title="Citizen Advisory">
      <div className="mb-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
        <h2 className="text-lg font-semibold text-emerald-100">Traffic safety & parking advisories</h2>
        <p className="mt-1 text-sm text-slate-400">
          Stay informed about parking-sensitive routes. Based on anonymized enforcement data from{" "}
          {meta ? meta.totalCases.toLocaleString("en-IN") : "298,450"} Bengaluru traffic incidents.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        <section className="space-y-4 lg:col-span-7">
          <div id="route-map-section">
            <GridSightMap
              className="h-[300px] sm:h-[420px]"
              hotspots={mapHotspots}
              incidents={[]}
              showHeatmap
              showHotspots
              showIncidents={false}
              alternateRoute={alternateRoute}
              onSelectHotspot={(hotspot) => selectHotspot(hotspot.name)}
            />
          </div>

          <Skeleton name="citizen-hotspot-strip" loading={isLoading}>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {hotspots.slice(0, 6).map((hotspot) => (
                <button
                  key={`${hotspot.junctionName}-${hotspot.policeStation}`}
                  type="button"
                  onClick={() => selectHotspot(hotspot.junctionName)}
                  className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 text-left transition-all hover:border-emerald-500/40 hover:bg-emerald-500/5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="line-clamp-1 text-sm font-semibold text-slate-100">{hotspot.junctionName}</p>
                    <Badge severity={hotspot.enforcementPriority} className="text-xs">{hotspot.violationCount} cases</Badge>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">{hotspot.policeStation} • {hotspot.uniqueVehicles} unique vehicles</p>
                  <p className="mt-1 text-[10px] text-slate-600">Common: {hotspot.topViolationTypes.slice(0, 1).join(", ")}</p>
                </button>
              ))}
            </div>
          </Skeleton>

          <Card id="advisory-section" className="border-slate-800 bg-slate-900/10">
            <CardHeader className="pb-2">
              <CardTitle>Enforcement activity summary</CardTitle>
              <CardDescription>Hot zones to be aware of on your commute.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
                {priorities.slice(0, 3).map((item, idx) => (
                  <div key={`${item.junction}-${item.policeStation}`} className="rounded-lg border border-slate-850 bg-slate-950/40 p-3 flex flex-col justify-between min-h-[92px]">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-slate-100 truncate">#{idx + 1} {item.junction}</p>
                        <p className="text-[10px] text-slate-500 truncate">{item.policeStation}</p>
                      </div>
                      <Badge severity={item.priority} className="text-[8px] px-1 py-0.5 whitespace-nowrap">{item.priority}</Badge>
                    </div>
                    <p className="mt-2 text-[10px] text-slate-400">
                      {item.openCases} cases | {item.repeatOffenderCount} repeat
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </section>

        <aside className="grid gap-4 md:grid-cols-2 lg:grid-cols-1 lg:col-span-5 lg:h-fit">
          <Card className="border-emerald-500/20 bg-emerald-500/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-emerald-300" />
                Current area advisory
              </CardTitle>
              <CardDescription>Get guidance for your trip based on real enforcement patterns.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {selectedHotspot && (
                <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-slate-100">{selectedHotspot.junctionName}</p>
                      <p className="text-xs text-slate-500">{selectedHotspot.policeStation}</p>
                    </div>
                    <Badge severity={selectedHotspot.enforcementPriority}>{selectedHotspot.enforcementPriority}</Badge>
                  </div>
                  <div className="mt-3 space-y-2 rounded-lg border border-slate-800 bg-slate-950 p-2 text-xs text-slate-400">
                    <p>🚨 <span className="font-semibold">Frequent issues:</span> {selectedHotspot.topViolationTypes.join(", ")}</p>
                    <p>🚗 <span className="font-semibold">Vehicle types involved:</span> {selectedHotspot.topVehicleTypes.join(", ")}</p>
                    <p>✓ <span className="font-semibold">Recommendation:</span> Avoid parking on roadside; use designated lots. Active enforcement expected.</p>
                  </div>
                </div>
              )}
              <div className="space-y-2">
                <label className="block text-xs font-medium text-slate-300">Find a safer route</label>
                <div className="grid gap-2 sm:grid-cols-2">
                  <input value={fromArea} onChange={(e) => setFromArea(e.target.value)} className="h-10 rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-200 placeholder-slate-600" placeholder="From" />
                  <input value={toArea} onChange={(e) => setToArea(e.target.value)} className="h-10 rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-200 placeholder-slate-600" placeholder="To" />
                </div>
              </div>
              <Button className="w-full" onClick={() => requestRoute(fromArea, toArea)}>
                <Navigation className="h-4 w-4" />
                Get route recommendation
              </Button>
              {alternateRoute && (
                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3">
                  <p className="text-sm font-semibold text-emerald-300">Suggested route</p>
                  <p className="mt-1 text-xs text-slate-300">{alternateRoute.from} → <span className="font-medium text-emerald-400">{alternateRoute.via}</span> → {alternateRoute.to}</p>
                  <p className="mt-2 text-[10px] text-slate-500">This route avoids enforcement-heavy areas.</p>
                  <Button variant="outline" size="sm" className="mt-2" onClick={() => setAlternateRoute(null)}>Clear</Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Skeleton name="citizen-plate-lookup" loading={isLoading}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Car className="h-4 w-4 text-amber-400" />
                  Check your case
                </CardTitle>
                <CardDescription>Search by license plate pattern for case status updates.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <label className="relative block">
                  <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                  <input
                    value={plateSearchQuery}
                    onChange={(e) => lookupPlate(e.target.value)}
                    placeholder="e.g., KA05 or AB1234"
                    className="h-10 w-full rounded-lg border border-slate-700 bg-slate-950 pl-9 pr-3 text-sm text-slate-200 outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </label>
                <div className="max-h-48 space-y-2 overflow-y-auto">
                  {plateSearchResults.length === 0 ? (
                    <p className="rounded-lg border border-slate-800 p-3 text-xs text-slate-500">Enter a license plate to look up case status.</p>
                  ) : (
                    plateSearchResults.slice(0, 5).map((result) => (
                      <div key={result.id} className="rounded-lg border border-slate-800 bg-slate-950/40 p-3 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-mono font-semibold text-slate-100">{result.vehicleNumber}</p>
                          <Badge className="text-[10px]" severity={result.validationStatus === "approved" ? "high" : "medium"}>{result.validationStatus}</Badge>
                        </div>
                        <p className="mt-1 text-slate-500">{result.violationTypes[0]} • {result.policeStation}</p>
                        <p className="mt-1 text-slate-600">Case #: {result.id.slice(0, 8)}</p>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </Skeleton>

          <Skeleton name="citizen-report-form" loading={isLoading}>
            <Card id="report-section">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-amber-400" />
                  Report an obstruction
                </CardTitle>
                <CardDescription>Help us keep roads clear. Report illegal parking or obstructions you observe.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <textarea
                  value={reportText}
                  onChange={(e) => setReportText(e.target.value)}
                  placeholder="Describe what you see: Location, vehicle details, type of obstruction, etc."
                  className="min-h-[88px] w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 placeholder-slate-600 outline-none focus:ring-1 focus:ring-amber-500"
                />
                <Button
                  className="w-full"
                  onClick={() => {
                    if (!reportText.trim()) return;
                    addReport(reportText.trim());
                    setReportText("");
                  }}
                  disabled={!reportText.trim()}
                >
                  <Send className="h-4 w-4" />
                  Submit report
                </Button>
                {reportedObstructions.length > 0 && (
                  <div className="space-y-2 border-t border-slate-800 pt-3">
                    <p className="text-xs font-semibold text-slate-300">Your recent reports:</p>
                    {reportedObstructions.slice(0, 3).map((report) => (
                      <div key={report.id} className="rounded-lg bg-slate-950 p-2 text-xs text-slate-500">
                        <p className="text-slate-400">{report.message}</p>
                        <p className="mt-1 text-[10px] text-slate-600">Report ID: {report.id.slice(0, 8)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </Skeleton>
        </aside>
      </div>

    </AppShell>
  );
}
