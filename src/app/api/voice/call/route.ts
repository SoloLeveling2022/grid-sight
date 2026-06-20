import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    let phone = String(body.phone || "918019227239").trim();

    // Clean phone number: ensure E.164 format
    if (!phone.startsWith("+")) {
      phone = `+${phone}`;
    }

    const apiKey = process.env.RINGG_API_KEY?.trim() ?? "";
    const agentId = process.env.RINGG_AGENT_ID?.trim() ?? "";
    const fromNumberId = process.env.RINGG_FROM_NUMBER_ID?.trim() ?? "";

    // Extract Ringg AI Custom Variables
    const customArgsValues = {
      callee_name: String(body.callee_name || "GridSight Officer").trim(),
      mobile_number: phone,
      user_role: String(body.user_role || "police").trim(),
      location: String(body.location || "Bengaluru").trim(),
      incident_type: String(body.incident_type || "congestion").trim(),
      corridor_name: String(body.corridor_name || "All Corridors").trim(),
      language: String(body.language || "English").trim(),
    };

    if (!apiKey || !agentId || !fromNumberId) {
      console.warn("Ringg credentials missing in environment. Simulating outbound call.");
      return NextResponse.json({
        success: true,
        status: "simulated",
        message: `Ringg AI keys missing. Simulated outbound call triggered to ${phone} successfully.`,
        execution_id: `sim-${customArgsValues.user_role}-${Date.now()}`,
        custom_variables_sent: customArgsValues,
      });
    }

    // Build outbound call payload
    const payload: any = {
      name: customArgsValues.callee_name,
      mobile_number: phone,
      agent_id: agentId,
      custom_args_values: customArgsValues,
    };

    // If fromNumberId starts with + or contains only digits, it's a telephone number; use from_number. Otherwise use from_number_id.
    if (fromNumberId.startsWith("+") || /^\d+$/.test(fromNumberId.replace(/[-\s()]/g, ""))) {
      payload.from_number = fromNumberId;
    } else {
      payload.from_number_id = fromNumberId;
    }

    const response = await fetch("https://prod-api.ringg.ai/ca/api/v0/calling/outbound/individual", {
      method: "POST",
      headers: {
        "X-API-KEY": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Ringg AI API responded with code ${response.status}: ${errText}`);
    }

    const data = await response.json();
    return NextResponse.json({
      success: true,
      status: "live",
      execution_id: data.execution_id || data.id || `ringg-${Date.now()}`,
      message: `Call successfully queued via Ringg AI.`,
      custom_variables_sent: customArgsValues,
    });
  } catch (error: any) {
    console.error("Outbound voice call error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to trigger outbound call",
      },
      { status: 500 }
    );
  }
}
