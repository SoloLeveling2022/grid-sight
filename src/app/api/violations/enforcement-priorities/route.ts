import { NextResponse } from "next/server";
import { getEnforcementPriorities } from "@/data/violations";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get("limit") || "20", 10);
  const priority = searchParams.get("priority");

  try {
    let priorities = getEnforcementPriorities(Math.min(limit, 200));
    
    if (priority) {
      priorities = priorities.filter((p) => p.priority === priority);
    }

    return NextResponse.json({
      data: priorities,
      meta: {
        total: priorities.length,
        limit,
        priorityFilter: priority || "all",
      },
    });
  } catch (error) {
    console.error("Enforcement priorities fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch enforcement priorities" }, { status: 500 });
  }
}
