import { NextResponse } from "next/server";
import { voiceProvider } from "@/services/voice/mock-voice-provider";
import type { VoiceSessionRequest } from "@/types/voice";

export async function POST(request: Request) {
  const body = (await request.json()) as VoiceSessionRequest;
  const result = await voiceProvider.createSession(body);
  return NextResponse.json(result);
}
