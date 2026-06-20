import { NextResponse } from "next/server";
import { getJunctionHotspots } from "@/data/violations";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get("limit") || "20", 10);

  try {
    const hotspots = getJunctionHotspots(Math.min(limit, 200));
    return NextResponse.json({
      data: hotspots,
      meta: {
        total: hotspots.length,
        limit,
      },
    });
  } catch (error) {
    console.error("Hotspots fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch hotspots" }, { status: 500 });
  }
}
