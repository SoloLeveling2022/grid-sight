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
} from "@/types";
import type { MapSelection } from "@/types/map";
import type { VoiceCommandResponse, VoiceSession, VoicePersona } from "@/types/voice";
import {
  getActiveIncidents,
  getAlerts,
  getCongestionSummaries,
  getHotspots,
  getRecommendations,
} from "@/data";
import {
  getAllViolations,
  getDeviceProductivity,
  getEnforcementPriorities,
  getJunctionHotspots as getViolationJunctionHotspots,
  getRepeatOffenders,
  searchViolations,
} from "@/data/violations";
import { fetchLiveTomTomIncidents, fetchTomTomFlowSegment, type FlowSegmentData } from "@/services/map/tomtom-sdk";

const tomtomApiKey = process.env.NEXT_PUBLIC_TOMTOM_API_KEY?.trim() ?? "";

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
  incidents: getActiveIncidents(),
  hotspots: getHotspots(),
  recommendations: getRecommendations(),
  alerts: getAlerts(),
  congestionSummaries: getCongestionSummaries(),
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
      set({
        liveIncidents: [],
        incidents: getActiveIncidents()
      });
    }
  },
  fetchLiveTraffic: async () => {
    if (!tomtomApiKey) {
      console.warn("No TomTom API Key found when fetching live traffic.");
      return;
    }
    set({ isFetchingLiveTraffic: true });
    try {
      const live = await fetchLiveTomTomIncidents(tomtomApiKey);
      set({
        liveIncidents: live,
        incidents: [...getActiveIncidents(), ...live]
      });
    } catch (e) {
      console.error("Store error fetching live traffic:", e);
    } finally {
      set({ isFetchingLiveTraffic: false });
    }
  },
  fetchSegmentFlow: async (lat, lng) => {
    if (!tomtomApiKey) return;
    set({ isFetchingSegmentFlow: true });
    try {
      const flow = await fetchTomTomFlowSegment(lat, lng, tomtomApiKey);
      set({ selectedSegmentFlow: flow });
    } catch (e) {
      console.error("Store error fetching flow segment:", e);
    } finally {
      set({ isFetchingSegmentFlow: false });
    }
  },
  refresh: () => {
    const useLive = get().useLiveTraffic;
    if (useLive && tomtomApiKey) {
      set({ isFetchingLiveTraffic: true });
      fetchLiveTomTomIncidents(tomtomApiKey)
        .then((live) => {
          set({
            liveIncidents: live,
            incidents: [...getActiveIncidents(), ...live],
            isFetchingLiveTraffic: false
          });
        })
        .catch((e) => {
          console.error("Error refreshing live traffic:", e);
          set({ isFetchingLiveTraffic: false });
        });
    } else {
      set({
        incidents: getActiveIncidents()
      });
    }
    set({
      hotspots: getHotspots(),
      recommendations: getRecommendations(),
      alerts: getAlerts(),
      congestionSummaries: getCongestionSummaries(),
    });
  }
}));

interface ViolationPoliceState {
  cases: ViolationCase[];
  junctions: JunctionViolationHotspot[];
  repeatOffenders: RepeatOffender[];
  deviceProductivity: DeviceProductivity[];
  enforcementPriorities: EnforcementPriorityItem[];
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
  approveCase: (id: string) => void;
  rejectCase: (id: string) => void;
  flagDuplicate: (id: string) => void;
  searchByPlate: (plate: string) => ViolationCase[];
}

function updateCaseStatus(cases: ViolationCase[], id: string, validationStatus: ValidationStatus): ViolationCase[] {
  const timestamp = new Date().toISOString();
  return cases.map((c) =>
    c.id === id
      ? {
          ...c,
          validationStatus,
          validationTimestamp: timestamp,
          actionTakenTimestamp: validationStatus === "approved" ? timestamp : c.actionTakenTimestamp,
        }
      : c
  );
}

export const useViolationPoliceStore = create<ViolationPoliceState>((set) => ({
  cases: getAllViolations(),
  junctions: getViolationJunctionHotspots(30),
  repeatOffenders: getRepeatOffenders(20),
  deviceProductivity: getDeviceProductivity().slice(0, 20),
  enforcementPriorities: getEnforcementPriorities(20),
  searchQuery: "",
  selectedViolationType: null,
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
  approveCase: (id) => set((s) => ({ cases: updateCaseStatus(s.cases, id, "approved") })),
  rejectCase: (id) => set((s) => ({ cases: updateCaseStatus(s.cases, id, "rejected") })),
  flagDuplicate: (id) => set((s) => ({ cases: updateCaseStatus(s.cases, id, "duplicate") })),
  searchByPlate: (plate) => searchViolations(plate).filter((c) => c.vehicleNumber.toLowerCase().includes(plate.toLowerCase())),
}));

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
  lookupPlate: (plate: string) => void;
  selectHotspot: (junction: string | null) => void;
  requestRoute: (from: string, to: string) => void;
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
  lookupPlate: (plate) =>
    set({
      plateSearchQuery: plate,
      plateSearchResults: plate.trim()
        ? getAllViolations().filter((c) =>
            [c.vehicleNumber, c.updatedVehicleNumber ?? ""].join(" ").toLowerCase().includes(plate.trim().toLowerCase())
          )
        : [],
    }),
  selectHotspot: (selectedHotspotJunction) => set({ selectedHotspotJunction }),
  requestRoute: (from, to) => {
    const via = getEnforcementPriorities(1)[0]?.junction ?? "Outer Ring Road";
    set({ alternateRoute: { from, to, via: `avoid ${via}` } });
  },
}));

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
    set({
      session: null,
      isListening: false,
      transcript: "",
      lastResponse: null,
      history: [],
    }),
}));
