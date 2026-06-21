export type VoicePersona = "police" | "citizen";
export type VoiceSessionStatus = "idle" | "listening" | "processing" | "speaking" | "error";

export interface VoiceSession {
  id: string;
  persona: VoicePersona;
  status: VoiceSessionStatus;
  createdAt: string;
  locale: string;
}

export interface VoiceTranscript {
  text: string;
  isFinal: boolean;
  confidence: number;
  timestamp: string;
}

export interface VoiceToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

export interface VoiceCommandRequest {
  sessionId: string;
  persona: VoicePersona;
  transcript: string;
  context?: {
    latitude?: number;
    longitude?: number;
    selectedCorridor?: string;
    selectedIncidentId?: string;
  };
}

export interface VoiceCommandResponse {
  sessionId: string;
  transcript: string;
  intent: string;
  spokenResponse: string;
  toolCalls: VoiceToolCall[];
  uiActions: VoiceUIAction[];
  confidence: number;
}

export interface VoiceUIAction {
  type:
    | "navigate"
    | "highlight_hotspot"
    | "highlight_incident"
    | "show_recommendations"
    | "filter_corridor"
    | "show_alternate_route"
    | "report_obstruction"
    | "generate_patrol_route"
    | "latest_violations"
    | "top_hotspots"
    | "pending_cases"
    | "approve_case"
    | "reject_case"
    | "show_congestion_impact"
    | "avoid_hotspots_route";
  payload: Record<string, unknown>;
}

export interface VoiceSessionRequest {
  persona: VoicePersona;
  locale?: string;
}

export interface VoiceSessionResponse {
  session: VoiceSession;
}

export interface STTResult {
  transcript: VoiceTranscript;
}

export interface TTSRequest {
  text: string;
  persona: VoicePersona;
  locale?: string;
}

export interface TTSResult {
  audioUrl: string | null;
  text: string;
}

export interface IVoiceProvider {
  readonly name: string;
  createSession(request: VoiceSessionRequest): Promise<VoiceSessionResponse>;
  speechToText(audioBlob: Blob, sessionId: string): Promise<STTResult>;
  processCommand(request: VoiceCommandRequest): Promise<VoiceCommandResponse>;
  textToSpeech(request: TTSRequest): Promise<TTSResult>;
  endSession(sessionId: string): Promise<void>;
}
