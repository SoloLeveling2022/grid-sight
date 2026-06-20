import rawData from "@/data/processed-data.json";
import type {
  Alert,
  CongestionSummary,
  Hotspot,
  Incident,
  JunctionHotspot,
  ProcessedDataset,
  Recommendation,
  ZoneSummary,
} from "@/types";

export const dataset = rawData as ProcessedDataset;

export function getMeta() {
  return dataset.meta;
}

export function getAllIncidents(): Incident[] {
  return dataset.incidents;
}

export function getActiveIncidents(): Incident[] {
  return dataset.incidents.filter((i) => i.status === "active");
}

export function getIncidentById(id: string): Incident | undefined {
  return dataset.incidents.find((i) => i.id === id);
}

export function getHotspots(limit?: number): Hotspot[] {
  return limit ? dataset.hotspots.slice(0, limit) : dataset.hotspots;
}

export function getJunctionHotspots(limit?: number): JunctionHotspot[] {
  return limit ? dataset.junctionHotspots.slice(0, limit) : dataset.junctionHotspots;
}

export function getZones(): ZoneSummary[] {
  return dataset.zones;
}

export function getRecommendations(): Recommendation[] {
  return dataset.recommendations;
}

export function getAlerts(): Alert[] {
  return dataset.alerts;
}

export function getCongestionSummaries(): CongestionSummary[] {
  return dataset.congestionSummaries;
}

export function getAnalytics() {
  return dataset.analytics;
}

export function getIncidentsByCorridor(corridor: string): Incident[] {
  return dataset.incidents.filter((i) => i.corridor === corridor);
}

export function getCorridors(): string[] {
  return [...new Set(dataset.incidents.map((i) => i.corridor))].sort();
}

export function searchIncidents(query: string): Incident[] {
  const q = query.toLowerCase();
  return dataset.incidents.filter(
    (i) =>
      i.address.toLowerCase().includes(q) ||
      i.corridor.toLowerCase().includes(q) ||
      i.eventCause.toLowerCase().includes(q) ||
      i.policeStation.toLowerCase().includes(q) ||
      (i.junction?.toLowerCase().includes(q) ?? false)
  );
}

export function getTopHotspotsNear(
  lat: number,
  lon: number,
  limit = 5
): Hotspot[] {
  return [...dataset.hotspots]
    .sort((a, b) => {
      const da = (a.latitude - lat) ** 2 + (a.longitude - lon) ** 2;
      const db = (b.latitude - lat) ** 2 + (b.longitude - lon) ** 2;
      return da - db;
    })
    .slice(0, limit);
}
