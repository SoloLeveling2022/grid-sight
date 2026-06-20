import type { Hotspot, Incident, JunctionHotspot } from "./index";

export interface MapBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

export interface MapCoordinate {
  latitude: number;
  longitude: number;
}

export interface MapMarker {
  id: string;
  position: MapCoordinate;
  label?: string;
  severity?: string;
  type: "incident" | "hotspot" | "junction" | "zone" | "user";
  metadata?: Record<string, unknown>;
}

export interface MapLayer {
  id: string;
  name: string;
  visible: boolean;
  type: "heatmap" | "markers" | "corridor" | "zone";
}

export interface MapViewport {
  center: MapCoordinate;
  zoom: number;
}

export interface MapProviderConfig {
  apiKey?: string;
  provider: "mock" | "mapmyindia";
}

export interface IMapProvider {
  readonly name: string;
  initialize(config: MapProviderConfig): Promise<void>;
  getDefaultViewport(): MapViewport;
  projectToScreen(coord: MapCoordinate, viewport: MapViewport, size: { width: number; height: number }): { x: number; y: number };
  fitBounds(bounds: MapBounds): MapViewport;
  renderHeatmap?(points: MapCoordinate[], intensities: number[]): unknown;
  renderMarkers?(markers: MapMarker[]): unknown;
}

export interface MapSelection {
  type: "incident" | "hotspot" | "junction" | "corridor" | null;
  id: string | null;
  data?: Incident | Hotspot | JunctionHotspot | null;
}

export const BENGALURU_BOUNDS: MapBounds = {
  north: 13.15,
  south: 12.82,
  east: 77.78,
  west: 77.42,
};

export const BENGALURU_CENTER: MapCoordinate = {
  latitude: 12.9716,
  longitude: 77.5946,
};
