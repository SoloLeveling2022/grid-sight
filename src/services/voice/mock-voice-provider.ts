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

  // General commands regardless of persona
  if (t.includes("quit") || t.includes("exit") || t.includes("close agent") || t.includes("close assistant")) {
    return "quit_agent";
  }
  if (t.includes("screenshot") || t.includes("take a screenshot") || t.includes("capture screen")) {
    return "take_screenshot";
  }
  if (t.includes("scroll down") || t.includes("move down") || t.includes("page down")) {
    return "scroll_down";
  }
  if (t.includes("scroll up") || t.includes("move up") || t.includes("page up")) {
    return "scroll_up";
  }
  if (t.includes("scroll to top") || t.includes("go to top")) {
    return "scroll_top";
  }
  if (t.includes("scroll to bottom") || t.includes("go to bottom")) {
    return "scroll_bottom";
  }
  if (t.includes("navigate") || t.includes("go to") || t.includes("show me") || t.includes("find me") || t.includes("open") || t.includes("find the") || t.includes("show the") || t.includes("go the")) {
    return "navigate_section";
  }

  if (persona === "police") {
    // Generate Patrol Route
    if (t.includes("route") || t.includes("patrol") || t.includes("direction") || t.includes("path")) {
      return "generate_patrol_route";
    }
    // Latest Violations
    if ((t.includes("latest") || t.includes("show") || t.includes("get") || t.includes("fetch")) && (t.includes("violation") || t.includes("case") || t.includes("ticket"))) {
      return "latest_violations";
    }
    // Top Hotspots
    if ((t.includes("top") || t.includes("show") || t.includes("get") || t.includes("major")) && (t.includes("hotspot") || t.includes("congestion center"))) {
      return "top_hotspots";
    }
    // Pending Cases
    if ((t.includes("pending") || t.includes("validation") || t.includes("queue")) && (t.includes("case") || t.includes("violation") || t.includes("ticket") || t.includes("show"))) {
      return "pending_cases";
    }
    // Approve Case
    if (t.includes("approve") || t.includes("validate") || t.includes("confirm") || t.includes("accept") || t.includes("verify")) {
      return "approve_case";
    }
    // Reject Case
    if (t.includes("reject") || t.includes("dismiss") || t.includes("decline") || t.includes("discard") || t.includes("cancel")) {
      return "reject_case";
    }
    // Show Congestion Impact
    if (t.includes("congestion") && (t.includes("impact") || t.includes("quantify") || t.includes("score") || t.includes("measure"))) {
      return "show_congestion_impact";
    }
    // Show Hotspots
    if (t.includes("hotspot") || t.includes("congestion")) {
      return "show_hotspots";
    }
    // Predict Worsening
    if (t.includes("worsen") || t.includes("predict") || t.includes("next 30") || t.includes("future")) {
      return "predict_worsening";
    }
    // Enforcement Priority
    if (t.includes("enforcement") || t.includes("priority") || t.includes("deploy") || t.includes("tow")) {
      return "enforcement_priority";
    }
    // Mark Incident Active
    if (t.includes("mark") || t.includes("active") || t.includes("resolve") || t.includes("incident")) {
      return "mark_incident_active";
    }
    // Filter Corridor
    if (t.includes("corridor") || t.includes("orr") || t.includes("bellary") || t.includes("hosur") || t.includes("bannerghatta") || t.includes("tumkur") || t.includes("madras") || t.includes("magadi")) {
      return "filter_corridor";
    }
  } else {
    if (t.includes("route from koramangala") || t.includes("mg road")) return "citizen_route";
    if (t.includes("less traffic") || (t.includes("traffic") && t.includes("route"))) return "less_traffic_route";
    if (t.includes("avoid") && t.includes("hotspot")) return "avoid_hotspots_route";
    if (t.includes("parking") && t.includes("available")) return "parking_available_route";
    if (t.includes("report") || t.includes("obstruction")) return "report_obstruction";
    if (t.includes("blocked") || t.includes("block")) return "check_road_blocked";
    if (t.includes("alternate") || t.includes("route")) return "alternate_route";
    if (t.includes("congestion") || t.includes("traffic")) return "area_congestion";
  }
  return "general_query";
}

function handleGeneralIntent(
  intent: string,
  transcript: string
): { spoken: string; uiActions: VoiceUIAction[] } | null {
  const uiActions: VoiceUIAction[] = [];
  let spoken = "";

  switch (intent) {
    case "quit_agent": {
      spoken = "Closing voice assistant console.";
      uiActions.push({ type: "quit_agent", payload: {} });
      return { spoken, uiActions };
    }
    case "take_screenshot": {
      spoken = "Capturing page screenshot and starting download.";
      uiActions.push({ type: "take_screenshot", payload: {} });
      return { spoken, uiActions };
    }
    case "scroll_down": {
      spoken = "Scrolling down.";
      uiActions.push({ type: "scroll", payload: { direction: "down" } });
      return { spoken, uiActions };
    }
    case "scroll_up": {
      spoken = "Scrolling up.";
      uiActions.push({ type: "scroll", payload: { direction: "up" } });
      return { spoken, uiActions };
    }
    case "scroll_top": {
      spoken = "Scrolling to top of the page.";
      uiActions.push({ type: "scroll", payload: { direction: "top" } });
      return { spoken, uiActions };
    }
    case "scroll_bottom": {
      spoken = "Scrolling to bottom of the page.";
      uiActions.push({ type: "scroll", payload: { direction: "bottom" } });
      return { spoken, uiActions };
    }
    case "navigate_section": {
      let matchedSection = "dashboard";
      let route = "/police";
      let elementId = "map-section";
      let tab: string | undefined;

      const t = transcript.toLowerCase();
      if (t.includes("camera") || t.includes("cctv") || t.includes("video")) {
        matchedSection = "camera";
        route = "/police";
        elementId = "cctv-section";
      } else if (t.includes("map")) {
        matchedSection = "enforcement map";
        route = "/police";
        elementId = "map-section";
      } else if (t.includes("case") || t.includes("validation") || t.includes("offender") || t.includes("device") || t.includes("tab")) {
        route = "/police";
        elementId = "cases-section";
        if (t.includes("validation")) {
          matchedSection = "validation tab";
          tab = "validation";
        } else if (t.includes("offender")) {
          matchedSection = "offenders tab";
          tab = "offenders";
        } else if (t.includes("device")) {
          matchedSection = "devices tab";
          tab = "devices";
        } else {
          matchedSection = "cases tab";
          tab = "cases";
        }
      } else if (t.includes("performance") || t.includes("workload") || t.includes("enforcement priority") || t.includes("priority")) {
        matchedSection = "enforcement priorities";
        route = "/police";
        elementId = "performance-section";
      } else if (t.includes("explorer") || t.includes("violation") || t.includes("filter")) {
        matchedSection = "violation cases explorer";
        route = "/violations";
        elementId = "explorer-section";
        if (t.includes("filter")) {
          elementId = "filters-section";
        }
      } else if (t.includes("ranking") || t.includes("density") || t.includes("details") || t.includes("hotspot")) {
        matchedSection = "hotspots density rankings";
        route = "/hotspots";
        elementId = "rankings-section";
        if (t.includes("details")) {
          elementId = "details-section";
        }
      } else if (t.includes("incident feed") || t.includes("feed") || t.includes("incident")) {
        matchedSection = "incident feed";
        route = "/incidents";
        elementId = "incidents-feed-section";
      } else if (t.includes("report") || t.includes("obstruction")) {
        matchedSection = "report obstruction form";
        route = "/citizen";
        elementId = "report-section";
      } else if (t.includes("advisory") || t.includes("advise")) {
        matchedSection = "citizen advisories";
        route = "/citizen";
        elementId = "advisory-section";
      } else if (t.includes("citizen")) {
        matchedSection = "citizen portal";
        route = "/citizen";
        elementId = "route-map-section";
      } else if (t.includes("architecture") || t.includes("design")) {
        matchedSection = "system architecture";
        route = "/architecture";
        elementId = "root";
      } else if (t.includes("auth") || t.includes("login")) {
        matchedSection = "authentication";
        route = "/auth";
        elementId = "root";
      }

      spoken = `Navigating to the ${matchedSection} on ${route}.`;
      uiActions.push({
        type: "navigate_section",
        payload: { route, elementId, tab }
      });
      return { spoken, uiActions };
    }
  }

  return null;
}

function policeResponse(intent: string, transcript: string, ctx?: VoiceCommandRequest["context"]): VoiceCommandResponse {
  const general = handleGeneralIntent(intent, transcript);
  if (general) {
    return {
      sessionId: "",
      transcript,
      intent,
      spokenResponse: general.spoken,
      toolCalls: [],
      uiActions: general.uiActions,
      confidence: 0.95,
    };
  }

  const uiActions: VoiceUIAction[] = [];
  let spoken = "I can help with hotspots, enforcement priority, and corridor status.";
  let toolCalls: VoiceCommandResponse["toolCalls"] = [];

  switch (intent) {
    case "generate_patrol_route": {
      spoken = "Generating patrol route for the top five enforcement hotspots.";
      uiActions.push({ type: "generate_patrol_route", payload: { limit: 5 } });
      toolCalls = [{ name: "get_patrol_route", arguments: { limit: 5 } }];
      break;
    }
    case "latest_violations": {
      spoken = "Fetching the latest twenty violation cases from the database.";
      uiActions.push({ type: "latest_violations", payload: {} });
      toolCalls = [{ name: "search_violations", arguments: { limit: 20 } }];
      break;
    }
    case "top_hotspots": {
      spoken = "Showing all major parking violation hotspots on the control map.";
      uiActions.push({ type: "top_hotspots", payload: {} });
      toolCalls = [{ name: "get_hotspots", arguments: {} }];
      break;
    }
    case "pending_cases": {
      spoken = "Filtering database for cases in the pending validation queue.";
      uiActions.push({ type: "pending_cases", payload: {} });
      toolCalls = [{ name: "search_violations", arguments: { validation_status: "pending" } }];
      break;
    }
    case "approve_case": {
      spoken = "Processing case validation and marking it approved.";
      uiActions.push({ type: "approve_case", payload: {} });
      break;
    }
    case "reject_case": {
      spoken = "Rejecting case evidence and updating record in database.";
      uiActions.push({ type: "reject_case", payload: {} });
      break;
    }
    case "show_congestion_impact": {
      spoken = "Opening Random Forest traffic flow impact predictions for this centroid.";
      uiActions.push({ type: "show_congestion_impact", payload: {} });
      break;
    }
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
  const general = handleGeneralIntent(intent, transcript);
  if (general) {
    return {
      sessionId: "",
      transcript,
      intent,
      spokenResponse: general.spoken,
      toolCalls: [],
      uiActions: general.uiActions,
      confidence: 0.95,
    };
  }

  const uiActions: VoiceUIAction[] = [];
  let spoken = "I can check road status, suggest routes, or help report obstructions.";
  const toolCalls: VoiceCommandResponse["toolCalls"] = [];

  switch (intent) {
    case "citizen_route": {
      spoken = "Calculating recommended public route from Koramangala to MG Road.";
      uiActions.push({
        type: "show_alternate_route",
        payload: { from: "Koramangala", to: "MG Road", via: "Richmond Road Corridor" },
      });
      break;
    }
    case "less_traffic_route": {
      spoken = "Finding route options optimized for minimal travel delays.";
      uiActions.push({
        type: "show_alternate_route",
        payload: { from: "Origin", to: "Destination", via: "Outer Ring Bypass" },
      });
      break;
    }
    case "avoid_hotspots_route": {
      spoken = "Route generated avoiding top parking congestion hotspots.";
      uiActions.push({ type: "avoid_hotspots_route", payload: {} });
      break;
    }
    case "parking_available_route": {
      spoken = "Finding route aligned with nearest public parking stations.";
      uiActions.push({
        type: "show_alternate_route",
        payload: { from: "Origin", to: "Destination", via: "Public Parking Terminal Route" },
      });
      break;
    }
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
