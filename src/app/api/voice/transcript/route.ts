import { NextResponse } from "next/server";
import { voiceProvider } from "@/services/voice/mock-voice-provider";

export async function POST(request: Request) {
  const formData = await request.formData();
  const sessionId = formData.get("sessionId") as string;
  const audio = formData.get("audio") as Blob;
  const result = await voiceProvider.speechToText(audio, sessionId);
  return NextResponse.json(result);
}
