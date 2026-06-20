import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id") || "";

    const apiKey = process.env.RINGG_API_KEY?.trim() ?? "";

    // 1. Handle simulated execution flow
    if (id.startsWith("sim-") || !apiKey) {
      // Parse timestamp and role
      const parts = id.split("-");
      const role = parts[1] === "citizen" ? "citizen" : "police";
      const timestamp = Number(parts[parts.length - 1]) || Date.now();
      const elapsed = Date.now() - timestamp;

      let status = "ringing";
      let transcript = "";
      let duration = 0;

      if (elapsed < 8000) {
        status = "ringing";
      } else if (elapsed < 20000) {
        status = "talking";
      } else if (elapsed < 26000) {
        status = "transcribing";
      } else {
        status = "completed";
        duration = 24;
        if (role === "police") {
          transcript = `Officer: "GridSight voice dispatch, what is the status of the Outer Ring Road corridor?"\n` +
            `AI: "Outer Ring Road currently has an active breakdown near KR Puram. The congestion impact score is 87%, and towing recommendations have been dispatched to enforcement patrols."\n` +
            `Officer: "Understood. Has the citizen advisory been updated?"\n` +
            `AI: "Yes, citizen advisory is live suggesting Inner Ring Road detour, which has a 12-minute bypass saving. Active patrols are notified."\n` +
            `Officer: "Excellent, thank you."\n` +
            `AI: "Officer dispatched. Session closed."`;
        } else {
          transcript = `Citizen: "Hi, I am driving near KR Puram. Is the main road blocked?"\n` +
            `AI: "Hello. There is a vehicle breakdown blocking one lane on the Outer Ring Road. Expect a delay of 20 minutes."\n` +
            `Citizen: "Oh no, is there an alternate route?"\n` +
            `AI: "Yes, taking the Inner Ring Road bypass is clear and saves about 12 minutes of delay."\n` +
            `Citizen: "Great, thanks! I'll take that route."\n` +
            `AI: "Safe travels. Road advisory updated."`;
        }
      }

      return NextResponse.json({
        success: true,
        status,
        duration,
        transcript,
        id,
      });
    }

    // 2. Fetch live data from Ringg API
    const response = await fetch("https://prod-api.ringg.ai/ca/api/v0/calling/history", {
      method: "GET",
      headers: {
        "X-API-KEY": apiKey,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Ringg AI API history returned code ${response.status}`);
    }

    const data = await response.json();
    const calls = Array.isArray(data) ? data : (data.calls || []);

    // Find call matching current execution/call ID
    const call = calls.find((c: any) => String(c.id) === id || String(c.execution_id) === id);

    if (!call) {
      // If we made a live call but it hasn't appeared in history yet, return queued/ringing status
      return NextResponse.json({
        success: true,
        status: "ringing",
        duration: 0,
        transcript: "",
        id,
      });
    }

    return NextResponse.json({
      success: true,
      status: call.status || "ringing",
      duration: call.duration || 0,
      transcript: call.transcript || "",
      id: call.id || id,
    });
  } catch (error: any) {
    console.error("Fetch call status error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to retrieve call status",
      },
      { status: 500 }
    );
  }
}
