import { NextResponse } from "next/server";
import { getRepeatOffenders } from "@/data/violations";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get("limit") || "20", 10);
  const minCases = parseInt(searchParams.get("minCases") || "2", 10);

  try {
    const offenders = getRepeatOffenders(Math.min(limit, 500))
      .filter((o) => o.caseCount >= minCases);

    return NextResponse.json({
      data: offenders,
      meta: {
        total: offenders.length,
        limit,
        minCasesFilter: minCases,
      },
    });
  } catch (error) {
    console.error("Repeat offenders fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch repeat offenders" }, { status: 500 });
  }
}
