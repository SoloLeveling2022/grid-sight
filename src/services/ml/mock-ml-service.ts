import {
  getCongestionSummaries,
  getHotspots,
  getIncidentById,
  getRecommendations,
} from "@/data";
import type {
  CongestionPredictionRequest,
  CongestionPredictionResult,
  DelayEstimationRequest,
  DelayEstimationResult,
  EnforcementPrioritizationRequest,
  EnforcementPrioritizationResult,
  HotspotScoreRequest,
  HotspotScoreResult,
  IMLService,
  RecommendationRequest,
  RecommendationResult,
} from "@/types/ml";
import type { Hotspot, Incident } from "@/types";

function nearestHotspot(lat: number, lon: number): Hotspot | undefined {
  return getHotspots().sort((a, b) => {
    const da = (a.latitude - lat) ** 2 + (a.longitude - lon) ** 2;
    const db = (b.latitude - lat) ** 2 + (b.longitude - lon) ** 2;
    return da - db;
  })[0];
}

export class MockMLService implements IMLService {
  async scoreHotspot(request: HotspotScoreRequest): Promise<HotspotScoreResult> {
    const hs = nearestHotspot(request.latitude, request.longitude);
    return {
      hotspotClusterId: hs?.id ?? null,
      hotspotScore: hs?.hotspotScore ?? 0.35,
      recurrenceProbability: hs?.recurrenceProbability ?? 0.2,
      affectedCorridors: hs ? [hs.corridor] : [request.corridor ?? "Non-corridor"],
      severity: hs?.severity ?? "medium",
    };
  }

  async predictCongestion(
    request: CongestionPredictionRequest
  ): Promise<CongestionPredictionResult> {
    const summary = getCongestionSummaries().find((c) => c.corridor === request.corridor);
    const horizon = request.horizonMinutes ?? 30;
    const worsening = (summary?.activeIncidents ?? 0) > 2;
    const predicted = worsening ? "high" : summary?.congestionLevel ?? "medium";

    return {
      corridor: request.corridor,
      currentSeverity: summary?.congestionLevel ?? "medium",
      predictedSeverity: predicted as CongestionPredictionResult["predictedSeverity"],
      expectedDelayMinutes: (summary?.expectedDelayMinutes ?? 10) + Math.floor(horizon / 10),
      roadBlockRisk: summary?.activeIncidents ? Math.min(0.95, summary.activeIncidents * 0.15) : 0.2,
      enforcementPriorityScore: Math.round((summary?.avgImpactScore ?? 0.5) * 100),
      trend: worsening ? "worsening" : "stable",
    };
  }

  async estimateDelay(request: DelayEstimationRequest): Promise<DelayEstimationResult> {
    const dist =
      Math.sqrt(
        (request.destLat - request.originLat) ** 2 + (request.destLon - request.originLon) ** 2
      ) * 111;
    const base = Math.max(8, Math.round(dist * 3));
    const summary = getCongestionSummaries().find((c) => c.corridor === request.corridor);
    const delay = summary?.expectedDelayMinutes ?? 5;
    return {
      baseMinutes: base,
      congestionDelayMinutes: delay,
      totalMinutes: base + delay,
      confidence: 0.82,
    };
  }

  async prioritizeEnforcement(
    request: EnforcementPrioritizationRequest
  ): Promise<EnforcementPrioritizationResult> {
    const recs = getRecommendations()
      .filter((r) => !request.corridor || r.corridor === request.corridor)
      .slice(0, request.limit ?? 10);

    return {
      items: recs.map((r) => ({
        id: r.id,
        corridor: r.corridor,
        enforcementScore: r.enforcementScore,
        recommendedAction: r.type.replace(/_/g, " "),
        rationale: r.description,
      })),
    };
  }

  async generateRecommendations(request: RecommendationRequest): Promise<RecommendationResult> {
    let recs = getRecommendations();
    if (request.hotspotId) {
      recs = recs.filter((r) => r.hotspotId === request.hotspotId);
    }
    if (request.corridor) {
      recs = recs.filter((r) => r.corridor === request.corridor);
    }
    if (request.incidentId) {
      const inc = getIncidentById(request.incidentId);
      if (inc) recs = recs.filter((r) => r.corridor === inc.corridor);
    }
    return { recommendations: recs };
  }

  async batchScoreIncidents(incidents: Incident[]): Promise<Map<string, number>> {
    return new Map(incidents.map((i) => [i.id, i.impactScore]));
  }

  async getHotspotRankings(limit = 10): Promise<Hotspot[]> {
    return getHotspots(limit);
  }

  async getCongestionSummaries() {
    return getCongestionSummaries();
  }
}

export const mlService: IMLService = new MockMLService();
