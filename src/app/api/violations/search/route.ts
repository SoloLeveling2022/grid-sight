import { NextResponse } from "next/server";
import {
  getViolationsByPlate,
  getViolationsByStation,
  getViolationsByJunction,
  getViolationsByStatus,
  searchViolations,
} from "@/data/violations";
import type { ValidationStatus } from "@/types";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const plate = searchParams.get("plate");
  const query = searchParams.get("query");
  const station = searchParams.get("station");
  const junction = searchParams.get("junction");
  const status = searchParams.get("status");

  try {
    if (plate) {
      return NextResponse.json(getViolationsByPlate(plate));
    }
    if (station) {
      return NextResponse.json(getViolationsByStation(station));
    }
    if (junction) {
      return NextResponse.json(getViolationsByJunction(junction));
    }
    if (status) {
      return NextResponse.json(getViolationsByStatus(status as ValidationStatus));
    }
    if (query) {
      return NextResponse.json(searchViolations(query));
    }
    return NextResponse.json({ error: "Provide plate, station, junction, status, or query parameter" }, { status: 400 });
  } catch (error) {
    console.error("Search error:", error);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
