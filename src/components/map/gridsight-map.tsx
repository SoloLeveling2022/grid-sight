"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { coordToPercent } from "@/services/map/mock-map-provider";
import { loadMapplsSdk } from "@/services/map/mappls-sdk";
import { cn, severityColor } from "@/lib/utils";
import type { Hotspot, Incident, JunctionHotspot } from "@/types";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, X } from "lucide-react";
import { useViolationPoliceStore } from "@/store";

const mapplsApiKey = process.env.NEXT_PUBLIC_MAPPLS_API_KEY?.trim() ?? "";
const API_MAPPLS = process.env.NEXT_PUBLIC_API_MAPPLS?.trim() ?? "https://api.tomtom.com";
const MAP_ZOOM_DEFAULT = 12;

// Mappls Map Display API — versioned style JSON URLs
const MAPPLS_STYLE_VERSION = "24.0.0-8";

function getISTStyle(): "night" | "day" | "satellite" {
  const nowUtcMs = Date.now();
  const istOffsetMs = 5.5 * 60 * 60 * 1000; // IST = UTC + 5h30m
  const istHour = new Date(nowUtcMs + istOffsetMs).getUTCHours();
  return istHour >= 6 && istHour < 19 ? "day" : "night";
}

function buildStyleUrl(style: "night" | "day" | "satellite", apiKey: string): string {
  const base = `${API_MAPPLS}/map/1/style/${MAPPLS_STYLE_VERSION}`;
  if (style === "day")       return `${base}/basic_main.json?key=${apiKey}`;
  if (style === "satellite") return `${base}/hybrid_main.json?key=${apiKey}`;
  return `${base}/basic_night.json?key=${apiKey}`;
}

function addTrafficLayers(map: any, apiKey: string) {
  if (!map || !apiKey) return;

  const FLOW_SOURCE   = "mappls-traffic-flow-source";
  const FLOW_LAYER    = "mappls-traffic-flow-layer";
  const INC_SOURCE    = "mappls-traffic-inc-source";
  const INC_LAYER     = "mappls-traffic-inc-layer";

  try { if (map.getLayer(FLOW_LAYER))  map.removeLayer(FLOW_LAYER);  } catch (_) {}
  try { if (map.getLayer(INC_LAYER))   map.removeLayer(INC_LAYER);   } catch (_) {}
  try { if (map.getSource(FLOW_SOURCE)) map.removeSource(FLOW_SOURCE); } catch (_) {}
  try { if (map.getSource(INC_SOURCE))  map.removeSource(INC_SOURCE);  } catch (_) {}

  try {
    map.addSource(FLOW_SOURCE, {
      type: "raster",
      tiles: [
        `${API_MAPPLS}/traffic/map/4/tile/flow/relative0/{z}/{x}/{y}.png?key=${apiKey}`,
      ],
      tileSize: 256,
      attribution: "© Mappls live traffic",
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

  try {
    map.addSource(INC_SOURCE, {
      type: "raster",
      tiles: [
        `${API_MAPPLS}/traffic/map/4/tile/incidents/s3/{z}/{x}/{y}.png?key=${apiKey}`,
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

function getImpactColor(delay: number = 0): string {
  if (delay >= 30) return "#ef4444"; // red
  if (delay >= 15) return "#f59e0b"; // amber
  return "#10b981"; // green
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
  patrolRoute?: { coordinates: { lat: number; lng: number }[]; waypoints: any[] } | null;
  onSelectIncident?: (incident: Incident) => void;
  onSelectHotspot?: (hotspot: Hotspot) => void;
  onSelectJunction?: (junction: JunctionHotspot) => void;
  className?: string;
  filterTimeOfDay?: string | null;
  filterStation?: string | null;
  filterViolationType?: string | null;
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
  patrolRoute = null,
  onSelectIncident,
  onSelectHotspot,
  onSelectJunction,
  className,
  filterTimeOfDay,
  filterStation,
  filterViolationType,
}: GridSightMapProps) {
  const [useOfflineFallback, setUseOfflineFallback] = useState(false);
  const liveMapEnabled = Boolean(mapplsApiKey) && !useOfflineFallback;

  // Camera Zone Drawing Store Selectors & Local State
  const { drawingJunction, cameraZones, setCameraZone, setDrawingJunction } = useViolationPoliceStore();
  const [drawnPoints, setDrawnPoints] = useState<[number, number][]>([]);

  const drawingJunctionRef = useRef<string | null>(null);
  const drawnPointsRef = useRef<[number, number][]>([]);

  useEffect(() => {
    drawingJunctionRef.current = drawingJunction;
  }, [drawingJunction]);

  useEffect(() => {
    drawnPointsRef.current = drawnPoints;
  }, [drawnPoints]);

  function percentToCoord(left: number, top: number) {
    const north = 13.06;
    const south = 12.83;
    const west = 77.46;
    const east = 77.72;
    return {
      latitude: north - (top / 100) * (north - south),
      longitude: west + (left / 100) * (east - west),
    };
  }

  const handleFallbackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!drawingJunction) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const left = ((e.clientX - rect.left) / rect.width) * 100;
    const top = ((e.clientY - rect.top) / rect.height) * 100;
    const coord = percentToCoord(left, top);
    setDrawnPoints(prev => [...prev, [coord.latitude, coord.longitude]]);
  };

  const [currentStyle, setCurrentStyle] = useState<"night" | "day" | "satellite">(getISTStyle());
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const activeMarkersRef = useRef<any[]>([]);
  const [mapStatus, setMapStatus] = useState<"idle" | "loading" | "ready" | "error">(
    liveMapEnabled ? "loading" : "idle"
  );
  const [hotspotPopup, setHotspotPopup] = useState<Hotspot | null>(null);
  const [incidentPopup, setIncidentPopup] = useState<Incident | null>(null);
  const [junctionPopup, setJunctionPopup] = useState<JunctionHotspot | null>(null);

  const filteredHotspots = useMemo(() => {
    return hotspots.filter((hs) => {
      if (filterStation && hs.corridor && hs.corridor.toLowerCase() !== filterStation.toLowerCase()) {
        return false;
      }
      if (filterViolationType && hs.topCauses) {
        const matchesType = hs.topCauses.some(c => c.toLowerCase() === filterViolationType.toLowerCase()) || 
                            hs.dominantViolationType?.toLowerCase() === filterViolationType.toLowerCase();
        if (!matchesType) return false;
      }
      if (filterTimeOfDay) {
        const peakHrs = hs.peakHours ? hs.peakHours.split(",").map(h => parseInt(h.trim().split(":")[0], 10)) : [9, 18];
        const matchesTime = peakHrs.some(h => {
          if (filterTimeOfDay === "morning") return h >= 8 && h <= 11;
          if (filterTimeOfDay === "midday") return h > 11 && h < 17;
          if (filterTimeOfDay === "evening") return h >= 17 && h <= 20;
          if (filterTimeOfDay === "night") return h > 20 || h < 8;
          return true;
        });
        if (!matchesTime) return false;
      }
      return true;
    });
  }, [hotspots, filterStation, filterViolationType, filterTimeOfDay]);

  const getMapplsStyleUrl = (style: "night" | "day" | "satellite") => buildStyleUrl(style, mapplsApiKey);

  const changeMapStyle = (style: "night" | "day" | "satellite") => {
    const map = mapRef.current;
    if (!map) return;

    setMapStatus("loading");
    setCurrentStyle(style);
    map.setStyle(getMapplsStyleUrl(style));

    const onStyleLoad = () => {
      setMapStatus("ready");
      addTrafficLayers(mapRef.current, mapplsApiKey);
    };

    if (typeof map.once === "function") {
      map.once("style.load", onStyleLoad);
    }

    const safetyTimer = setTimeout(() => {
      setMapStatus((prev) => (prev === "loading" ? "ready" : prev));
    }, 6000);

    if (typeof map.once === "function") {
      map.once("style.load", () => clearTimeout(safetyTimer));
    }
  };

  // 1. Initialize Mappls Map
  useEffect(() => {
    if (!liveMapEnabled || !containerRef.current) {
      return;
    }

    let cancelled = false;
    let mapInstance: any = null;
    setMapStatus("loading");

    loadMapplsSdk()
      .then((tt) => {
        if (cancelled || !containerRef.current) {
          return;
        }

        if (!tt) {
          setMapStatus("error");
          return;
        }

        mapInstance = tt.map({
          key: mapplsApiKey,
          container: containerRef.current,
          center: [77.5946, 12.9716], // [longitude, latitude] for Bengaluru
          zoom: MAP_ZOOM_DEFAULT,
          dragPan: true,
          scrollZoom: true,
          style: buildStyleUrl(currentStyle, mapplsApiKey),
          attributionControl: false // Strip TomTom/Mapbox attribution text
        });

        mapRef.current = mapInstance;

        mapInstance.on("load", () => {
          if (!cancelled) {
            setMapStatus("ready");
            addTrafficLayers(mapInstance, mapplsApiKey);
          }
        });

        mapInstance.on("click", (e: any) => {
          if (drawingJunctionRef.current) {
            const { lat, lng } = e.lngLat;
            setDrawnPoints((prev) => [...prev, [lat, lng]]);
          }
        });

        if (typeof mapInstance.addStyleChangeHandler === "function") {
          mapInstance.addStyleChangeHandler({
            onStyleChanged: () => {
              if (!cancelled) {
                setMapStatus("ready");
                addTrafficLayers(mapInstance, mapplsApiKey);
              }
            }
          });
        }

        mapInstance.on("error", (e: any) => {
          console.error("Mappls map initialization failed:", e);
          if (!cancelled) {
            setMapStatus("error");
          }
        });
      })
      .catch((err) => {
        console.error("Mappls SDK failed to load:", err);
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
    };
  }, [liveMapEnabled]);

  // 2. Synchronize markers, popups, and heatmaps on the Mappls instance
  useEffect(() => {
    const map = mapRef.current;
    if (!map || mapStatus !== "ready" || typeof window === "undefined" || !window.tt) {
      return;
    }

    const tt = window.tt as any;
    let active = true;

    activeMarkersRef.current.forEach((marker) => {
      try {
        marker.remove?.();
      } catch (e) {}
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
          .setLngLat([lng, lat])
          .addTo(map);

        if (onClick) {
          el.addEventListener("click", onClick);
        }

        newMarkers.push(marker);
      } catch (err) {
        console.error("Mappls Marker addition failed:", err);
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
        const mapplsCoords = coords.map((c) => [c.lng, c.lat]);
        map.addSource(id, {
          type: "geojson",
          data: {
            type: "Feature",
            geometry: {
              type: "LineString",
              coordinates: mapplsCoords,
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
            } catch (e) {}
          },
        });
      } catch (err) {
        console.error("Mappls Polyline addition failed:", err);
      }
    };

    const addPolygonLayer = (id: string, coords: [number, number][], color: string = "#f59e0b") => {
      try {
        if (coords.length < 3) return;
        const closedCoords = [...coords, coords[0]];
        const mapplsCoords = closedCoords.map((c) => [c[1], c[0]]);
        
        map.addSource(id, {
          type: "geojson",
          data: {
            type: "Feature",
            properties: {},
            geometry: {
              type: "Polygon",
              coordinates: [mapplsCoords],
            },
          },
        });
        map.addLayer({
          id: id,
          type: "fill",
          source: id,
          paint: {
            "fill-color": color,
            "fill-opacity": 0.15,
          },
        });
        map.addLayer({
          id: id + "-outline",
          type: "line",
          source: id,
          paint: {
            "line-color": color,
            "line-width": 2,
          },
        });
        newMarkers.push({
          remove: () => {
            try {
              if (map.getLayer(id)) map.removeLayer(id);
              if (map.getLayer(id + "-outline")) map.removeLayer(id + "-outline");
              if (map.getSource(id)) map.removeSource(id);
            } catch (_) {}
          },
        });
      } catch (err) {
        console.error("Mappls Polygon addition failed:", err);
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
        const url = `${API_MAPPLS}/routing/1/calculateRoute/${fromCoord.lat},${fromCoord.lng}:${toCoord.lat},${toCoord.lng}/json?key=${mapplsApiKey}&traffic=true&travelMode=car`;
        const res = await fetch(url);
        if (!res.ok) throw new Error("Routing failed");
        const data = await res.json();
        if (!active || !mapRef.current) return;

        const points = data.routes[0].legs[0].points;
        const mapplsCoords = points.map((p: any) => [p.longitude, p.latitude]);

        map.addSource(id, {
          type: "geojson",
          data: {
            type: "Feature",
            geometry: {
              type: "LineString",
              coordinates: mapplsCoords,
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
              console.error("Mappls polyline cleanup error:", e);
            }
          },
        });
      } catch (err) {
        console.error("Mappls live routing failed, falling back to straight polyline:", err);
        if (active && mapRef.current) {
          addPolyline(id, [fromCoord, toCoord], color, width, dash);
        }
      }
    };

    // Render saved camera zones
    Object.entries(cameraZones).forEach(([jName, points]) => {
      if (points && points.length >= 3) {
        const isSelected = selectedId === jName || drawingJunction === jName;
        const polyId = `camera-zone-${jName}`;
        addPolygonLayer(polyId, points, isSelected ? "#3b82f6" : "#f59e0b");
      }
    });

    // Render currently drawing points
    if (drawingJunction && drawnPoints.length >= 1) {
      drawnPoints.forEach((p, idx) => {
        const html = `
          <div class="h-4 w-4 rounded-full bg-blue-500 border border-white shadow-md flex items-center justify-center text-[8px] text-white font-bold pointer-events-none">
            ${idx + 1}
          </div>
        `;
        createMarker(p[0], p[1], html, 16, 16);
      });

      if (drawnPoints.length >= 2) {
        const coords = drawnPoints.map(p => ({ lat: p[0], lng: p[1] }));
        addPolyline("drawing-zone-line", coords, "#3b82f6", 2, true);
      }
    }

    // A. Render Heatmap Blur Overlay
    if (showHeatmap) {
      filteredHotspots.slice(0, 25).forEach((hs) => {
        const weight = hs.incidentCount * (hs.congestionScore ?? 0.5);
        const size = 60 + Math.min(180, weight * 3);
        const color = getImpactColor(hs.expectedDelayMinutes);
        const html = `
          <div class="pointer-events-none blur-2xl animate-pulse" 
               style="width: ${size}px; height: ${size}px; border-radius: 50%; background: radial-gradient(circle, ${color}44 0%, transparent 70%); transform: translate(-50%, -50%);">
          </div>
        `;
        createMarker(hs.latitude, hs.longitude, html, size, size);
      });
    }

    // B. Render Hotspots
    if (showHotspots) {
      filteredHotspots.forEach((hs) => {
        const selected = selectedId === hs.id;
        const resolved = hs.caseClosed;
        const weight = hs.incidentCount * (hs.congestionScore ?? 0.5);
        const size = 16 + Math.min(14, weight * 0.2);
        const color = getImpactColor(hs.expectedDelayMinutes);
        const iconHtml = resolved ? `
          <div class="flex items-center justify-center text-slate-950 font-bold" style="font-size: 9px; line-height: 1; height: 100%;">✓</div>
        ` : '';
        const border = selected ? "border: 2.5px solid #ffffff; box-shadow: 0 0 0 2px #f59e0b;" : (resolved ? "border: 1.5px solid #ffffff;" : "border: 2px solid #070b14;");
        const opacity = resolved ? "opacity: 0.6; scale: 0.85;" : "";
        const html = `
          <div style="width: ${size}px; height: ${size}px; background-color: ${color}; border-radius: 50%; ${border} cursor: pointer; transform: translate(-50%, -50%); transition: scale 0.15s; z-index: 1000; ${opacity}" 
               title="Hotspot: ${hs.name} (Expected delay: ${hs.expectedDelayMinutes?.toFixed(1) || 0} min)">
            ${iconHtml}
          </div>
        `;
        createMarker(hs.latitude, hs.longitude, html, size, size, () => {
          setHotspotPopup(hs);
          setIncidentPopup(null);
          setJunctionPopup(null);
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
        createMarker(j.latitude, j.longitude, html, 10, 10, () => {
          setJunctionPopup(j);
          setHotspotPopup(null);
          setIncidentPopup(null);
          onSelectJunction?.(j);
        });
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
          setIncidentPopup(inc);
          setHotspotPopup(null);
          setJunctionPopup(null);
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

    // G. Render Police Patrol Route — blue navigation line
    if (patrolRoute && patrolRoute.coordinates && patrolRoute.coordinates.length >= 2) {
      // Blue navigation polyline
      addPolyline("patrol-route-line", patrolRoute.coordinates, "#3b82f6", 5);

      // Navigation arrow marker at start point
      const startCoord = patrolRoute.coordinates[0];
      const navHtml = `
        <div style="
          width: 36px; height: 36px;
          display: flex; align-items: center; justify-content: center;
          background: #1d4ed8;
          border: 3px solid #93c5fd;
          border-radius: 50%;
          box-shadow: 0 0 0 4px rgba(59,130,246,0.35), 0 4px 12px rgba(0,0,0,0.5);
          transform: translate(-50%, -50%);
          cursor: pointer;
          z-index: 1100;
        ">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
            <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z"/>
          </svg>
        </div>
      `;
      createMarker(startCoord.lat, startCoord.lng, navHtml, 36, 36);

      // Auto-fit map bounds to patrol route
      const lats = patrolRoute.coordinates.map(c => c.lat);
      const lngs = patrolRoute.coordinates.map(c => c.lng);
      const bounds = [
        [Math.min(...lngs) - 0.01, Math.min(...lats) - 0.01],
        [Math.max(...lngs) + 0.01, Math.max(...lats) + 0.01],
      ];
      try {
        if (map.fitBounds) {
          map.fitBounds(bounds, { padding: 60, duration: 900 });
        }
      } catch (e) {
        // fallback: just center
        const midLat = (Math.min(...lats) + Math.max(...lats)) / 2;
        const midLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;
        map.setCenter?.([midLng, midLat]);
        map.setZoom?.(12);
      }
    }

    activeMarkersRef.current = newMarkers;

    return () => {
      active = false;
    };
  }, [
    mapStatus,
    incidents,
    filteredHotspots,
    junctions,
    showHeatmap,
    showIncidents,
    showHotspots,
    showJunctions,
    selectedId,
    selectedCorridor,
    alternateRoute,
    patrolRoute,
    onSelectIncident,
    onSelectHotspot,
    onSelectJunction,
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

  // Sync selectedId changes to set the correct active popup
  useEffect(() => {
    if (!selectedId) return;

    const hs = hotspots.find((h) => h.id === selectedId);
    if (hs) {
      setHotspotPopup(hs);
      setIncidentPopup(null);
      setJunctionPopup(null);
      return;
    }

    const inc = incidents.find((i) => i.id === selectedId);
    if (inc) {
      setIncidentPopup(inc);
      setHotspotPopup(null);
      setJunctionPopup(null);
      return;
    }

    const junc = junctions.find((j) => j.id === selectedId);
    if (junc) {
      setJunctionPopup(junc);
      setHotspotPopup(null);
      setIncidentPopup(null);
      return;
    }
  }, [selectedId, hotspots, incidents, junctions]);

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border border-slate-800 bg-[#0c1220]",
        className
      )}
    >
      {/* Hotspot detail popup (TomTom live map) */}
      <AnimatePresence>
        {hotspotPopup && (
          <motion.div
            key="hotspot-popup"
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ duration: 0.18 }}
            className="absolute top-3 left-3 z-30 w-64 rounded-xl border border-slate-700 bg-slate-950/95 backdrop-blur-md shadow-2xl shadow-black/60 overflow-hidden"
          >
            {/* Severity accent bar */}
            <div
              className="h-1 w-full"
              style={{ backgroundColor: getImpactColor(hotspotPopup.expectedDelayMinutes) }}
            />
            <div className="p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-slate-100 leading-tight truncate">{hotspotPopup.name}</p>
                  {hotspotPopup.corridor && (
                    <p className="mt-0.5 text-[10px] text-slate-400 truncate">{hotspotPopup.corridor}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setHotspotPopup(null)}
                  className="shrink-0 rounded p-0.5 text-slate-500 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="mt-2.5 grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-slate-900 border border-slate-800 p-2">
                  <p className="text-[9px] uppercase tracking-wider text-slate-500">Expected Delay</p>
                  <p className="mt-0.5 text-xs font-bold text-slate-100">
                    {hotspotPopup.expectedDelayMinutes?.toFixed(1) ?? 0} min
                  </p>
                </div>
                <div className="rounded-lg bg-slate-900 border border-slate-800 p-2">
                  <p className="text-[9px] uppercase tracking-wider text-slate-500">Speed Drop</p>
                  <p className="mt-0.5 text-xs font-bold text-red-400">-{hotspotPopup.estimatedSpeedDrop?.toFixed(1) ?? 0} km/h</p>
                </div>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-slate-900 border border-slate-800 p-2">
                  <p className="text-[9px] uppercase tracking-wider text-slate-500 font-semibold text-slate-400">Unique Vehicles</p>
                  <p className="mt-0.5 text-xs font-bold text-slate-200">{hotspotPopup.uniqueVehicles ?? hotspotPopup.incidentCount}</p>
                </div>
                <div className="rounded-lg bg-slate-900 border border-slate-800 p-2">
                  <p className="text-[9px] uppercase tracking-wider text-slate-500">Peak Hours</p>
                  <p className="mt-0.5 text-[10px] font-bold text-slate-200 truncate">{hotspotPopup.peakHours ?? "09:00, 18:00"}</p>
                </div>
              </div>
              
              <div className="mt-2 rounded-lg bg-slate-900/60 border border-slate-800 p-2 text-[10px] text-slate-300 space-y-1">
                <p><span className="text-slate-500">Affected Road:</span> {hotspotPopup.affectedRoad ?? hotspotPopup.name}</p>
                <p><span className="text-slate-500">Evidence:</span> {hotspotPopup.evidenceSource}</p>
                <p><span className="text-slate-500">Confidence:</span> {Math.round((hotspotPopup.confidence ?? 0.85) * 100)}%</p>
                {hotspotPopup.nearbySensitivePlaces && hotspotPopup.nearbySensitivePlaces.length > 0 && (
                  <p><span className="text-slate-500">Sensitive Zones:</span> {hotspotPopup.nearbySensitivePlaces.join(", ")}</p>
                )}
              </div>

              {hotspotPopup.caseClosed && (
                <div className="mt-2 rounded-lg bg-emerald-500/10 border border-emerald-500/25 p-2 text-[10px] text-emerald-400 font-medium animate-pulse">
                  ✓ Action Completed: expected delay reduced by {hotspotPopup.expectedDelayReduction?.toFixed(1) ?? 0}m
                </div>
              )}

              {hotspotPopup.topCauses && hotspotPopup.topCauses.length > 0 && (
                <div className="mt-2 rounded-lg bg-slate-900 border border-slate-800 p-2">
                  <p className="text-[9px] uppercase tracking-wider text-slate-500 mb-1">Top Causes</p>
                  <div className="flex flex-wrap gap-1">
                    {hotspotPopup.topCauses.slice(0, 3).map((cause) => (
                      <span key={cause} className="rounded bg-slate-800 border border-slate-700 px-1.5 py-0.5 text-[9px] text-slate-300">{cause}</span>
                    ))}
                  </div>
                </div>
              )}
              <div className="mt-2 flex items-center justify-between">
                <p className="text-[9px] text-slate-600 font-mono">
                  {hotspotPopup.latitude.toFixed(5)}, {hotspotPopup.longitude.toFixed(5)}
                </p>
                <p className="text-[9px] text-slate-500">
                  Recur Freq: <span className="text-amber-400 font-semibold">{Math.round((hotspotPopup.repeatFrequency ?? 0) * 100)}%</span>
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {incidentPopup && (
          <motion.div
            key="incident-popup"
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ duration: 0.18 }}
            className="absolute top-3 left-3 z-30 w-64 rounded-xl border border-slate-700 bg-slate-950/95 backdrop-blur-md shadow-2xl shadow-black/60 overflow-hidden"
          >
            {/* Severity accent bar */}
            <div
              className="h-1 w-full"
              style={{ backgroundColor: severityColor(incidentPopup.severity) }}
            />
            <div className="p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-slate-100 leading-tight truncate">
                    {incidentPopup.eventCause.replace(/_/g, " ")}
                  </p>
                  <p className="mt-0.5 text-[10px] text-slate-400 truncate">{incidentPopup.address}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIncidentPopup(null)}
                  className="shrink-0 rounded p-0.5 text-slate-500 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="mt-2.5 grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-slate-900 border border-slate-800 p-2">
                  <p className="text-[9px] uppercase tracking-wider text-slate-500">Status</p>
                  <p className="mt-0.5 text-xs font-bold capitalize text-amber-400">
                    {incidentPopup.status}
                  </p>
                </div>
                <div className="rounded-lg bg-slate-900 border border-slate-800 p-2">
                  <p className="text-[9px] uppercase tracking-wider text-slate-500">Impact Score</p>
                  <p className="mt-0.5 text-xs font-bold text-slate-100">{Math.round(incidentPopup.impactScore * 100)}%</p>
                </div>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-slate-900 border border-slate-800 p-2">
                  <p className="text-[9px] uppercase tracking-wider text-slate-500">Corridor</p>
                  <p className="mt-0.5 text-xs font-bold text-slate-200 truncate">{incidentPopup.corridor}</p>
                </div>
                <div className="rounded-lg bg-slate-900 border border-slate-800 p-2">
                  <p className="text-[9px] uppercase tracking-wider text-slate-500">Station</p>
                  <p className="mt-0.5 text-xs font-bold text-slate-200 truncate">{incidentPopup.policeStation}</p>
                </div>
              </div>
              {incidentPopup.description && (
                <div className="mt-2 rounded-lg bg-slate-900 border border-slate-800 p-2">
                  <p className="text-[9px] uppercase tracking-wider text-slate-500 mb-1">Description</p>
                  <p className="text-[10px] text-slate-400 italic leading-snug">{incidentPopup.description}</p>
                </div>
              )}
              <div className="mt-2 flex items-center justify-between">
                <p className="text-[9px] text-slate-600 font-mono">
                  {incidentPopup.latitude.toFixed(5)}, {incidentPopup.longitude.toFixed(5)}
                </p>
                <p className="text-[9px] text-slate-500">
                  Priority: <span className="text-amber-400 font-semibold">{incidentPopup.priority}</span>
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {junctionPopup && (
          <motion.div
            key="junction-popup"
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ duration: 0.18 }}
            className="absolute top-3 left-3 z-30 w-64 rounded-xl border border-slate-700 bg-slate-950/95 backdrop-blur-md shadow-2xl shadow-black/60 overflow-hidden"
          >
            {/* Severity accent bar */}
            <div
              className="h-1 w-full"
              style={{ backgroundColor: severityColor(junctionPopup.severity) }}
            />
            <div className="p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-slate-100 leading-tight truncate">{junctionPopup.name}</p>
                  <p className="mt-0.5 text-[10px] text-slate-400 truncate">{junctionPopup.corridor}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setJunctionPopup(null)}
                  className="shrink-0 rounded p-0.5 text-slate-500 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="mt-2.5 grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-slate-900 border border-slate-800 p-2">
                  <p className="text-[9px] uppercase tracking-wider text-slate-500">Risk Severity</p>
                  <p className="mt-0.5 text-xs font-bold capitalize" style={{ color: severityColor(junctionPopup.severity) }}>
                    {junctionPopup.severity}
                  </p>
                </div>
                <div className="rounded-lg bg-slate-900 border border-slate-800 p-2">
                  <p className="text-[9px] uppercase tracking-wider text-slate-500">Intensity Score</p>
                  <p className="mt-0.5 text-xs font-bold text-slate-100">{Math.round(junctionPopup.hotspotScore * 100)}%</p>
                </div>
              </div>
              <div className="mt-2 rounded-lg bg-slate-950 p-2 border border-slate-850">
                <span className="text-[9px] text-slate-500 uppercase font-semibold">Intersection Incidents</span>
                <p className="text-sm font-bold text-cyan-400 mt-0.5">{junctionPopup.incidentCount}</p>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <p className="text-[9px] text-slate-600 font-mono">
                  {junctionPopup.latitude.toFixed(5)}, {junctionPopup.longitude.toFixed(5)}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
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
            filteredHotspots.slice(0, 15).map((hs) => {
              const pos = coordToPercent(hs);
              const weight = hs.incidentCount * (hs.congestionScore ?? 0.5);
              const size = 40 + Math.min(100, weight * 2);
              const color = getImpactColor(hs.expectedDelayMinutes);
              return (
                <div
                  key={`heat-${hs.id}`}
                  className="absolute rounded-full pointer-events-none blur-2xl animate-pulse"
                  style={{
                    left: `${pos.left}%`,
                    top: `${pos.top}%`,
                    width: size,
                    height: size,
                    transform: "translate(-50%, -50%)",
                    background: `radial-gradient(circle, ${color}44 0%, transparent 70%)`,
                  }}
                />
              );
            })}

          {/* SVG Fallback Hotspots */}
          {showHotspots &&
            filteredHotspots.map((hs) => {
              const pos = coordToPercent(hs);
              const selected = selectedId === hs.id;
              const resolved = hs.caseClosed;
              const weight = hs.incidentCount * (hs.congestionScore ?? 0.5);
              const size = 14 + Math.min(12, weight * 0.15);
              const color = getImpactColor(hs.expectedDelayMinutes);
              return (
                <motion.button
                  key={hs.id}
                  type="button"
                  initial={{ scale: 0 }}
                  animate={{ scale: selected ? 1.25 : 1 }}
                  className={cn(
                    "absolute z-20 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 shadow-lg flex items-center justify-center",
                    selected ? "border-white ring-2 ring-amber-400" : (resolved ? "border-white/60" : "border-slate-900")
                  )}
                  style={{
                    left: `${pos.left}%`,
                    top: `${pos.top}%`,
                    width: size,
                    height: size,
                    backgroundColor: color,
                    opacity: resolved ? 0.6 : 1,
                  }}
                  onClick={() => {
                    setHotspotPopup(hs);
                    setIncidentPopup(null);
                    setJunctionPopup(null);
                    onSelectHotspot?.(hs);
                  }}
                  title={hs.name}
                >
                  {resolved && <span className="text-[8px] text-slate-950 font-extrabold leading-none">✓</span>}
                </motion.button>
              );
            })}

          {/* SVG Fallback Junctions */}
          {showJunctions &&
            junctions.map((j) => {
              const pos = coordToPercent(j);
              return (
                <button
                  key={j.id}
                  type="button"
                  className="absolute z-10 -translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 rotate-45 bg-cyan-400 border border-slate-900 cursor-pointer hover:scale-125 transition-transform"
                  style={{ left: `${pos.left}%`, top: `${pos.top}%` }}
                  onClick={() => {
                    setJunctionPopup(j);
                    setHotspotPopup(null);
                    setIncidentPopup(null);
                    onSelectJunction?.(j);
                  }}
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
                  onClick={() => {
                    setIncidentPopup(inc);
                    setHotspotPopup(null);
                    setJunctionPopup(null);
                    onSelectIncident?.(inc);
                  }}
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

          {/* SVG Fallback Patrol Route — blue navigation line + start marker */}
          {patrolRoute && patrolRoute.coordinates && patrolRoute.coordinates.length >= 2 && (() => {
            const points = patrolRoute.coordinates.map(p => coordToPercent({ latitude: p.lat, longitude: p.lng }));
            const pointsStr = points.map(p => `${p.left}%,${p.top}%`).join(" ");
            const startPt = points[0];
            return (
              <div className="absolute inset-0 z-10">
                <svg className="w-full h-full pointer-events-none">
                  {/* Blue glow shadow */}
                  <polyline
                    points={pointsStr}
                    fill="none"
                    stroke="#93c5fd"
                    strokeWidth="9"
                    strokeOpacity="0.25"
                  />
                  {/* Blue navigation line */}
                  <polyline
                    points={pointsStr}
                    fill="none"
                    stroke="#3b82f6"
                    strokeWidth="4"
                    strokeOpacity="0.95"
                  />
                </svg>
                {/* Navigation start marker */}
                <div
                  className="absolute pointer-events-none"
                  style={{ left: `${startPt.left}%`, top: `${startPt.top}%`, transform: "translate(-50%, -50%)" }}
                >
                  <div className="w-9 h-9 rounded-full bg-blue-700 border-[3px] border-blue-300 shadow-lg shadow-blue-900/60 flex items-center justify-center" style={{ boxShadow: '0 0 0 5px rgba(59,130,246,0.25)' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
                      <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z"/>
                    </svg>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* SVG Fallback Camera Zones */}
          {Object.entries(cameraZones).map(([jName, points]) => {
            if (!points || points.length < 3) return null;
            const isSelected = selectedId === jName || drawingJunction === jName;
            const pointsStr = points.map(p => {
              const pos = coordToPercent({ latitude: p[0], longitude: p[1] });
              return `${pos.left}%,${pos.top}%`;
            }).join(" ");
            return (
              <div key={jName} className="absolute inset-0 z-10 pointer-events-none">
                <svg className="w-full h-full">
                  <polygon
                    points={pointsStr}
                    fill={isSelected ? "#3b82f6" : "#f59e0b"}
                    fillOpacity={0.15}
                    stroke={isSelected ? "#3b82f6" : "#f59e0b"}
                    strokeWidth={2}
                  />
                </svg>
              </div>
            );
          })}

          {/* SVG Fallback Drawing Polygon */}
          {drawingJunction && (
            <div className="absolute inset-0 z-20">
              <svg className="w-full h-full pointer-events-none">
                {drawnPoints.length >= 2 && (
                  <polyline
                    points={drawnPoints.map(p => {
                      const pos = coordToPercent({ latitude: p[0], longitude: p[1] });
                      return `${pos.left}%,${pos.top}%`;
                    }).join(" ")}
                    fill="none"
                    stroke="#3b82f6"
                    strokeWidth="2"
                    strokeDasharray="4 3"
                  />
                )}
              </svg>
              {drawnPoints.map((p, idx) => {
                const pos = coordToPercent({ latitude: p[0], longitude: p[1] });
                return (
                  <div
                    key={idx}
                    className="absolute pointer-events-none h-4 w-4 rounded-full bg-blue-600 border border-white flex items-center justify-center text-[8px] font-bold text-white shadow-lg"
                    style={{ left: `${pos.left}%`, top: `${pos.top}%`, transform: "translate(-50%, -50%)" }}
                  >
                    {idx + 1}
                  </div>
                );
              })}
            </div>
          )}

          {/* Overlay to capture clicks in fallback mode */}
          {drawingJunction && (
            <div
              className="absolute inset-0 z-20 cursor-crosshair"
              onClick={handleFallbackClick}
            />
          )}

          {/* Drawing floating control panel overlay */}
          {drawingJunction && (
            <div className="absolute bottom-4 left-4 z-30 flex flex-col gap-2 rounded-xl border border-amber-500/30 bg-slate-950/95 p-3.5 shadow-2xl backdrop-blur-md max-w-sm">
              <div className="flex items-center justify-between gap-4 border-b border-slate-800 pb-2">
                <div>
                  <p className="text-xs font-semibold text-amber-400">Drawing Camera Zone</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">{drawingJunction}</p>
                </div>
                <button
                  onClick={() => {
                    setDrawingJunction(null);
                    setDrawnPoints([]);
                  }}
                  className="text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <p className="text-[10px] text-slate-500 leading-relaxed">
                Click on the map to define the boundary vertices of the no-parking area. Create at least 3 points to complete the zone shape.
              </p>
              <div className="flex gap-2 pt-2 border-t border-slate-900">
                <button
                  onClick={() => {
                    if (drawnPoints.length >= 3) {
                      setCameraZone(drawingJunction, drawnPoints);
                      setDrawingJunction(null);
                      setDrawnPoints([]);
                    }
                  }}
                  disabled={drawnPoints.length < 3}
                  className="flex-1 rounded bg-amber-500 px-3 py-1.5 text-center text-xs font-bold text-slate-950 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
                >
                  Save Zone ({drawnPoints.length})
                </button>
                <button
                  onClick={() => setDrawnPoints([])}
                  disabled={drawnPoints.length === 0}
                  className="rounded border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs text-slate-400 hover:bg-slate-800 hover:text-slate-200 disabled:opacity-50 transition-all cursor-pointer"
                >
                  Reset
                </button>
              </div>
            </div>
          )}

          <div className="absolute top-2 right-2 z-20 flex items-center gap-1.5">
            {mapplsApiKey && (
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
