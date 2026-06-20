import { NextResponse } from "next/server";
import {
  getViolationMeta,
  getViolationTypeDistribution,
  getStationList,
  getStationViolationSummary,
  getDeviceProductivity,
} from "@/data/violations";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const includeAll = searchParams.get("detailed") === "true";

  try {
    const meta = getViolationMeta();
    const typeDistribution = getViolationTypeDistribution();
    const stationSummary = getStationViolationSummary();
    const deviceProductivity = getDeviceProductivity();

    const response: any = {
      meta,
      typeDistribution,
      stations: stationSummary.slice(0, 20),
      devices: deviceProductivity.slice(0, 20),
    };

    if (includeAll) {
      response.allStations = stationSummary;
      response.allDevices = deviceProductivity;
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error("Stats fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch statistics" }, { status: 500 });
  }
}
