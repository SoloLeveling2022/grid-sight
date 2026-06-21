/**
 * Pure utility functions for the violations domain.
 * No static JSON imports — all data comes from FastAPI via the Zustand store.
 */
import type {
  Hotspot,
  JunctionViolationHotspot,
  Severity,
} from "@/types";

/**
 * Convert JunctionViolationHotspot[] (from FastAPI /api/ml/hotspots) into
 * Hotspot[] shapes expected by the map component.
 */
export function toMapHotspots(hotspots: JunctionViolationHotspot[]): Hotspot[] {
  return hotspots.map((h, index) => ({
    id: `violation-hotspot-${index}`,
    name: h.junctionName === "No Junction" ? h.policeStation : h.junctionName,
    corridor: h.policeStation,
    latitude: h.latitude,
    longitude: h.longitude,
    incidentCount: h.violationCount,
    highPriorityCount:
      h.enforcementPriority === "severe" || h.enforcementPriority === "high"
        ? h.violationCount
        : 0,
    hotspotScore: Math.min(1, h.violationCount / 120),
    recurrenceProbability: Math.min(
      0.98,
      h.uniqueVehicles / Math.max(h.violationCount, 1) + 0.2
    ),
    topCauses: h.topViolationTypes,
    severity: h.enforcementPriority,
    zone: h.policeStation,
    dominantViolationType: h.dominantViolationType,
    peakHours: h.peakHours,
    repeatFrequency: h.repeatFrequency,
    nearbySensitivePlaces: h.nearbySensitivePlaces,
    estimatedSpeedDrop: h.estimatedSpeedDrop,
    expectedDelayMinutes: h.expectedDelayMinutes,
    congestionScore: h.congestionScore,
    affectedRoad: h.affectedRoad,
    confidence: h.confidence,
    evidenceSource: h.evidenceSource,
    patrolDispatched: h.patrolDispatched,
    actionTaken: h.actionTaken,
    caseClosed: h.caseClosed,
    expectedDelayReduction: h.expectedDelayReduction,
    scoreReduced: h.scoreReduced,
  }));
}

// ── helpers kept for any legacy call sites ────────────────────────────────────

function _priority(count: number): Severity {
  if (count >= 80) return "severe";
  if (count >= 40) return "high";
  if (count >= 15) return "medium";
  return "low";
}

export { _priority as priorityFromCount };
