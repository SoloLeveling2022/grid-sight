"use client";

import { useEffect, useRef, useState } from "react";
import { coordToPercent } from "@/services/map/mock-map-provider";
import { loadTomTomSdk } from "@/services/map/tomtom-sdk";
import { cn, severityColor } from "@/lib/utils";
import type { Hotspot, Incident, JunctionHotspot } from "@/types";
import { motion } from "framer-motion";
import { AlertTriangle } from "lucide-react";

const tomtomApiKey = process.env.NEXT_PUBLIC_TOMTOM_API_KEY?.trim() ?? "";
const MAP_ZOOM_DEFAULT = 12;

// TomTom Map Display API — versioned style JSON URLs
// Latest available versions: https://api.tomtom.com/map/1/style/metadata.json
const TOMTOM_STYLE_VERSION = "24.0.0-8";

/** Returns the correct initial map style based on India Standard Time (UTC+5:30). */
function getISTStyle(): "night" | "day" {
  const nowUtcMs = Date.now();
  const istOffsetMs = 5.5 * 60 * 60 * 1000; // IST = UTC + 5h30m
  const istHour = new Date(nowUtcMs + istOffsetMs).getUTCHours();
  // Day: 06:00 – 18:59 IST  |  Night: 19:00 – 05:59 IST
  return istHour >= 6 && istHour < 19 ? "day" : "night";
}

/** Builds the TomTom Map Display API style JSON URL for a given style key. */
function buildStyleUrl(style: "night" | "day" | "satellite", apiKey: string): string {
  const base = `https://api.tomtom.com/map/1/style/${TOMTOM_STYLE_VERSION}`;
  if (style === "day")       return `${base}/basic_main.json?key=${apiKey}`;
  if (style === "satellite") return `${base}/hybrid_main.json?key=${apiKey}`;
  return `${base}/basic_night.json?key=${apiKey}`;
}

/**
 * Adds TomTom live traffic flow and incident raster tile layers to the map.
 * Safe to call repeatedly — removes stale layers/sources before re-adding.
 *
 * Traffic Flow tiles:  https://developer.tomtom.com/traffic-api/documentation/tomtom-maps/v1/traffic-flow/raster-flow-tiles
 * Traffic Incident tiles: https://developer.tomtom.com/traffic-api/documentation/tomtom-maps/v1/traffic-incidents/raster-incident-tiles
 */
function addTrafficLayers(map: any, apiKey: string) {
  if (!map || !apiKey) return;

  const FLOW_SOURCE   = "tt-traffic-flow-source";
  const FLOW_LAYER    = "tt-traffic-flow-layer";
  const INC_SOURCE    = "tt-traffic-inc-source";
  const INC_LAYER     = "tt-traffic-inc-layer";

  // ── Remove any stale layers / sources from a previous style load ────────
  try { if (map.getLayer(FLOW_LAYER))  map.removeLayer(FLOW_LAYER);  } catch (_) {}
  try { if (map.getLayer(INC_LAYER))   map.removeLayer(INC_LAYER);   } catch (_) {}
  try { if (map.getSource(FLOW_SOURCE)) map.removeSource(FLOW_SOURCE); } catch (_) {}
  try { if (map.getSource(INC_SOURCE))  map.removeSource(INC_SOURCE);  } catch (_) {}

  // ── Traffic Flow raster tiles (relative speed — green/yellow/red routes) ─
  // Style "relative0" colours roads by congestion relative to free-flow speed.
  // Docs: /traffic-flow/raster-flow-tiles  version=4, style=relative0
  try {
    map.addSource(FLOW_SOURCE, {
      type: "raster",
      tiles: [
        `https://api.tomtom.com/traffic/map/4/tile/flow/relative0/{z}/{x}/{y}.png?key=${apiKey}`,
      ],
      tileSize: 256,
      attribution: "© TomTom live traffic",
    });
    map.addLayer({
      id: FLOW_LAYER,
      type: "raster",
      source: FLOW_SOURCE,
      paint: { "raster-opacity": 0.82 },
    });
  } catch (err) {
    console.error("Failed to add traffic flow layer:", err);
  }

  // ── Traffic Incident raster tiles (accidents, closures, etc.) ────────────
  // Style "s3" shows incident icons on top of the road network.
  // Docs: /traffic-incidents/raster-incident-tiles  version=4, style=s3
  try {
    map.addSource(INC_SOURCE, {
      type: "raster",
      tiles: [
        `https://api.tomtom.com/traffic/map/4/tile/incidents/s3/{z}/{x}/{y}.png?key=${apiKey}`,
      ],
      tileSize: 256,
    });
    map.addLayer({
      id: INC_LAYER,
      type: "raster",
      source: INC_SOURCE,
      paint: { "raster-opacity": 0.92 },
    });
  } catch (err) {
    console.error("Failed to add traffic incident layer:", err);
  }
}

interface GridSightMapProps {
  incidents?: Incident[];
  hotspots?: Hotspot[];
  junctions?: JunctionHotspot[];
  showHeatmap?: boolean;
  showIncidents?: boolean;
  showHotspots?: boolean;
  showJunctions?: boolean;
  selectedId?: string | null;
  selectedCorridor?: string | null;
  alternateRoute?: { from: string; to: string; via: string } | null;
  onSelectIncident?: (incident: Incident) => void;
  onSelectHotspot?: (hotspot: Hotspot) => void;
  className?: string;
}

export function GridSightMap({
  incidents = [],
  hotspots = [],
  junctions = [],
  showHeatmap = true,
  showIncidents = true,
  showHotspots = true,
  showJunctions = false,
  selectedId,
  selectedCorridor,
  alternateRoute,
  onSelectIncident,
  onSelectHotspot,
  className,
}: GridSightMapProps) {
  const [useOfflineFallback, setUseOfflineFallback] = useState(false);
  const liveMapEnabled = Boolean(tomtomApiKey) && !useOfflineFallback;
  const [currentStyle, setCurrentStyle] = useState<"night" | "day" | "satellite">(getISTStyle());
  
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const activeMarkersRef = useRef<any[]>([]);
  const [mapStatus, setMapStatus] = useState<"idle" | "loading" | "ready" | "error">(
    liveMapEnabled ? "loading" : "idle"
  );

  // TomTom Map Display API style URL helper (delegates to module-level buildStyleUrl)
  const getTomTomStyleUrl = (style: "night" | "day" | "satellite") => buildStyleUrl(style, tomtomApiKey);

  const changeMapStyle = (style: "night" | "day" | "satellite") => {
    const map = mapRef.current;
    if (!map) return;

    setMapStatus("loading");
    setCurrentStyle(style);
    map.setStyle(getTomTomStyleUrl(style));

    // TomTom SDK v6 (Mapbox-GL based) fires "style.load" when the new style
    // finishes loading. We use `once` to set status back to ready exactly once.
    const onStyleLoad = () => {
      setMapStatus("ready");
      // Re-inject traffic layers after style switch (setStyle() wipes all custom layers)
      addTrafficLayers(mapRef.current, tomtomApiKey);
    };

    if (typeof map.once === "function") {
      map.once("style.load", onStyleLoad);
    }

    // Safety fallback: if style.load never fires (e.g., unsupported SDK version),
    // resolve ready after 6s so the loader doesn't get stuck forever.
    const safetyTimer = setTimeout(() => {
      setMapStatus((prev) => (prev === "loading" ? "ready" : prev));
    }, 6000);

    // Clean up the safety timer if the style loads normally
    if (typeof map.once === "function") {
      map.once("style.load", () => clearTimeout(safetyTimer));
    }
  };


  // 1. Initialize TomTom Map
  useEffect(() => {
    if (!liveMapEnabled || !containerRef.current) {
      return;
    }

    let cancelled = false;
    let mapInstance: any = null;

    // Always start in loading state when effect runs (handles Strict Mode double-invoke)
    setMapStatus("loading");

    loadTomTomSdk()
      .then((tt) => {
        if (cancelled || !containerRef.current) {
          return;
        }

        if (!tt) {
          setMapStatus("error");
          return;
        }

        mapInstance = tt.map({
          key: tomtomApiKey,
          container: containerRef.current,
          center: [77.5946, 12.9716], // [longitude, latitude] for Bengaluru
          zoom: MAP_ZOOM_DEFAULT,
          dragPan: true,
          scrollZoom: true,
          style: buildStyleUrl(currentStyle, tomtomApiKey)
        });

        mapRef.current = mapInstance;

        mapInstance.on("load", () => {
          if (!cancelled) {
            setMapStatus("ready");
            // Inject live traffic flow + incident raster tile layers
            addTrafficLayers(mapInstance, tomtomApiKey);
          }
        });

        if (typeof mapInstance.addStyleChangeHandler === "function") {
          mapInstance.addStyleChangeHandler({
            onStyleChanged: () => {
              if (!cancelled) {
                setMapStatus("ready");
                // Re-inject traffic layers (style change wipes all custom layers)
                addTrafficLayers(mapInstance, tomtomApiKey);
              }
            }
          });
        }

        mapInstance.on("error", (e: any) => {
          console.error("TomTom map initialization failed:", e);
          if (!cancelled) {
            setMapStatus("error");
          }
        });
      })
      .catch((err) => {
        console.error("TomTom SDK failed to load:", err);
        if (!cancelled) {
          setMapStatus("error");
        }
      });

    return () => {
      cancelled = true;
      if (mapInstance) {
        try {
          mapInstance.remove?.();
        } catch (e) {
          // ignore
        }
      }
      mapRef.current = null;
      // Don't call setMapStatus here — let the next effect invocation set "loading" itself
    };
  }, [liveMapEnabled]);

//   useEffect(() => {
//   if (!liveMapEnabled || !containerRef.current) {
//     console.log("Map disabled or container missing");
//     return;
//   }

//   let cancelled = false;
//   let mapInstance: any = null;

//   console.log("Map API Key:", mapmyIndiaApiKey);

//   loadMapplsSdk(mapmyIndiaApiKey)
//     .then((mappls) => {
//       console.log("mappls =", mappls);
//       console.log("window.mappls =", window.mappls);
//       console.log("container =", containerRef.current);

//       console.log(
//         "container size:",
//         containerRef.current?.offsetWidth,
//         containerRef.current?.offsetHeight
//       );

//       if (cancelled || !containerRef.current) {
//         return;
//       }

//       if (!mappls) {
//         console.error("Mappls SDK not loaded");
//         setMapStatus("error");
//         return;
//       }

//       try {
//         containerRef.current.id = "mappls-container";

//         mapInstance = new mappls.Map("mappls-container", {
//           center: [12.9716, 77.5946],
//           zoom: MAP_ZOOM_DEFAULT,
//         });

//         console.log("Map created:", mapInstance);

//         mapRef.current = mapInstance;
//         setMapStatus("ready");
//       } catch (err) {
//         console.error("MAP CREATION ERROR:", err);
//         setMapStatus("error");
//       }
//     })
//     .catch((err) => {
//       console.error("SDK LOAD ERROR:", err);
//       if (!cancelled) {
//         setMapStatus("error");
//       }
//     });

//   return () => {
//     cancelled = true;

//     try {
//       mapInstance?.remove?.();
//     } catch (err) {
//       console.error("Map cleanup failed:", err);
//     }

//     mapRef.current = null;
//     setMapStatus("idle");
//   };
// }, [liveMapEnabled]);

  // 2. Synchronize markers, popups, and heatmaps on the TomTom instance
  useEffect(() => {
    const map = mapRef.current;
    if (!map || mapStatus !== "ready" || typeof window === "undefined" || !window.tt) {
      return;
    }

    const tt = window.tt as any;
    let active = true;

    // Clear previous markers and layers
    activeMarkersRef.current.forEach((marker) => {
      try {
        marker.remove?.();
      } catch (e) {
        // Safe check
      }
    });
    activeMarkersRef.current = [];

    const newMarkers: any[] = [];

    const createMarker = (
      lat: number,
      lng: number,
      html: string,
      width: number,
      height: number,
      onClick?: () => void
    ) => {
      try {
        const el = document.createElement("div");
        el.innerHTML = html.trim();
        el.style.transform = "translate(-50%, -50%)";

        const marker = new tt.Marker({ element: el })
          .setLngLat([lng, lat]) // TomTom LngLat [lng, lat]
          .addTo(map);

        if (onClick) {
          el.addEventListener("click", onClick);
        }

        newMarkers.push(marker);
      } catch (err) {
        console.error("TomTom Marker addition failed:", err);
      }
    };

    const addPolyline = (
      id: string,
      coords: { lat: number; lng: number }[],
      color: string,
      width: number,
      dash?: boolean
    ) => {
      try {
        const tomtomCoords = coords.map((c) => [c.lng, c.lat]);
        map.addSource(id, {
          type: "geojson",
          data: {
            type: "Feature",
            geometry: {
              type: "LineString",
              coordinates: tomtomCoords,
            },
          },
        });

        const layerConfig: any = {
          id: id,
          type: "line",
          source: id,
          paint: {
            "line-color": color,
            "line-width": width,
            "line-opacity": 0.8,
          },
        };

        if (dash) {
          layerConfig.paint["line-dasharray"] = [2, 2];
        }

        map.addLayer(layerConfig);

        newMarkers.push({
          remove: () => {
            try {
              if (map.getLayer(id)) map.removeLayer(id);
              if (map.getSource(id)) map.removeSource(id);
            } catch (e) {
              console.error("TomTom polyline cleanup error:", e);
            }
          },
        });
      } catch (err) {
        console.error("TomTom Polyline addition failed:", err);
      }
    };

    const addRoutingPolyline = async (
      id: string,
      fromCoord: { lat: number; lng: number },
      toCoord: { lat: number; lng: number },
      color: string,
      width: number,
      dash?: boolean
    ) => {
      try {
        const url = `https://api.tomtom.com/routing/1/calculateRoute/${fromCoord.lat},${fromCoord.lng}:${toCoord.lat},${toCoord.lng}/json?key=${tomtomApiKey}&traffic=true&travelMode=car`;
        const res = await fetch(url);
        if (!res.ok) throw new Error("TomTom Routing failed");

        const data = await res.json();
        if (!active || !mapRef.current) return;

        const points = data.routes[0].legs[0].points;
        const tomtomCoords = points.map((p: any) => [p.longitude, p.latitude]);

        map.addSource(id, {
          type: "geojson",
          data: {
            type: "Feature",
            geometry: {
              type: "LineString",
              coordinates: tomtomCoords,
            },
          },
        });

        const layerConfig: any = {
          id: id,
          type: "line",
          source: id,
          paint: {
            "line-color": color,
            "line-width": width,
            "line-opacity": 0.8,
          },
        };

        if (dash) {
          layerConfig.paint["line-dasharray"] = [2, 2];
        }

        map.addLayer(layerConfig);

        newMarkers.push({
          remove: () => {
            try {
              if (map.getLayer(id)) map.removeLayer(id);
              if (map.getSource(id)) map.removeSource(id);
            } catch (e) {
              console.error("TomTom polyline cleanup error:", e);
            }
          },
        });
      } catch (err) {
        console.error("TomTom live routing failed, falling back to straight polyline:", err);
        if (active && mapRef.current) {
          addPolyline(id, [fromCoord, toCoord], color, width, dash);
        }
      }
    };

    // A. Render Heatmap Blur Overlay
    if (showHeatmap) {
      hotspots.slice(0, 15).forEach((hs) => {
        const size = 50 + hs.hotspotScore * 90;
        const color = severityColor(hs.severity);
        const html = `
          <div class="pointer-events-none blur-2xl" 
               style="width: ${size}px; height: ${size}px; border-radius: 50%; background: radial-gradient(circle, ${color}44 0%, transparent 70%); transform: translate(-50%, -50%);">
          </div>
        `;
        createMarker(hs.latitude, hs.longitude, html, size, size);
      });
    }

    // B. Render Hotspots
    if (showHotspots) {
      hotspots.forEach((hs) => {
        const selected = selectedId === hs.id;
        const size = 16 + hs.hotspotScore * 8;
        const color = severityColor(hs.severity);
        const border = selected ? "border: 2.5px solid #ffffff; box-shadow: 0 0 0 2px #f59e0b;" : "border: 2px solid #070b14;";
        const html = `
          <div style="width: ${size}px; height: ${size}px; background-color: ${color}; border-radius: 50%; ${border} cursor: pointer; transform: translate(-50%, -50%); transition: scale 0.15s; z-index: 1000;" 
               title="Hotspot: ${hs.name} (Score: ${Math.round(hs.hotspotScore * 100)})">
          </div>
        `;
        createMarker(hs.latitude, hs.longitude, html, size, size, () => {
          onSelectHotspot?.(hs);
        });
      });
    }

    // C. Render Junctions
    if (showJunctions) {
      junctions.forEach((j) => {
        const html = `
          <div style="width: 10px; height: 10px; background-color: #22d3ee; border: 1.5px solid #070b14; transform: translate(-50%, -50%) rotate(45deg); cursor: pointer;" 
               title="Junction: ${j.name}">
          </div>
        `;
        createMarker(j.latitude, j.longitude, html, 10, 10);
      });
    }

    // D. Render Incidents
    if (showIncidents) {
      incidents.forEach((inc) => {
        const selected = selectedId === inc.id;
        const color = severityColor(inc.severity);
        const border = selected ? "border: 2px solid #ffffff; box-shadow: 0 0 0 1.5px #ffffff;" : "border: 1px solid #070b14;";
        const isFlashing = inc.status === "active";
        
        const html = `
          <div style="width: 10px; height: 10px; background-color: ${color}; border-radius: 2px; ${border} cursor: pointer; transform: translate(-50%, -50%); ${
            isFlashing ? "animation: blink 1.5s infinite alternate;" : ""
          }" title="${inc.eventCause.replace(/_/g, " ")}: ${inc.address}">
            ${
              isFlashing
                ? `<style>
                    @keyframes blink {
                      0% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
                      100% { opacity: 0.4; transform: translate(-50%, -50%) scale(1.25); }
                    }
                   </style>`
                : ""
            }
          </div>
        `;
        createMarker(inc.latitude, inc.longitude, html, 10, 10, () => {
          onSelectIncident?.(inc);
        });
      });
    }

    // E. Render Selected Corridor Polyline Route
    if (selectedCorridor && selectedCorridor !== "all" && selectedCorridor !== "All Corridors") {
      const corridorIncidents = incidents.filter(
        (i) => i.corridor.toLowerCase() === selectedCorridor.toLowerCase()
      );
      const corridorHotspots = hotspots.filter(
        (h) => h.corridor?.toLowerCase() === selectedCorridor.toLowerCase() || h.name.toLowerCase().includes(selectedCorridor.toLowerCase())
      );

      const pathPoints = [...corridorIncidents, ...corridorHotspots]
        .map((p) => ({ lat: p.latitude, lng: p.longitude }))
        .sort((a, b) => a.lat - b.lat);

      if (pathPoints.length >= 2) {
        addRoutingPolyline("corridor-line", pathPoints[0], pathPoints[pathPoints.length - 1], "#f59e0b", 4, true);
      }
    }

    // F. Render Citizen Alternate Route (heavy original vs clear detour)
    if (alternateRoute) {
      const activePoints = hotspots.slice(0, 3).map((h) => ({ lat: h.latitude, lng: h.longitude }));
      if (activePoints.length >= 2) {
        const detourPoints = activePoints.map((p, idx) => ({
          lat: p.lat + (idx % 2 === 0 ? 0.0045 : -0.0045),
          lng: p.lng + (idx % 2 === 0 ? -0.0045 : 0.0045),
        }));

        addRoutingPolyline("original-route-line", activePoints[0], activePoints[activePoints.length - 1], "#ef4444", 3.5);
        addRoutingPolyline("detour-route-line", detourPoints[0], detourPoints[detourPoints.length - 1], "#10b981", 5);
      }
    }

    activeMarkersRef.current = newMarkers;

    return () => {
      active = false;
    };
  }, [
    mapStatus,
    incidents,
    hotspots,
    junctions,
    showHeatmap,
    showIncidents,
    showHotspots,
    showJunctions,
    selectedId,
    selectedCorridor,
    alternateRoute,
    onSelectIncident,
    onSelectHotspot,
  ]);

  // 3. Pan/Center map on selected incident/hotspot/junction coordinates
  useEffect(() => {
    const map = mapRef.current;
    if (!map || mapStatus !== "ready" || !selectedId) {
      return;
    }

    let target: { latitude: number; longitude: number } | null = null;
    const hs = hotspots.find((h) => h.id === selectedId);
    if (hs) {
      target = hs;
    } else {
      const inc = incidents.find((i) => i.id === selectedId);
      if (inc) {
        target = inc;
      } else {
        const junc = junctions.find((j) => j.id === selectedId);
        if (junc) {
          target = junc;
        }
      }
    }

    if (target && map.setCenter) {
      map.setCenter([target.longitude, target.latitude]); // TomTom [longitude, latitude]
      if (map.setZoom) {
        map.setZoom(14);
      }
    }
  }, [selectedId, mapStatus, hotspots, incidents, junctions]);

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border border-slate-800 bg-[#0c1220]",
        className
      )}
    >
      {/* Live TomTom Element */}
      {liveMapEnabled ? (
        <>
          <div ref={containerRef} className="absolute inset-0 z-0 h-full w-full" />
          <div className="absolute inset-0 bg-gradient-to-b from-slate-950/15 via-transparent to-slate-950/30 pointer-events-none z-10" />
          
          {mapStatus === "loading" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/80 z-20 text-xs text-slate-400 gap-2">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
              <span>Initializing TomTom Live Map...</span>
            </div>
          )}

          {mapStatus === "error" && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-950/90 z-20 text-xs text-red-400 p-4 text-center">
              <div className="max-w-xs space-y-3">
                <AlertTriangle className="h-6 w-6 mx-auto text-red-500 animate-bounce" />
                <p className="font-semibold text-slate-200">TomTom API Connection Issue</p>
                <p className="text-slate-500 text-[10px] leading-relaxed">
                  Failed to load map style. Please verify that your key in <code className="bg-slate-900 px-1 py-0.5 rounded text-amber-300 font-mono text-[9px]">.env.local</code> is valid.
                </p>
                <button
                  type="button"
                  onClick={() => setUseOfflineFallback(true)}
                  className="mt-2 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-800 hover:text-white transition-colors cursor-pointer"
                >
                  Use Offline Fallback Map
                </button>
              </div>
            </div>
          )}

          <div className="absolute top-3 right-3 z-20 flex items-center gap-2">
            {liveMapEnabled && mapStatus === "ready" && (
              <div className="flex bg-slate-950/95 rounded-lg p-0.5 border border-slate-800 shadow-xl backdrop-blur-md">
                {(["night", "day", "satellite"] as const).map((style) => (
                  <button
                    key={style}
                    type="button"
                    onClick={() => changeMapStyle(style)}
                    className={cn(
                      "px-2 py-1 text-[10px] font-semibold rounded capitalize transition-all cursor-pointer",
                      currentStyle === style
                        ? "bg-amber-500 text-slate-950 font-bold"
                        : "text-slate-400 hover:text-slate-200"
                    )}
                  >
                    {style}
                  </button>
                ))}
              </div>
            )}
            {/* {liveMapEnabled && (
              <button
                type="button"
                onClick={() => setUseOfflineFallback(true)}
                className="rounded-lg bg-slate-950/95 hover:bg-slate-900 hover:text-slate-200 px-2 py-1.5 text-[10px] text-slate-400 border border-slate-800 cursor-pointer transition-colors shadow-xl backdrop-blur-md"
              >
                Use Offline Map
              </button>
            )} */}
          </div>
        </>
      ) : (
        /* Fallback Mock Interactive Map Grid */
        <>
          <div className="absolute inset-0 opacity-30">
            <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1e293b" strokeWidth="0.5" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#grid)" />
            </svg>
          </div>

          <svg className="absolute inset-0 w-full h-full opacity-20 pointer-events-none">
            <ellipse cx="50%" cy="48%" rx="38%" ry="32%" fill="none" stroke="#334155" strokeWidth="2" strokeDasharray="8 6" />
            <line x1="15%" y1="50%" x2="85%" y2="50%" stroke="#475569" strokeWidth="1.5" />
            <line x1="50%" y1="15%" x2="50%" y2="85%" stroke="#475569" strokeWidth="1.5" />
          </svg>

          {/* SVG Fallback Heatmap Layer */}
          {showHeatmap &&
            hotspots.slice(0, 12).map((hs) => {
              const pos = coordToPercent(hs);
              const size = 40 + hs.hotspotScore * 80;
              return (
                <div
                  key={`heat-${hs.id}`}
                  className="absolute rounded-full pointer-events-none blur-2xl"
                  style={{
                    left: `${pos.left}%`,
                    top: `${pos.top}%`,
                    width: size,
                    height: size,
                    transform: "translate(-50%, -50%)",
                    background: `radial-gradient(circle, ${severityColor(hs.severity)}55 0%, transparent 70%)`,
                  }}
                />
              );
            })}

          {/* SVG Fallback Hotspots */}
          {showHotspots &&
            hotspots.map((hs) => {
              const pos = coordToPercent(hs);
              const selected = selectedId === hs.id;
              return (
                <motion.button
                  key={hs.id}
                  type="button"
                  initial={{ scale: 0 }}
                  animate={{ scale: selected ? 1.25 : 1 }}
                  className={cn(
                    "absolute z-20 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 shadow-lg",
                    selected ? "border-white ring-2 ring-amber-400" : "border-slate-900"
                  )}
                  style={{
                    left: `${pos.left}%`,
                    top: `${pos.top}%`,
                    width: 14 + hs.hotspotScore * 10,
                    height: 14 + hs.hotspotScore * 10,
                    backgroundColor: severityColor(hs.severity),
                  }}
                  onClick={() => onSelectHotspot?.(hs)}
                  title={hs.name}
                />
              );
            })}

          {/* SVG Fallback Junctions */}
          {showJunctions &&
            junctions.map((j) => {
              const pos = coordToPercent(j);
              return (
                <div
                  key={j.id}
                  className="absolute z-10 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rotate-45 bg-cyan-400 border border-slate-900"
                  style={{ left: `${pos.left}%`, top: `${pos.top}%` }}
                  title={j.name}
                />
              );
            })}

          {/* SVG Fallback Incidents */}
          {showIncidents &&
            incidents.map((inc) => {
              const pos = coordToPercent(inc);
              const selected = selectedId === inc.id;
              return (
                <motion.button
                  key={inc.id}
                  type="button"
                  animate={inc.status === "active" ? { opacity: [1, 0.5, 1] } : { opacity: 1 }}
                  transition={{ repeat: inc.status === "active" ? Infinity : 0, duration: 1.5 }}
                  className={cn(
                    "absolute z-30 -translate-x-1/2 -translate-y-1/2 rounded-sm border border-white/30",
                    selected && "ring-2 ring-white scale-125"
                  )}
                  style={{
                    left: `${pos.left}%`,
                    top: `${pos.top}%`,
                    width: 8,
                    height: 8,
                    backgroundColor: severityColor(inc.severity),
                  }}
                  onClick={() => onSelectIncident?.(inc)}
                  title={inc.address}
                />
              );
            })}

          {/* SVG Fallback Corridor/Route Polyline */}
          {selectedCorridor && selectedCorridor !== "all" && selectedCorridor !== "All Corridors" && (() => {
            const points = [...incidents.filter(i => i.corridor.toLowerCase() === selectedCorridor.toLowerCase()), ...hotspots.filter(h => h.name.toLowerCase().includes(selectedCorridor.toLowerCase()) || h.corridor?.toLowerCase() === selectedCorridor.toLowerCase())]
              .map(p => coordToPercent(p))
              .sort((a, b) => a.left - b.left);
            if (points.length >= 2) {
              const pointsStr = points.map(p => `${p.left}%,${p.top}%`).join(" ");
              return (
                <div className="absolute inset-0 z-10 pointer-events-none">
                  <svg className="w-full h-full">
                    <polyline
                      points={pointsStr}
                      fill="none"
                      stroke="#f59e0b"
                      strokeWidth="3.5"
                      strokeDasharray="6,4"
                      strokeOpacity="0.8"
                    />
                  </svg>
                </div>
              );
            }
            return null;
          })()}

          {/* SVG Fallback Citizen Alternate Route detours */}
          {alternateRoute && (() => {
            const activePoints = hotspots.slice(0, 3).map(h => coordToPercent(h));
            if (activePoints.length >= 2) {
              const routePoints = activePoints.map((p, idx) => ({
                left: p.left + (idx % 2 === 0 ? 9 : -9),
                top: p.top + (idx % 2 === 0 ? -9 : 9),
              }));

              const origPointsStr = activePoints.map(p => `${p.left}%,${p.top}%`).join(" ");
              const detourPointsStr = routePoints.map(p => `${p.left}%,${p.top}%`).join(" ");

              return (
                <div className="absolute inset-0 z-10 pointer-events-none">
                  <svg className="w-full h-full">
                    {/* Heavy Congestion Line (Red) */}
                    <polyline
                      points={origPointsStr}
                      fill="none"
                      stroke="#ef4444"
                      strokeWidth="3"
                      strokeOpacity="0.65"
                    />
                    {/* Cleared Detour Line (Green) */}
                    <polyline
                      points={detourPointsStr}
                      fill="none"
                      stroke="#10b981"
                      strokeWidth="4.5"
                      strokeOpacity="0.9"
                    />
                  </svg>
                </div>
              );
            }
            return null;
          })()}

          <div className="absolute top-2 right-2 z-20 flex items-center gap-1.5">
            {tomtomApiKey && (
              <button
                type="button"
                onClick={() => setUseOfflineFallback(false)}
                className="rounded bg-slate-950/80 hover:bg-slate-900 hover:text-slate-200 px-2 py-1 text-[10px] text-slate-400 border border-slate-800 cursor-pointer transition-colors"
              >
                Try Live Map
              </button>
            )}
            <div className="rounded bg-slate-950/80 px-2 py-1 text-[10px] text-slate-400 border border-slate-800">
              Fallback View: Bengaluru Urban
            </div>
          </div>
        </>
      )}

      {/* Map Attribution */}
      <div className="absolute bottom-2 left-2 z-20 rounded bg-slate-950/80 px-2 py-1 text-[10px] text-slate-500 border border-slate-800 pointer-events-none">
        {liveMapEnabled && mapStatus === "ready" ? "TomTom Vector SDK" : "GridSight Layout · Live Ready"}
      </div>
    </div>
  );
}
