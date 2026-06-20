import { NextResponse } from "next/server";
import { mlService } from "@/services/ml/mock-ml-service";
import type { HotspotScoreRequest } from "@/types/ml";

export async function POST(request: Request) {
  const body = (await request.json()) as HotspotScoreRequest;
  const result = await mlService.scoreHotspot(body);
  return NextResponse.json(result);
}

export async function GET() {
  const hotspots = await mlService.getHotspotRankings(10);
  return NextResponse.json({ hotspots });
}
