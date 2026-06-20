import rawData from "@/data/processed-violations.json";
import type {
  DeviceProductivity,
  EnforcementPriorityItem,
  Hotspot,
  JunctionViolationHotspot,
  RepeatOffender,
  Severity,
  StationSummary,
  ValidationStatus,
  ViolationCase,
  ViolationDataset,
} from "@/types";

export const violationDataset = rawData as ViolationDataset;

const cases = violationDataset.cases;

function countBy<T extends string>(items: T[]): Array<[T, number]> {
  const counts = new Map<T, number>();
  for (const item of items) counts.set(item, (counts.get(item) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

function mode(items: string[]): string {
  return countBy(items.filter(Boolean))[0]?.[0] ?? "Unknown";
}

function priorityFromCount(count: number): Severity {
  if (count >= 80) return "severe";
  if (count >= 40) return "high";
  if (count >= 15) return "medium";
  return "low";
}

function sensitiveZoneFlags(name: string, location = ""): string[] {
  const text = `${name} ${location}`.toLowerCase();
  const flags: string[] = [];
  if (text.includes("school")) flags.push("near_school");
  if (text.includes("hospital") || text.includes("hosp")) flags.push("near_hospital");
  if (text.includes("bus stop") || text.includes("bus stand")) flags.push("near_bus_stop");
  if (text.includes("college")) flags.push("near_college");
  if (text.includes("crossing")) flags.push("near_crossing");
  return flags;
}

function scoreRepeatCases(group: ViolationCase[]): number {
  const severityBoost = group.flatMap((c) => c.violationTypes).some((type) => {
    const t = type.toLowerCase();
    return t.includes("main road") || t.includes("footpath") || t.includes("crossing") || t.includes("bus");
  })
    ? 20
    : 8;
  return Math.min(100, group.length * 12 + severityBoost + new Set(group.map((c) => c.policeStation)).size * 6);
}

export function getViolationMeta() {
  return violationDataset.meta;
}

export function getAllViolations(): ViolationCase[] {
  return cases;
}

export function getViolationsByPlate(plate: string): ViolationCase[] {
  const q = plate.trim().toLowerCase();
  if (!q) return [];
  return cases.filter(
    (c) =>
      c.vehicleNumber.toLowerCase().includes(q) ||
      (c.updatedVehicleNumber?.toLowerCase().includes(q) ?? false)
  );
}

export function getViolationsByStation(station: string): ViolationCase[] {
  return cases.filter((c) => c.policeStation === station);
}

export function getViolationsByJunction(junction: string): ViolationCase[] {
  return cases.filter((c) => c.junctionName === junction);
}

export function getViolationsByStatus(status: ValidationStatus): ViolationCase[] {
  return cases.filter((c) => c.validationStatus === status);
}

export function getViolationsByType(violationType: string): ViolationCase[] {
  return cases.filter((c) => c.violationTypes.includes(violationType));
}

export function searchViolations(query: string): ViolationCase[] {
  const q = query.trim().toLowerCase();
  if (!q) return cases;
  return cases.filter((c) =>
    [
      c.vehicleNumber,
      c.updatedVehicleNumber ?? "",
      c.location,
      c.policeStation,
      c.junctionName,
      c.vehicleType,
      ...c.violationTypes,
    ]
      .join(" ")
      .toLowerCase()
      .includes(q)
  );
}

export function getValidationQueue(): ViolationCase[] {
  return cases.filter((c) => c.validationStatus !== "approved");
}

export function getPendingQueue(): ViolationCase[] {
  return getViolationsByStatus("pending");
}

export function getDuplicateQueue(): ViolationCase[] {
  return getViolationsByStatus("duplicate");
}

export function getViolationTypes(): string[] {
  return [...new Set(cases.flatMap((c) => c.violationTypes))].sort();
}

export function getViolationTypeDistribution(): Record<string, number> {
  return Object.fromEntries(countBy(cases.flatMap((c) => c.violationTypes)));
}

export function getStationList(): string[] {
  return [...new Set(cases.map((c) => c.policeStation))].sort();
}

export function getJunctionList(): string[] {
  return [...new Set(cases.map((c) => c.junctionName))].sort();
}

export function getRepeatOffenders(limit?: number): RepeatOffender[] {
  const byPlate = new Map<string, ViolationCase[]>();
  for (const c of cases) {
    if (c.vehicleNumber === "UNKNOWN") continue;
    byPlate.set(c.vehicleNumber, [...(byPlate.get(c.vehicleNumber) ?? []), c]);
  }

  const offenders = [...byPlate.entries()]
    .filter(([, group]) => group.length >= 2)
    .map(([vehicleNumber, group]) => ({
      vehicleNumber,
      vehicleType: mode(group.map((c) => c.updatedVehicleType ?? c.vehicleType)),
      caseCount: group.length,
      violationTypes: [...new Set(group.flatMap((c) => c.violationTypes))],
      policeStations: [...new Set(group.map((c) => c.policeStation))],
      locations: [...new Set(group.map((c) => c.location))].slice(0, 4),
      firstSeen: group.reduce((first, c) => (c.createdDatetime < first ? c.createdDatetime : first), group[0].createdDatetime),
      lastSeen: group.reduce((last, c) => (c.createdDatetime > last ? c.createdDatetime : last), group[0].createdDatetime),
      mostFrequentJunction: mode(group.map((c) => c.junctionName)),
      enforcementScore: scoreRepeatCases(group),
    }))
    .sort((a, b) => b.enforcementScore - a.enforcementScore);

  return limit ? offenders.slice(0, limit) : offenders;
}

export function getJunctionHotspots(limit?: number): JunctionViolationHotspot[] {
  const byJunction = new Map<string, ViolationCase[]>();
  for (const c of cases) {
    const key = `${c.junctionName}|${c.policeStation}`;
    byJunction.set(key, [...(byJunction.get(key) ?? []), c]);
  }

  const hotspots = [...byJunction.entries()]
    .map(([, group]) => ({
      junctionName: group[0].junctionName,
      policeStation: group[0].policeStation,
      violationCount: group.length,
      uniqueVehicles: new Set(group.map((c) => c.vehicleNumber)).size,
      topViolationTypes: countBy(group.flatMap((c) => c.violationTypes)).slice(0, 3).map(([type]) => type),
      topVehicleTypes: countBy(group.map((c) => c.updatedVehicleType ?? c.vehicleType)).slice(0, 3).map(([type]) => type),
      latitude: group.reduce((sum, c) => sum + c.latitude, 0) / group.length,
      longitude: group.reduce((sum, c) => sum + c.longitude, 0) / group.length,
      enforcementPriority: priorityFromCount(group.length),
    }))
    .sort((a, b) => b.violationCount - a.violationCount);

  return limit ? hotspots.slice(0, limit) : hotspots;
}

export function getStationViolationSummary(): StationSummary[] {
  const byStation = new Map<string, ViolationCase[]>();
  for (const c of cases) byStation.set(c.policeStation, [...(byStation.get(c.policeStation) ?? []), c]);

  return [...byStation.entries()]
    .map(([policeStation, group]) => {
      const approvedCases = group.filter((c) => c.validationStatus === "approved").length;
      return {
        policeStation,
        totalCases: group.length,
        approvedCases,
        pendingCases: group.filter((c) => c.validationStatus === "pending").length,
        duplicateCases: group.filter((c) => c.validationStatus === "duplicate").length,
        approvalRate: Math.round((approvedCases / group.length) * 100),
        topViolationType: mode(group.flatMap((c) => c.violationTypes)),
      };
    })
    .sort((a, b) => b.totalCases - a.totalCases);
}

export function getDeviceProductivity(): DeviceProductivity[] {
  const byDevice = new Map<string, ViolationCase[]>();
  for (const c of cases) byDevice.set(c.deviceId, [...(byDevice.get(c.deviceId) ?? []), c]);

  return [...byDevice.entries()]
    .map(([deviceId, group]) => {
      const approvedCases = group.filter((c) => c.validationStatus === "approved").length;
      return {
        deviceId,
        totalCasesCaptured: group.length,
        approvedCases,
        rejectedCases: group.filter((c) => c.validationStatus === "rejected").length,
        pendingCases: group.filter((c) => c.validationStatus === "pending").length,
        approvalRate: Math.round((approvedCases / group.length) * 100),
        lastActiveDate: group.reduce((last, c) => (c.createdDatetime > last ? c.createdDatetime : last), group[0].createdDatetime),
        mostCommonViolation: mode(group.flatMap((c) => c.violationTypes)),
        mostCommonStation: mode(group.map((c) => c.policeStation)),
      };
    })
    .sort((a, b) => b.totalCasesCaptured - a.totalCasesCaptured);
}

export function getEnforcementPriorities(limit?: number): EnforcementPriorityItem[] {
  const repeatJunctions = new Set(getRepeatOffenders().map((o) => o.mostFrequentJunction));
  const priorities: EnforcementPriorityItem[] = getJunctionHotspots().map((hotspot) => {
    const flags = sensitiveZoneFlags(hotspot.junctionName);
    const repeatOffenderCount = repeatJunctions.has(hotspot.junctionName) ? Math.ceil(hotspot.uniqueVehicles * 0.12) : 0;
    const openCases = getViolationsByJunction(hotspot.junctionName).filter((c) => c.validationStatus !== "approved").length;
    const score = Math.min(
      100,
      hotspot.violationCount * 0.75 + repeatOffenderCount * 4 + flags.length * 8 + openCases * 0.25
    );
    const priority: Severity = score >= 80 ? "severe" : score >= 55 ? "high" : score >= 30 ? "medium" : "low";
    const suggestedAction: EnforcementPriorityItem["suggestedAction"] =
      priority === "severe" ? "tow" : priority === "high" ? "patrol" : priority === "medium" ? "camera" : "monitor";
    return {
      junction: hotspot.junctionName,
      policeStation: hotspot.policeStation,
      score: Math.round(score),
      priority,
      openCases,
      repeatOffenderCount,
      sensitiveZoneFlags: flags,
      suggestedAction,
    };
  });

  const sorted = priorities.sort((a, b) => b.score - a.score);
  return limit ? sorted.slice(0, limit) : sorted;
}

export function toMapHotspots(hotspots: JunctionViolationHotspot[]): Hotspot[] {
  return hotspots.map((h, index) => ({
    id: `violation-hotspot-${index}`,
    name: h.junctionName === "No Junction" ? h.policeStation : h.junctionName,
    corridor: h.policeStation,
    latitude: h.latitude,
    longitude: h.longitude,
    incidentCount: h.violationCount,
    highPriorityCount: h.enforcementPriority === "severe" || h.enforcementPriority === "high" ? h.violationCount : 0,
    hotspotScore: Math.min(1, h.violationCount / 120),
    recurrenceProbability: Math.min(0.98, h.uniqueVehicles / Math.max(h.violationCount, 1) + 0.2),
    topCauses: h.topViolationTypes,
    severity: h.enforcementPriority,
    zone: h.policeStation,
  }));
}
