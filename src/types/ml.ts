import type { CongestionSummary, Hotspot, Incident, Recommendation, Severity } from "./index";

export interface HotspotScoreRequest {
  latitude: number;
  longitude: number;
  corridor?: string;
  eventCause?: string;
}

export interface HotspotScoreResult {
  hotspotClusterId: string | null;
  hotspotScore: number;
  recurrenceProbability: number;
  affectedCorridors: string[];
  severity: Severity;
}

export interface CongestionPredictionRequest {
  corridor: string;
  horizonMinutes?: number;
}

export interface CongestionPredictionResult {
  corridor: string;
  currentSeverity: Severity;
  predictedSeverity: Severity;
  expectedDelayMinutes: number;
  roadBlockRisk: number;
  enforcementPriorityScore: number;
  trend: "improving" | "stable" | "worsening";
}

export interface DelayEstimationRequest {
  originLat: number;
  originLon: number;
  destLat: number;
  destLon: number;
  corridor?: string;
}

export interface DelayEstimationResult {
  baseMinutes: number;
  congestionDelayMinutes: number;
  totalMinutes: number;
  confidence: number;
}

export interface EnforcementPrioritizationRequest {
  corridor?: string;
  zone?: string;
  limit?: number;
}

export interface EnforcementPrioritizationResult {
  items: Array<{
    id: string;
    corridor: string;
    enforcementScore: number;
    recommendedAction: string;
    rationale: string;
  }>;
}

export interface RecommendationRequest {
  incidentId?: string;
  hotspotId?: string;
  corridor?: string;
}

export interface RecommendationResult {
  recommendations: Recommendation[];
}

export interface IMLService {
  scoreHotspot(request: HotspotScoreRequest): Promise<HotspotScoreResult>;
  predictCongestion(request: CongestionPredictionRequest): Promise<CongestionPredictionResult>;
  estimateDelay(request: DelayEstimationRequest): Promise<DelayEstimationResult>;
  prioritizeEnforcement(request: EnforcementPrioritizationRequest): Promise<EnforcementPrioritizationResult>;
  generateRecommendations(request: RecommendationRequest): Promise<RecommendationResult>;
  batchScoreIncidents(incidents: Incident[]): Promise<Map<string, number>>;
  getHotspotRankings(limit?: number): Promise<Hotspot[]>;
  getCongestionSummaries(): Promise<CongestionSummary[]>;
}
