import {
  BENGALURU_BOUNDS,
  BENGALURU_CENTER,
  type IMapProvider,
  type MapBounds,
  type MapCoordinate,
  type MapMarker,
  type MapProviderConfig,
  type MapViewport,
} from "@/types/map";

export class MockMapProvider implements IMapProvider {
  readonly name = "mock";

  async initialize(config: MapProviderConfig): Promise<void> {
    void config;
    return;
  }

  getDefaultViewport(): MapViewport {
    return { center: BENGALURU_CENTER, zoom: 12 };
  }

  projectToScreen(
    coord: MapCoordinate,
    _viewport: MapViewport,
    size: { width: number; height: number }
  ): { x: number; y: number } {
    const { north, south, west, east } = BENGALURU_BOUNDS;
    const x = ((coord.longitude - west) / (east - west)) * size.width;
    const y = ((north - coord.latitude) / (north - south)) * size.height;
    return { x, y };
  }

  fitBounds(bounds: MapBounds): MapViewport {
    return {
      center: {
        latitude: (bounds.north + bounds.south) / 2,
        longitude: (bounds.east + bounds.west) / 2,
      },
      zoom: 13,
    };
  }

  renderMarkers(markers: MapMarker[]): MapMarker[] {
    return markers;
  }
}

/** Future MapmyIndia integration — implement IMapProvider with SDK calls */
export class MapmyIndiaMapProvider implements IMapProvider {
  readonly name = "mapmyindia";
  private apiKey: string | null = null;

  async initialize(config: MapProviderConfig): Promise<void> {
    if (!config.apiKey) {
      throw new Error("MapmyIndia API key required");
    }
    this.apiKey = config.apiKey;
  }

  getDefaultViewport(): MapViewport {
    return { center: BENGALURU_CENTER, zoom: 12 };
  }

  projectToScreen(
    coord: MapCoordinate,
    _viewport: MapViewport,
    size: { width: number; height: number }
  ): { x: number; y: number } {
    const { north, south, west, east } = BENGALURU_BOUNDS;
    const x = ((coord.longitude - west) / (east - west)) * size.width;
    const y = ((north - coord.latitude) / (north - south)) * size.height;
    return { x, y };
  }

  fitBounds(bounds: MapBounds): MapViewport {
    return {
      center: {
        latitude: (bounds.north + bounds.south) / 2,
        longitude: (bounds.east + bounds.west) / 2,
      },
      zoom: 13,
    };
  }
}

export function createMapProvider(type: "mock" | "mapmyindia" = "mock"): IMapProvider {
  return type === "mapmyindia" ? new MapmyIndiaMapProvider() : new MockMapProvider();
}

export function coordToPercent(coord: MapCoordinate): { left: number; top: number } {
  const { north, south, west, east } = BENGALURU_BOUNDS;
  return {
    left: ((coord.longitude - west) / (east - west)) * 100,
    top: ((north - coord.latitude) / (north - south)) * 100,
  };
}
