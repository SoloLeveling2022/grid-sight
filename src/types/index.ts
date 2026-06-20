export type Severity = "low" | "medium" | "high" | "severe";
export type IncidentStatus = "active" | "closed" | "resolved";
export type EventType = "planned" | "unplanned";
export type Priority = "High" | "Low";
export type ZoneType = "commercial" | "metro" | "event" | "residential" | "other";
export type CarriagewayImpact = "partial" | "full";
export type EnforcementAction = "tow" | "patrol" | "barricade" | "camera";
export type ValidationStatus = "pending" | "approved" | "rejected" | "duplicate" | "processing";

export interface Incident {
  id: string;
  eventType: EventType;
  latitude: number;
  longitude: number;
  endLatitude: number | null;
  endLongitude: number | null;
  address: string;
  eventCause: string;
  requiresRoadClosure: boolean;
  startDatetime: string;
  endDatetime: string | null;
  status: IncidentStatus;
  description: string | null;
  vehType: string | null;
  corridor: string;
  priority: Priority;
  policeStation: string;
  zone: string | null;
  junction: string | null;
  impactScore: number;
  severity: Severity;
  resolutionMinutes: number | null;
}

export interface Hotspot {
  id: string;
  name: string;
  corridor: string;
  latitude: number;
  longitude: number;
  incidentCount: number;
  highPriorityCount: number;
  hotspotScore: number;
  recurrenceProbability: number;
  topCauses: string[];
  severity: Severity;
  zone: string | null;
}

export interface JunctionHotspot {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  incidentCount: number;
  hotspotScore: number;
  corridor: string;
  severity: Severity;
}

export interface ZoneSummary {
  id: string;
  name: string;
  incidentCount: number;
  activeCount: number;
  avgImpactScore: number;
  latitude: number;
  longitude: number;
  topCorridor: string | null;
}

export interface Recommendation {
  id: string;
  hotspotId: string;
  corridor: string;
  type: "tow_recommendation" | "barricade_recommendation" | "patrol_dispatch" | "monitor" | "diversion";
  priority: Severity;
  enforcementScore: number;
  title: string;
  description: string;
  latitude: number;
  longitude: number;
}

export interface Alert {
  id: string;
  incidentId: string;
  type: string;
  severity: Severity;
  title: string;
  message: string;
  latitude: number;
  longitude: number;
  timestamp: string;
}

export interface CongestionSummary {
  corridor: string;
  totalIncidents: number;
  activeIncidents: number;
  avgImpactScore: number;
  congestionLevel: Severity;
  expectedDelayMinutes: number;
  latitude: number;
  longitude: number;
}

export interface AnalyticsData {
  hourlyDistribution: Record<string, number>;
  weekdayDistribution: Record<string, number>;
  causeDistribution: Record<string, number>;
  corridorDistribution: Record<string, number>;
  statusDistribution: Record<string, number>;
  severityDistribution: Record<string, number>;
  avgResolutionMinutes: number | null;
}

// ─── Parking Intelligence Types ───────────────────────────────────────────────

/** A single parking/obstruction event derived from an ASTram OBSTRUCTION record. */
export interface ParkingViolation {
  id: string;
  sourceIncidentId: string;
  latitude: number;
  longitude: number;
  corridor: string;
  zone: string | null;
  zoneType: ZoneType;
  policeStation: string;
  vehicleType: string | null;
  dwellMinutes: number | null;
  carriagewayImpact: CarriagewayImpact;
  carriagewayReductionPct: number;
  peakHour: number;
  severity: Severity;
  impactScore: number;
  timestamp: string;
  status: string;
  address: string;
  requiresRoadClosure: boolean;
}

/** A cluster of parking violations within a 200m radius. */
export interface ParkingHotspot {
  id: string;
  name: string;
  corridor: string;
  latitude: number;
  longitude: number;
  zoneType: ZoneType;
  violationCount: number;
  avgDwellMinutes: number | null;
  carriagewayReductionPct: number;
  congestionImpactScore: number;
  enforcementPriority: Severity;
  topVehicleType: string;
  peakHours: number[];
  recurrenceProbability: number;
  severity: Severity;
  memberViolationIds: string[];
}

/** An enforcement zone grouping hotspots under a single police station. */
export interface EnforcementZone {
  id: string;
  name: string;
  policeStation: string;
  hotspotIds: string[];
  totalViolations: number;
  avgCongestionImpact: number;
  rank: number;
  suggestedAction: EnforcementAction;
  peakPatrolWindow: string;
  enforcementPriority: Severity;
  latitude: number;
  longitude: number;
}

/** A parking-specific enforcement recommendation. */
export interface ParkingRecommendation {
  id: string;
  hotspotId: string;
  corridor: string;
  type: "tow_recommendation" | "patrol_dispatch" | "monitor";
  priority: Severity;
  enforcementScore: number;
  title: string;
  description: string;
  latitude: number;
  longitude: number;
  zoneType: ZoneType;
  carriagewayReductionPct: number;
  avgDwellMinutes: number | null;
}

// ─────────────────────────────────────────────────────────────────────────────

export interface DatasetMeta {
  totalIncidents: number;
  activeIncidents: number;
  dateRange: { start: string; end: string };
  corridors: number;
  zones: number;
  junctions: number;
  parkingViolations: number;
  parkingHotspots: number;
  enforcementZones: number;
}

export interface ProcessedDataset {
  meta: DatasetMeta;
  incidents: Incident[];
  hotspots: Hotspot[];
  junctionHotspots: JunctionHotspot[];
  zones: ZoneSummary[];
  recommendations: Recommendation[];
  alerts: Alert[];
  congestionSummaries: CongestionSummary[];
  analytics: AnalyticsData;
  // Parking intelligence
  parkingViolations: ParkingViolation[];
  parkingHotspots: ParkingHotspot[];
  enforcementZones: EnforcementZone[];
  parkingRecommendations: ParkingRecommendation[];
}

export interface ViolationCase {
  id: string;
  latitude: number;
  longitude: number;
  location: string;
  vehicleNumber: string;
  updatedVehicleNumber: string | null;
  vehicleType: string;
  updatedVehicleType: string | null;
  violationTypes: string[];
  offenceCodes: number[];
  deviceId: string;
  policeStation: string;
  junctionName: string;
  createdDatetime: string;
  closedDatetime: string | null;
  modifiedDatetime: string | null;
  validationStatus: ValidationStatus;
  validationTimestamp: string | null;
  actionTakenTimestamp: string | null;
  dataSentToScita: boolean;
  createdBy: string;
  centerCode: string;
  description: string | null;
}

export interface ViolationDatasetMeta {
  totalCases: number;
  sampledCases: number;
  source: string;
  dateRange: { start: string; end: string };
  topStations: Array<[string, number]>;
  topViolationTypes: Array<[string, number]>;
  statusCounts: Partial<Record<ValidationStatus, number>>;
}

export interface ViolationDataset {
  meta: ViolationDatasetMeta;
  cases: ViolationCase[];
}

export interface RepeatOffender {
  vehicleNumber: string;
  vehicleType: string;
  caseCount: number;
  violationTypes: string[];
  policeStations: string[];
  locations: string[];
  firstSeen: string;
  lastSeen: string;
  mostFrequentJunction: string;
  enforcementScore: number;
}

export interface JunctionViolationHotspot {
  junctionName: string;
  policeStation: string;
  violationCount: number;
  uniqueVehicles: number;
  topViolationTypes: string[];
  topVehicleTypes: string[];
  latitude: number;
  longitude: number;
  enforcementPriority: Severity;
}

export interface StationSummary {
  policeStation: string;
  totalCases: number;
  approvedCases: number;
  pendingCases: number;
  duplicateCases: number;
  approvalRate: number;
  topViolationType: string;
}

export interface DeviceProductivity {
  deviceId: string;
  totalCasesCaptured: number;
  approvedCases: number;
  rejectedCases: number;
  pendingCases: number;
  approvalRate: number;
  lastActiveDate: string;
  mostCommonViolation: string;
  mostCommonStation: string;
}

export interface EnforcementPriorityItem {
  junction: string;
  policeStation: string;
  score: number;
  priority: Severity;
  openCases: number;
  repeatOffenderCount: number;
  sensitiveZoneFlags: string[];
  suggestedAction: "monitor" | "patrol" | "tow" | "camera";
}

export * from "./map";
export * from "./ml";
export * from "./voice";
