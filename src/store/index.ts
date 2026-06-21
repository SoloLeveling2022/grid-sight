import { create } from "zustand";
import type {
  DeviceProductivity,
  EnforcementPriorityItem,
  Incident,
  Hotspot,
  JunctionViolationHotspot,
  Recommendation,
  Alert,
  CongestionSummary,
  RepeatOffender,
  ValidationStatus,
  ViolationCase,
  Severity,
  StationSummary,
} from "@/types";
import type { MapSelection } from "@/types/map";
import type { VoiceCommandResponse, VoiceSession, VoicePersona } from "@/types/voice";
import { fetchLiveMapplsIncidents, fetchMapplsFlowSegment, type FlowSegmentData } from "@/services/map/mappls-sdk";

const mapplsApiKey = process.env.NEXT_PUBLIC_MAPPLS_API_KEY?.trim() ?? "";
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// ─── Shared mapper helpers ────────────────────────────────────────────────────

function mapBackendCaseToFrontend(c: any): ViolationCase {
  let violationTypes: string[] = [];
  try {
    if (typeof c.violation_type === "string") {
      violationTypes = JSON.parse(c.violation_type);
    } else if (Array.isArray(c.violation_type)) {
      violationTypes = c.violation_type;
    }
  } catch (e) {
    violationTypes = c.violation_type ? [c.violation_type] : [];
  }

  let offenceCodes: number[] = [];
  try {
    if (typeof c.offence_code === "string") {
      offenceCodes = JSON.parse(c.offence_code);
    } else if (Array.isArray(c.offence_code)) {
      offenceCodes = c.offence_code;
    }
  } catch (e) {
    offenceCodes = [];
  }

  return {
    id: c.id,
    latitude: c.latitude || 12.9716,
    longitude: c.longitude || 77.5946,
    location: c.location || "Unknown Location",
    vehicleNumber: c.vehicle_number || "UNKNOWN",
    updatedVehicleNumber: c.updated_vehicle_number || null,
    vehicleType: c.vehicle_type || "UNKNOWN",
    updatedVehicleType: c.updated_vehicle_type || null,
    violationTypes: violationTypes,
    offenceCodes: offenceCodes,
    deviceId: c.device_id || "DEV-UNKNOWN",
    policeStation: c.police_station || "Unknown Station",
    junctionName: c.junction_name || "No Junction",
    createdDatetime: c.created_datetime,
    closedDatetime: c.closed_datetime || null,
    modifiedDatetime: c.modified_datetime || null,
    validationStatus: c.validation_status || "pending",
    validationTimestamp: c.validation_timestamp || null,
    actionTakenTimestamp: c.action_taken_timestamp || null,
    dataSentToScita: c.data_sent_to_scita || false,
    createdBy: c.created_by || "System",
    centerCode: c.center_code || "CTR-00",
    description: c.description || null,
    evidenceImageUrl: c.evidence_image_url || null,
  };
}

function mapBackendHotspotToFrontend(h: any): JunctionViolationHotspot {
  return {
    junctionName: h.junction_name || "No Junction",
    policeStation: h.police_station || "Unknown Station",
    violationCount: h.violation_count || 0,
    uniqueVehicles: h.unique_vehicles || 0,
    topViolationTypes: h.top_violation_type ? [h.top_violation_type] : [],
    topVehicleTypes: h.top_vehicle_type ? [h.top_vehicle_type] : [],
    latitude: h.latitude || 12.9716,
    longitude: h.longitude || 77.5946,
    enforcementPriority: (h.priority || "low") as Severity,
    dominantViolationType: h.dominant_violation_type || h.top_violation_type || "UNKNOWN",
    peakHours: h.peak_hours || "09:00, 18:00",
    repeatFrequency: h.repeat_frequency || 0.0,
    nearbySensitivePlaces: h.nearby_sensitive_places || ["junction"],
    estimatedSpeedDrop: h.estimated_speed_drop || 0.0,
    expectedDelayMinutes: h.expected_delay_minutes || 0.0,
    congestionScore: h.congestion_score || 0.0,
    affectedRoad: h.affected_road || h.junction_name || "No Junction",
    confidence: h.confidence || 0.85,
    evidenceSource: h.evidence_source || "Model estimate & historical incidents",
  };
}

// ─── Police Map Store (TomTom live traffic layer) ─────────────────────────────

interface PoliceState {
  incidents: Incident[];
  hotspots: Hotspot[];
  recommendations: Recommendation[];
  alerts: Alert[];
  congestionSummaries: CongestionSummary[];
  selectedCorridor: string | null;
  mapSelection: MapSelection;
  showHeatmap: boolean;
  showIncidents: boolean;
  showHotspots: boolean;
  showJunctions: boolean;
  timeHorizonMinutes: number;
  useLiveTraffic: boolean;
  liveIncidents: Incident[];
  isFetchingLiveTraffic: boolean;
  selectedSegmentFlow: FlowSegmentData | null;
  isFetchingSegmentFlow: boolean;
  setSelectedCorridor: (corridor: string | null) => void;
  setMapSelection: (selection: MapSelection) => void;
  toggleLayer: (layer: "heatmap" | "incidents" | "hotspots" | "junctions") => void;
  setTimeHorizon: (minutes: number) => void;
  toggleLiveTraffic: (enabled: boolean) => Promise<void>;
  fetchLiveTraffic: () => Promise<void>;
  fetchSegmentFlow: (lat: number, lng: number) => Promise<void>;
  refresh: () => void;
}

export const usePoliceStore = create<PoliceState>((set, get) => ({
  // All data starts empty — no static stubs
  incidents: [],
  hotspots: [],
  recommendations: [],
  alerts: [],
  congestionSummaries: [],
  selectedCorridor: null,
  mapSelection: { type: null, id: null, data: null },
  showHeatmap: true,
  showIncidents: true,
  showHotspots: true,
  showJunctions: false,
  timeHorizonMinutes: 30,
  useLiveTraffic: true,
  liveIncidents: [],
  isFetchingLiveTraffic: false,
  selectedSegmentFlow: null,
  isFetchingSegmentFlow: false,
  setSelectedCorridor: (corridor) => set({ selectedCorridor: corridor }),
  setMapSelection: (selection) => {
    set({ mapSelection: selection, selectedSegmentFlow: null });
    if (selection.data && "latitude" in selection.data && "longitude" in selection.data) {
      get().fetchSegmentFlow(selection.data.latitude, selection.data.longitude);
    }
  },
  toggleLayer: (layer) =>
    set((s) => {
      if (layer === "heatmap") return { showHeatmap: !s.showHeatmap };
      if (layer === "incidents") return { showIncidents: !s.showIncidents };
      if (layer === "hotspots") return { showHotspots: !s.showHotspots };
      return { showJunctions: !s.showJunctions };
    }),
  setTimeHorizon: (minutes) => set({ timeHorizonMinutes: minutes }),
  toggleLiveTraffic: async (enabled) => {
    set({ useLiveTraffic: enabled });
    if (enabled) {
      await get().fetchLiveTraffic();
    } else {
      set({ liveIncidents: [], incidents: [] });
    }
  },
  fetchLiveTraffic: async () => {
    if (!mapplsApiKey) {
      console.warn("No Mappls API Key found when fetching live traffic.");
      return;
    }
    set({ isFetchingLiveTraffic: true });
    try {
      const live = await fetchLiveMapplsIncidents(mapplsApiKey);
      set({ liveIncidents: live, incidents: live });
    } catch (e) {
      console.error("Store error fetching live traffic:", e);
    } finally {
      set({ isFetchingLiveTraffic: false });
    }
  },
  fetchSegmentFlow: async (lat, lng) => {
    if (!mapplsApiKey) return;
    set({ isFetchingSegmentFlow: true });
    try {
      const flow = await fetchMapplsFlowSegment(lat, lng, mapplsApiKey);
      set({ selectedSegmentFlow: flow });
    } catch (e) {
      console.error("Store error fetching flow segment:", e);
    } finally {
      set({ isFetchingSegmentFlow: false });
    }
  },
  refresh: () => {
    const useLive = get().useLiveTraffic;
    if (useLive && mapplsApiKey) {
      set({ isFetchingLiveTraffic: true });
      fetchLiveMapplsIncidents(mapplsApiKey)
        .then((live) => set({ liveIncidents: live, incidents: live, isFetchingLiveTraffic: false }))
        .catch((e) => { console.error("Error refreshing live traffic:", e); set({ isFetchingLiveTraffic: false }); });
    }
  },
}));

// ─── Violation Police Store ───────────────────────────────────────────────────

interface ViolationPoliceState {
  cases: ViolationCase[];
  junctions: JunctionViolationHotspot[];
  repeatOffenders: RepeatOffender[];
  deviceProductivity: DeviceProductivity[];
  enforcementPriorities: EnforcementPriorityItem[];
  stationWorkload: StationSummary[];
  violationTypes: string[];
  violationDistribution: Record<string, number>;
  stations: string[];
  meta: { totalCases: number; sampledCases: number; topStations: [string, number][]; topViolationTypes: [string, number][] } | null;
  patrolRoute: { coordinates: { lat: number; lng: number }[]; waypoints: any[] } | null;
  isFetchingRoute: boolean;
  isInitialLoading: boolean;
  searchQuery: string;
  selectedViolationType: string | null;
  selectedStation: string | null;
  selectedJunction: string | null;
  selectedStatus: ValidationStatus | null;
  selectedCaseId: string | null;
  setSearchQuery: (query: string) => void;
  setViolationTypeFilter: (violationType: string | null) => void;
  setStationFilter: (station: string | null) => void;
  setJunctionFilter: (junction: string | null) => void;
  setStatusFilter: (status: ValidationStatus | null) => void;
  selectCase: (id: string | null) => void;
  approveCase: (id: string) => Promise<void>;
  rejectCase: (id: string) => Promise<void>;
  flagDuplicate: (id: string) => Promise<void>;
  searchByPlate: (plate: string) => ViolationCase[];
  fetchCases: (params?: { q?: string; status?: string; station?: string; limit?: number }) => Promise<void>;
  fetchHotspots: () => Promise<void>;
  fetchPriorities: () => Promise<void>;
  fetchRepeatOffenders: () => Promise<void>;
  fetchDeviceProductivity: () => Promise<void>;
  fetchMeta: () => Promise<void>;
  fetchStations: () => Promise<void>;
  fetchViolationTypes: () => Promise<void>;
  fetchStationWorkload: () => Promise<void>;
  fetchViolationDistribution: () => Promise<void>;
  fetchPatrolRoute: (limit?: number) => Promise<void>;
  clearPatrolRoute: () => void;
  dispatchPatrol: (junction: string) => void;
  takeAction: (junction: string) => void;
  closeCase: (junction: string) => void;
  resetSimulation: (junction: string) => void;
  cameraZones: Record<string, [number, number][]>;
  setCameraZone: (junction: string, points: [number, number][]) => void;
  drawingJunction: string | null;
  setDrawingJunction: (junction: string | null) => void;
}

function updateCaseStatus(cases: ViolationCase[], id: string, validationStatus: ValidationStatus): ViolationCase[] {
  const timestamp = new Date().toISOString();
  return cases.map((c) =>
    c.id === id
      ? { ...c, validationStatus, validationTimestamp: timestamp,
          actionTakenTimestamp: validationStatus === "approved" ? timestamp : c.actionTakenTimestamp }
      : c
  );
}

export const useViolationPoliceStore = create<ViolationPoliceState>((set, get) => ({
  // All starts empty — FastAPI is the single source of truth
  cases: [],
  junctions: [],
  repeatOffenders: [],
  deviceProductivity: [],
  enforcementPriorities: [],
  stationWorkload: [],
  violationTypes: [],
  violationDistribution: {},
  stations: [],
  meta: null,
  cameraZones: {},
  patrolRoute: null,
  isFetchingRoute: false,
  isInitialLoading: true,
  searchQuery: "",
  selectedViolationType: null,
  drawingJunction: null,
  selectedStation: null,
  selectedJunction: null,
  selectedStatus: null,
  selectedCaseId: null,
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setViolationTypeFilter: (selectedViolationType) => set({ selectedViolationType }),
  setStationFilter: (selectedStation) => set({ selectedStation }),
  setJunctionFilter: (selectedJunction) => set({ selectedJunction }),
  setStatusFilter: (selectedStatus) => set({ selectedStatus }),
  selectCase: (selectedCaseId) => set({ selectedCaseId }),

  approveCase: async (id) => {
    try {
      await fetch(`${API_BASE_URL}/api/violations/${id}/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "approved" }),
      });
    } catch (e) {
      console.debug(`approveCase ${id} offline — updating locally`);
    }
    set((s) => ({ cases: updateCaseStatus(s.cases, id, "approved") }));
  },

  rejectCase: async (id) => {
    try {
      await fetch(`${API_BASE_URL}/api/violations/${id}/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "rejected" }),
      });
    } catch (e) {
      console.debug(`rejectCase ${id} offline — updating locally`);
    }
    set((s) => ({ cases: updateCaseStatus(s.cases, id, "rejected") }));
  },

  flagDuplicate: async (id) => {
    try {
      await fetch(`${API_BASE_URL}/api/violations/${id}/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "duplicate" }),
      });
    } catch (e) {
      console.debug(`flagDuplicate ${id} offline — updating locally`);
    }
    set((s) => ({ cases: updateCaseStatus(s.cases, id, "duplicate") }));
  },

  searchByPlate: (plate) => {
    const q = plate.trim().toLowerCase();
    if (!q) return get().cases;
    return get().cases.filter((c) => c.vehicleNumber.toLowerCase().includes(q));
  },

  fetchCases: async (params = {}) => {
    const query = new URLSearchParams();
    if (params.q) query.set("q", params.q);
    if (params.status) query.set("validation_status", params.status);
    if (params.station) query.set("police_station", params.station);
    query.set("limit", String(params.limit || 80));
    try {
      const res = await fetch(`${API_BASE_URL}/api/violations/search?${query.toString()}`);
      if (!res.ok) throw new Error("Search response error");
      const data = await res.json();
      set({ cases: data.results.map(mapBackendCaseToFrontend) });
    } catch (e) {
      console.debug("fetchCases: backend unavailable", e);
    }
  },

  fetchHotspots: async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/ml/hotspots`);
      if (!res.ok) throw new Error("Hotspots response error");
      const data = await res.json();
      set({ junctions: data.map(mapBackendHotspotToFrontend) });
    } catch (e) {
      console.debug("fetchHotspots: backend unavailable", e);
    }
  },

  fetchPriorities: async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/ml/enforcement-priorities?limit=25`);
      if (!res.ok) throw new Error("Priorities response error");
      const data = await res.json();
      set({ enforcementPriorities: data });
    } catch (e) {
      console.debug("fetchPriorities: backend unavailable", e);
    }
  },

  fetchRepeatOffenders: async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/violations/repeat-offenders?limit=25`);
      if (!res.ok) throw new Error("Repeat offenders response error");
      const data = await res.json();
      const mapped = data.map((o: any) => ({
        ...o,
        firstSeen: o.firstSeen ? new Date(o.firstSeen).toISOString() : new Date().toISOString(),
        lastSeen: o.lastSeen ? new Date(o.lastSeen).toISOString() : new Date().toISOString(),
      }));
      set({ repeatOffenders: mapped });
    } catch (e) {
      console.debug("fetchRepeatOffenders: backend unavailable", e);
    }
  },

  fetchDeviceProductivity: async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/violations/device-productivity?limit=25`);
      if (!res.ok) throw new Error("Device productivity response error");
      const data = await res.json();
      const mapped = data.map((d: any) => ({
        ...d,
        lastActiveDate: d.lastActiveDate ? new Date(d.lastActiveDate).toISOString() : new Date().toISOString(),
      }));
      set({ deviceProductivity: mapped });
    } catch (e) {
      console.debug("fetchDeviceProductivity: backend unavailable", e);
    }
  },

  fetchMeta: async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/violations/meta`);
      if (!res.ok) throw new Error("Meta response error");
      const data = await res.json();
      set({ meta: data });
    } catch (e) {
      console.debug("fetchMeta: backend unavailable", e);
    }
  },

  fetchStations: async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/violations/stations`);
      if (!res.ok) throw new Error("Stations response error");
      const data = await res.json();
      set({ stations: data });
    } catch (e) {
      console.debug("fetchStations: backend unavailable", e);
    }
  },

  fetchViolationTypes: async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/violations/violation-types`);
      if (!res.ok) throw new Error("Violation types response error");
      const data = await res.json();
      set({ violationTypes: data });
    } catch (e) {
      console.debug("fetchViolationTypes: backend unavailable", e);
    }
  },

  fetchStationWorkload: async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/violations/station-workload?limit=8`);
      if (!res.ok) throw new Error("Station workload response error");
      const data = await res.json();
      set({ stationWorkload: data });
    } catch (e) {
      console.debug("fetchStationWorkload: backend unavailable", e);
    }
  },

  fetchViolationDistribution: async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/violations/type-distribution`);
      if (!res.ok) throw new Error("Distribution response error");
      const data = await res.json();
      set({ violationDistribution: data });
    } catch (e) {
      console.debug("fetchViolationDistribution: backend unavailable", e);
    }
  },

  fetchPatrolRoute: async (limit = 5) => {
    set({ isFetchingRoute: true });
    try {
      const res = await fetch(`${API_BASE_URL}/api/ml/patrol-route?limit=${limit}`);
      if (!res.ok) throw new Error("Patrol route response error");
      const data = await res.json();
      set({ patrolRoute: data });
    } catch (e) {
      console.error("fetchPatrolRoute error:", e);
      set({ patrolRoute: null });
    } finally {
      set({ isFetchingRoute: false });
    }
  },

  clearPatrolRoute: () => set({ patrolRoute: null }),

  dispatchPatrol: (junction) => {
    set((s) => ({
      junctions: s.junctions.map((j) =>
        j.junctionName === junction
          ? {
              ...j,
              patrolDispatched: true,
              actionTaken: false,
              caseClosed: false,
              expectedDelayReduction: 0,
              scoreReduced: 0,
            }
          : j
      ),
      enforcementPriorities: s.enforcementPriorities.map((p) =>
        p.junction === junction
          ? {
              ...p,
              patrolDispatched: true,
              actionTaken: false,
              caseClosed: false,
              expectedDelayReduction: 0,
              scoreReduced: 0,
            }
          : p
      ),
    }));
  },

  takeAction: (junction) => {
    set((s) => ({
      junctions: s.junctions.map((j) =>
        j.junctionName === junction ? { ...j, actionTaken: true } : j
      ),
      enforcementPriorities: s.enforcementPriorities.map((p) =>
        p.junction === junction ? { ...p, actionTaken: true } : p
      ),
    }));
  },

  closeCase: (junction) => {
    set((s) => ({
      junctions: s.junctions.map((j) => {
        if (j.junctionName === junction) {
          const delay = j.expectedDelayMinutes || 10;
          const reduction = Math.round(delay * 0.85 * 10) / 10;
          const newDelay = Math.max(1, delay - reduction);
          return {
            ...j,
            caseClosed: true,
            expectedDelayReduction: reduction,
            scoreReduced: Math.round((j.violationCount || 10) * 0.75),
            expectedDelayMinutes: newDelay,
            congestionScore: newDelay / 60.0,
            enforcementPriority: "low" as Severity,
          };
        }
        return j;
      }),
      enforcementPriorities: s.enforcementPriorities.map((p) => {
        if (p.junction === junction) {
          const delay = p.expectedDelayMinutes || 10;
          const reduction = Math.round(delay * 0.85 * 10) / 10;
          const originalScore = p.score;
          const newScore = 15;
          return {
            ...p,
            caseClosed: true,
            expectedDelayReduction: reduction,
            scoreReduced: originalScore - newScore,
            score: newScore,
            priority: "low" as Severity,
            expectedDelayMinutes: Math.max(1, delay - reduction),
            congestionScore: Math.max(1, delay - reduction) / 60.0,
          };
        }
        return p;
      }),
    }));
  },

  resetSimulation: (junction) => {
    set((s) => ({
      junctions: s.junctions.map((j) =>
        j.junctionName === junction
          ? {
              ...j,
              patrolDispatched: undefined,
              actionTaken: undefined,
              caseClosed: undefined,
              expectedDelayReduction: undefined,
              scoreReduced: undefined,
            }
          : j
      ),
      enforcementPriorities: s.enforcementPriorities.map((p) =>
        p.junction === junction
          ? {
              ...p,
              patrolDispatched: undefined,
              actionTaken: undefined,
              caseClosed: undefined,
              expectedDelayReduction: undefined,
              scoreReduced: undefined,
            }
          : p
      ),
    }));
  },

  setCameraZone: (junction, points) => {
    set((s) => ({
      cameraZones: {
        ...s.cameraZones,
        [junction]: points,
      },
      junctions: s.junctions.map((j) =>
        j.junctionName === junction ? { ...j, cameraZonePolygon: points } : j
      ),
    }));
  },
  setDrawingJunction: (drawingJunction) => set({ drawingJunction }),
}));

// ─── Citizen Store ────────────────────────────────────────────────────────────

interface CitizenState {
  selectedArea: string | null;
  reportedObstructions: Array<{ id: string; timestamp: string; message: string }>;
  alternateRoute: { from: string; to: string; via: string } | null;
  plateSearchQuery: string;
  plateSearchResults: ViolationCase[];
  selectedHotspotJunction: string | null;
  setSelectedArea: (area: string | null) => void;
  addReport: (message: string) => void;
  setAlternateRoute: (route: CitizenState["alternateRoute"]) => void;
  lookupPlate: (plate: string) => Promise<void>;
  selectHotspot: (junction: string | null) => void;
  requestRoute: (from: string, to: string) => Promise<void>;
}

export const useCitizenStore = create<CitizenState>((set) => ({
  selectedArea: null,
  reportedObstructions: [],
  alternateRoute: null,
  plateSearchQuery: "",
  plateSearchResults: [],
  selectedHotspotJunction: null,
  setSelectedArea: (area) => set({ selectedArea: area }),
  addReport: (message) =>
    set((s) => ({
      reportedObstructions: [
        { id: `RPT-${Date.now()}`, timestamp: new Date().toISOString(), message },
        ...s.reportedObstructions,
      ],
    })),
  setAlternateRoute: (route) => set({ alternateRoute: route }),
  lookupPlate: async (plate) => {
    set({ plateSearchQuery: plate });
    if (!plate.trim()) { set({ plateSearchResults: [] }); return; }
    try {
      const res = await fetch(`${API_BASE_URL}/api/violations/search?q=${encodeURIComponent(plate.trim())}&limit=10`);
      if (!res.ok) throw new Error("Plate search error");
      const data = await res.json();
      set({ plateSearchResults: data.results.map(mapBackendCaseToFrontend) });
    } catch (e) {
      console.debug("lookupPlate: backend unavailable", e);
      set({ plateSearchResults: [] });
    }
  },
  selectHotspot: (selectedHotspotJunction) => set({ selectedHotspotJunction }),
  requestRoute: async (from, to) => {
    // Fetch the top enforcement priority junction from FastAPI for smarter route avoidance
    let via = "Outer Ring Road";
    try {
      const res = await fetch(`${API_BASE_URL}/api/ml/enforcement-priorities?limit=1`);
      if (res.ok) {
        const data = await res.json();
        if (data[0]?.junction) via = data[0].junction;
      }
    } catch (_) {}
    set({ alternateRoute: { from, to, via: `avoid ${via}` } });
  },
}));

// ─── Voice Store ──────────────────────────────────────────────────────────────

interface VoiceState {
  session: VoiceSession | null;
  persona: VoicePersona;
  isOpen: boolean;
  isListening: boolean;
  transcript: string;
  lastResponse: VoiceCommandResponse | null;
  history: Array<{ role: "user" | "assistant"; text: string }>;
  setPersona: (persona: VoicePersona) => void;
  setOpen: (open: boolean) => void;
  setListening: (listening: boolean) => void;
  setSession: (session: VoiceSession | null) => void;
  setTranscript: (text: string) => void;
  setLastResponse: (response: VoiceCommandResponse | null) => void;
  addHistory: (role: "user" | "assistant", text: string) => void;
  reset: () => void;
}

export const useVoiceStore = create<VoiceState>((set) => ({
  session: null,
  persona: "police",
  isOpen: false,
  isListening: false,
  transcript: "",
  lastResponse: null,
  history: [],
  setPersona: (persona) => set({ persona }),
  setOpen: (open) => set({ isOpen: open }),
  setListening: (listening) => set({ isListening: listening }),
  setSession: (session) => set({ session }),
  setTranscript: (text) => set({ transcript: text }),
  setLastResponse: (response) => set({ lastResponse: response }),
  addHistory: (role, text) =>
    set((s) => ({ history: [...s.history, { role, text }].slice(-20) })),
  reset: () =>
    set({ session: null, isListening: false, transcript: "", lastResponse: null, history: [] }),
}));
