"use client";

import { usePathname } from "next/navigation";
import { VoiceAgent } from "./voice-agent";
import type { VoicePersona } from "@/types/voice";

export function GlobalVoiceAgent() {
  const pathname = usePathname();

  // Hide the voice agent on the landing, auth, and system architecture pages
  const hideAgent =
    !pathname ||
    pathname === "/" ||
    pathname === "/auth" ||
    pathname.startsWith("/architecture");

  if (hideAgent) return null;

  const persona: VoicePersona = pathname.startsWith("/citizen") ? "citizen" : "police";

  return <VoiceAgent persona={persona} />;
}

