import type { Incident } from "@/types";

export type MapplsCoordinate = [number, number]; // [longitude, latitude]

export type MapplsMapOptions = {
  key: string;
  container: string | HTMLElement;
  center?: MapplsCoordinate;
  zoom?: number;
  interactive?: boolean;
  [key: string]: unknown;
};

export type MapplsMapInstance = {
  remove?: () => void;
  setCenter?: (center: MapplsCoordinate) => void;
  setZoom?: (zoom: number) => void;
  addControl?: (control: unknown) => void;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  addSource?: (id: string, source: any) => void;
  removeSource?: (id: string) => void;
  addLayer?: (layer: any) => void;
  removeLayer?: (id: string) => void;
  getLayer?: (id: string) => any;
  getSource?: (id: string) => any;
  addTier?: (tier: any) => void;
  removeTier?: (tier: any) => void;
  showTrafficFlow?: () => void;
  showTrafficIncidents?: () => void;
  hideTrafficFlow?: () => void;
  hideTrafficIncidents?: () => void;
};

export type MapplsGlobal = {
  map: (options: MapplsMapOptions) => MapplsMapInstance;
  Marker: new (options?: { element?: HTMLElement }) => {
    setLngLat: (coords: MapplsCoordinate) => any;
    addTo: (map: MapplsMapInstance) => any;
    remove: () => void;
  };
  TrafficFlowTilesTier?: new (options: { key: string; style?: string; refresh?: number }) => any;
  TrafficIncidentTier?: new (options: { key: string; style?: string }) => any;
};

declare global {
  interface Window {
    tt?: MapplsGlobal; // tt is kept as tt because the under-the-hood TomTom SDK injects window.tt
  }
}

const MAPPLS_SCRIPT_ID = "mappls-maps-sdk-js";
const MAPPLS_CSS_ID = "mappls-maps-sdk-css";

const API_MAPPLS = process.env.NEXT_PUBLIC_API_MAPPLS?.trim() || "https://api.tomtom.com";

export function loadMapplsSdk(): Promise<MapplsGlobal | null> {
  if (typeof window === "undefined") {
    return Promise.resolve(null);
  }

  // Already loaded — return immediately
  if (window.tt?.map) {
    return Promise.resolve(window.tt);
  }

  return new Promise((resolve) => {
    // 1. Load CSS
    if (!document.getElementById(MAPPLS_CSS_ID)) {
      const link = document.createElement("link");
      link.id = MAPPLS_CSS_ID;
      link.rel = "stylesheet";
      link.type = "text/css";
      link.href = `${API_MAPPLS}/maps-sdk-for-web/cdn/6.x/6.25.0/maps/maps.css`;
      document.head.appendChild(link);
    }

    // 2. Load JS Script
    const existingScript = document.getElementById(MAPPLS_SCRIPT_ID) as HTMLScriptElement | null;
    const finish = () => {
      if (window.tt?.map) {
        resolve(window.tt);
      } else {
        resolve(null);
      }
    };

    if (existingScript) {
      if (
        (existingScript as any).readyState === "complete" ||
        existingScript.dataset.loaded === "true"
      ) {
        finish();
        return;
      }
      existingScript.addEventListener("load", finish, { once: true });
      existingScript.addEventListener("error", () => resolve(null), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.id = MAPPLS_SCRIPT_ID;
    script.src = `${API_MAPPLS}/maps-sdk-for-web/cdn/6.x/6.25.0/maps/maps-web.min.js`;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      script.dataset.loaded = "true";
      finish();
    };
    script.onerror = () => resolve(null);
    document.head.appendChild(script);
  });
}

const mapCategoryToCause = (category: number): string => {
  switch (category) {
    case 1: return "ACCIDENT";
    case 2: return "FOG";
    case 3: return "ROADWORKS";
    case 4: return "ROAD_CLOSED";
    case 5: return "RAIN";
    case 6: return "ICE";
    case 7: return "WIND";
    case 8: return "FLOODING";
    case 9: return "ROADWORKS";
    case 11: return "CONGESTION";
    case 14: return "OBSTRUCTION";
    default: return "TRAFFIC_DELAY";
  }
};

const mapMagnitudeToSeverity = (magnitude: number): "low" | "medium" | "high" | "severe" => {
  switch (magnitude) {
    case 0: return "low";
    case 1: return "medium";
    case 2: return "high";
    case 3:
    case 4:
      return "severe";
    default:
      return "medium";
  }
};

const mapMagnitudeToPriority = (magnitude: number): "High" | "Low" => {
  return magnitude >= 2 ? "High" : "Low";
};

export async function fetchLiveMapplsIncidents(key: string): Promise<Incident[]> {
  if (!key) return [];
  // Bounding box for Bengaluru region
  const bbox = "77.3,12.8,77.9,13.2";
  const fields = `{incidents{type,geometry{type,coordinates},properties{id,iconCategory,magnitudeOfDelay,events{description,code},startTime,endTime,delay,roadNumbers}}}`;
  const url = `${API_MAPPLS}/traffic/services/5/incidentDetails?key=${key}&bbox=${bbox}&language=en-GB&fields=${encodeURIComponent(fields)}`;
  
  try {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Mappls Traffic API returned status ${res.status}`);
    }
    const data = await res.json();
    if (!data.incidents || !Array.isArray(data.incidents)) {
      return [];
    }

    return data.incidents.map((item: any, index: number): Incident => {
      const props = item.properties || {};
      const geom = item.geometry || {};
      
      let lat = 12.9716;
      let lng = 77.5946;
      let endLat: number | null = null;
      let endLng: number | null = null;

      if (geom.type === "Point" && Array.isArray(geom.coordinates)) {
        lng = geom.coordinates[0];
        lat = geom.coordinates[1];
      } else if (geom.type === "LineString" && Array.isArray(geom.coordinates) && geom.coordinates.length > 0) {
        lng = geom.coordinates[0][0];
        lat = geom.coordinates[0][1];
        const endCoord = geom.coordinates[geom.coordinates.length - 1];
        if (Array.isArray(endCoord)) {
          endLng = endCoord[0];
          endLat = endCoord[1];
        }
      }

      const roadName = props.roadNumbers && props.roadNumbers.length > 0
        ? props.roadNumbers.join(", ")
        : "City Street";
      
      const cause = mapCategoryToCause(props.iconCategory);
      const severity = mapMagnitudeToSeverity(props.magnitudeOfDelay);
      
      let baseImpact = 0.2 + (props.magnitudeOfDelay || 0) * 0.18;
      if (props.delay) {
        baseImpact += Math.min(0.2, props.delay / 1800);
      }
      const impactScore = Math.min(0.95, Math.max(0.1, baseImpact));

      const desc = props.events && props.events.length > 0
        ? props.events.map((e: any) => e.description).join(". ")
        : `Traffic incident causing delay on ${roadName}`;

      return {
        id: props.id || `mappls-live-${Date.now()}-${index}`,
        eventType: props.iconCategory === 3 || props.iconCategory === 9 ? "planned" : "unplanned",
        latitude: lat,
        longitude: lng,
        endLatitude: endLat,
        endLongitude: endLng,
        address: roadName,
        eventCause: cause,
        requiresRoadClosure: props.iconCategory === 4,
        startDatetime: props.startTime || new Date().toISOString(),
        endDatetime: props.endTime || null,
        status: "active",
        description: desc,
        vehType: null,
        corridor: roadName,
        priority: mapMagnitudeToPriority(props.magnitudeOfDelay),
        policeStation: "Central Traffic Control",
        zone: "Central Zone",
        junction: null,
        impactScore: impactScore,
        severity: severity,
        resolutionMinutes: props.delay ? Math.round(props.delay / 60) : null
      };
    });
  } catch (error) {
    console.error("Failed to fetch live Mappls incidents:", error);
    return [];
  }
}

export interface FlowSegmentData {
  frc: string;
  currentSpeed: number;
  freeFlowSpeed: number;
  currentTravelTime: number;
  freeFlowTravelTime: number;
  confidence: number;
}

export async function fetchMapplsFlowSegment(
  lat: number,
  lng: number,
  key: string
): Promise<FlowSegmentData | null> {
  if (!key) return null;
  const url = `${API_MAPPLS}/traffic/services/4/flowSegmentData/absolute/10/json?key=${key}&point=${lat},${lng}`;
  
  try {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Flow Segment API returned status ${res.status}`);
    }
    const data = await res.json();
    if (!data.flowSegmentData) {
      return null;
    }
    const flow = data.flowSegmentData;
    return {
      frc: flow.frc || "Unknown",
      currentSpeed: flow.currentSpeed,
      freeFlowSpeed: flow.freeFlowSpeed,
      currentTravelTime: flow.currentTravelTime,
      freeFlowTravelTime: flow.freeFlowTravelTime,
      confidence: flow.confidence
    };
  } catch (error) {
    console.error("Failed to fetch Mappls flow segment:", error);
    return null;
  }
}
