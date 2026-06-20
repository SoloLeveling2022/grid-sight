import {
  getActiveIncidents,
  getHotspots,
  getIncidentsByCorridor,
  getTopHotspotsNear,
} from "@/data";
import type {
  IVoiceProvider,
  STTResult,
  TTSRequest,
  TTSResult,
  VoiceCommandRequest,
  VoiceCommandResponse,
  VoiceSession,
  VoiceSessionRequest,
  VoiceSessionResponse,
  VoiceUIAction,
} from "@/types/voice";

const sessions = new Map<string, VoiceSession>();

function parseIntent(transcript: string, persona: "police" | "citizen"): string {
  const t = transcript.toLowerCase();
  if (persona === "police") {
    if (t.includes("hotspot") || t.includes("congestion")) return "show_hotspots";
    if (t.includes("worsen") || t.includes("next 30")) return "predict_worsening";
    if (t.includes("enforcement") || t.includes("priority")) return "enforcement_priority";
    if (t.includes("mark") && t.includes("active")) return "mark_incident_active";
    if (t.includes("corridor")) return "filter_corridor";
  } else {
    if (t.includes("blocked") || t.includes("block")) return "check_road_blocked";
    if (t.includes("alternate") || t.includes("route")) return "alternate_route";
    if (t.includes("report") || t.includes("obstruction")) return "report_obstruction";
    if (t.includes("congestion") || t.includes("traffic")) return "area_congestion";
  }
  return "general_query";
}

function policeResponse(intent: string, transcript: string, ctx?: VoiceCommandRequest["context"]): VoiceCommandResponse {
  const uiActions: VoiceUIAction[] = [];
  let spoken = "I can help with hotspots, enforcement priority, and corridor status.";
  let toolCalls: VoiceCommandResponse["toolCalls"] = [];

  switch (intent) {
    case "show_hotspots": {
      const hotspots = getHotspots(5);
      spoken = `Top five congestion hotspots: ${hotspots.map((h, i) => `${i + 1}. ${h.name} with score ${Math.round(h.hotspotScore * 100)}`).join(". ")}.`;
      uiActions.push({ type: "show_recommendations", payload: { hotspotIds: hotspots.map((h) => h.id) } });
      toolCalls = [{ name: "get_hotspots", arguments: { limit: 5, zone: "metro" } }];
      break;
    }
    case "predict_worsening": {
      const active = getActiveIncidents().slice(0, 5);
      spoken = `Five corridors expected to worsen: ${active.map((a) => a.corridor).join(", ")}. Highest impact on ${active[0]?.corridor ?? "ORR East 2"}.`;
      toolCalls = [{ name: "predict_congestion", arguments: { horizonMinutes: 30 } }];
      break;
    }
    case "enforcement_priority": {
      const corridor = ctx?.selectedCorridor ?? "ORR East 2";
      spoken = `Enforcement priority for ${corridor}: deploy patrol and tow recommendation for recurring vehicle breakdowns. Score 87 out of 100.`;
      uiActions.push({ type: "filter_corridor", payload: { corridor } });
      toolCalls = [{ name: "prioritize_enforcement", arguments: { corridor } }];
      break;
    }
    case "mark_incident_active": {
      const id = ctx?.selectedIncidentId ?? getActiveIncidents()[0]?.id;
      spoken = id ? `Incident ${id} marked as active.` : "No incident selected to mark.";
      if (id) uiActions.push({ type: "highlight_incident", payload: { incidentId: id } });
      toolCalls = [{ name: "update_incident_status", arguments: { incidentId: id, status: "active" } }];
      break;
    }
    case "filter_corridor": {
      const match = transcript.match(/orr|bellary|hosur|bannerghata|tumkur|madras|magadi/i);
      const corridor = match ? getIncidentsByCorridor(match[0])[0]?.corridor : ctx?.selectedCorridor;
      if (corridor) {
        spoken = `Showing incidents on ${corridor}.`;
        uiActions.push({ type: "filter_corridor", payload: { corridor } });
      }
      break;
    }
  }

  return {
    sessionId: "",
    transcript,
    intent,
    spokenResponse: spoken,
    toolCalls,
    uiActions,
    confidence: 0.91,
  };
}

function citizenResponse(intent: string, transcript: string, ctx?: VoiceCommandRequest["context"]): VoiceCommandResponse {
  const uiActions: VoiceUIAction[] = [];
  let spoken = "I can check road status, suggest routes, or help report obstructions.";
  const toolCalls: VoiceCommandResponse["toolCalls"] = [];

  switch (intent) {
    case "check_road_blocked": {
      const lat = ctx?.latitude ?? 12.9716;
      const lon = ctx?.longitude ?? 77.5946;
      const nearby = getTopHotspotsNear(lat, lon, 1)[0];
      const active = getActiveIncidents().filter(
        (i) => Math.abs(i.latitude - lat) < 0.02 && Math.abs(i.longitude - lon) < 0.02
      );
      spoken =
        active.length > 0
          ? `Yes, ${active.length} active incident${active.length > 1 ? "s" : ""} reported nearby. Expect delays of 15–25 minutes.`
          : `No full road block reported near you. ${nearby?.name ?? "Corridor"} has moderate congestion.`;
      break;
    }
    case "alternate_route": {
      spoken =
        "Fastest alternate: use Inner Ring Road instead of ORR East between KR Puram and Mahadevapura. Estimated saving 12 minutes.";
      uiActions.push({
        type: "show_alternate_route",
        payload: { from: "KR Puram", to: "Mahadevapura", via: "Inner Ring Road" },
      });
      toolCalls.push({ name: "get_alternate_route", arguments: {} });
      break;
    }
    case "report_obstruction": {
      spoken = "Obstruction report logged at your location. Bengaluru Traffic Police has been notified.";
      uiActions.push({
        type: "report_obstruction",
        payload: { latitude: ctx?.latitude, longitude: ctx?.longitude },
      });
      toolCalls.push({ name: "create_citizen_report", arguments: { type: "obstruction" } });
      break;
    }
    case "area_congestion": {
      const summaries = getHotspots(3);
      spoken = `Current congestion: ${summaries.map((s) => `${s.name} is ${s.severity}`).join(", ")}.`;
      break;
    }
  }

  return {
    sessionId: "",
    transcript,
    intent,
    spokenResponse: spoken,
    toolCalls,
    uiActions,
    confidence: 0.88,
  };
}

export class MockVoiceProvider implements IVoiceProvider {
  readonly name = "mock";

  async createSession(request: VoiceSessionRequest): Promise<VoiceSessionResponse> {
    const session: VoiceSession = {
      id: `VS-${Date.now()}`,
      persona: request.persona,
      status: "idle",
      createdAt: new Date().toISOString(),
      locale: request.locale ?? "en-IN",
    };
    sessions.set(session.id, session);
    return { session };
  }

  async speechToText(_audioBlob: Blob, sessionId: string): Promise<STTResult> {
    const session = sessions.get(sessionId);
    if (session) session.status = "listening";
    return {
      transcript: {
        text: "",
        isFinal: true,
        confidence: 0.95,
        timestamp: new Date().toISOString(),
      },
    };
  }

  async processCommand(request: VoiceCommandRequest): Promise<VoiceCommandResponse> {
    const session = sessions.get(request.sessionId);
    if (session) session.status = "processing";

    const intent = parseIntent(request.transcript, request.persona);
    const response =
      request.persona === "police"
        ? policeResponse(intent, request.transcript, request.context)
        : citizenResponse(intent, request.transcript, request.context);

    response.sessionId = request.sessionId;
    if (session) session.status = "speaking";
    return response;
  }

  async textToSpeech(request: TTSRequest): Promise<TTSResult> {
    return { audioUrl: null, text: request.text };
  }

  async endSession(sessionId: string): Promise<void> {
    sessions.delete(sessionId);
  }
}

export const voiceProvider: IVoiceProvider = new MockVoiceProvider();
