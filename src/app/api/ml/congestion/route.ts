import { NextResponse } from "next/server";
import { mlService } from "@/services/ml/mock-ml-service";
import type { CongestionPredictionRequest } from "@/types/ml";

export async function POST(request: Request) {
  const body = (await request.json()) as CongestionPredictionRequest;
  const result = await mlService.predictCongestion(body);
  return NextResponse.json(result);
}

export async function GET() {
  const summaries = await mlService.getCongestionSummaries();
  return NextResponse.json({ summaries });
}
