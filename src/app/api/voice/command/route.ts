import { NextResponse } from "next/server";
import { voiceProvider } from "@/services/voice/mock-voice-provider";
import type { VoiceCommandRequest } from "@/types/voice";

export async function POST(request: Request) {
  const body = (await request.json()) as VoiceCommandRequest;
  const result = await voiceProvider.processCommand(body);
  return NextResponse.json(result);
}
