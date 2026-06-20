import { NextResponse } from "next/server";
import { mlService } from "@/services/ml/mock-ml-service";
import type { EnforcementPrioritizationRequest, RecommendationRequest } from "@/types/ml";

export async function POST(request: Request) {
  const body = (await request.json()) as RecommendationRequest & EnforcementPrioritizationRequest;
  const [recommendations, enforcement] = await Promise.all([
    mlService.generateRecommendations(body),
    mlService.prioritizeEnforcement(body),
  ]);
  return NextResponse.json({ ...recommendations, enforcement: enforcement.items });
}

export async function GET() {
  const result = await mlService.prioritizeEnforcement({ limit: 8 });
  return NextResponse.json(result);
}
