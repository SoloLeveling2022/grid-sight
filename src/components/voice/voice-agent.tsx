"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, MicOff, X, Volume2, Phone, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useVoiceStore } from "@/store";
import { usePoliceStore, useCitizenStore } from "@/store";
import type { VoicePersona } from "@/types/voice";

const POLICE_PROMPTS = [
  "Show top five congestion hotspots near the metro zone.",
  "What roads are expected to worsen in the next 30 minutes?",
  "Generate enforcement priority for this corridor.",
];

const CITIZEN_PROMPTS = [
  "Is this road blocked?",
  "What is the fastest alternate route?",
  "Report roadside obstruction at my location.",
];

interface VoiceAgentProps {
  persona: VoicePersona;
}

export function VoiceAgent({ persona }: VoiceAgentProps) {
  const { isOpen, setOpen, isListening, setListening, history, addHistory, setLastResponse, setSession, session } =
    useVoiceStore();
  const setSelectedCorridor = usePoliceStore((s) => s.setSelectedCorridor);
  const setAlternateRoute = useCitizenStore((s) => s.setAlternateRoute);
  const addReport = useCitizenStore((s) => s.addReport);
  const [input, setInput] = useState("");
  const [processing, setProcessing] = useState(false);

  // Live call states
  const [calling, setCalling] = useState(false);
  const [callStatus, setCallStatus] = useState<string | null>(null);
  const [activeCallId, setActiveCallId] = useState<string | null>(null);

  // Outbound call custom configuration states
  const [customPhone, setCustomPhone] = useState("918019227239");
  const [customCalleeName, setCustomCalleeName] = useState(
    persona === "police" ? "GridSight Police Officer" : "GridSight Citizen"
  );
  const [customLanguage, setCustomLanguage] = useState("English");
  const [showSettings, setShowSettings] = useState(false);

  const prompts = persona === "police" ? POLICE_PROMPTS : CITIZEN_PROMPTS;

  async function ensureSession() {
    if (session) return session.id;
    const res = await fetch("/api/voice/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ persona }),
    });
    const data = await res.json();
    setSession(data.session);
    return data.session.id as string;
  }

  async function sendCommand(text: string) {
    if (!text.trim()) return;
    setProcessing(true);
    addHistory("user", text);
    setInput("");

    try {
      const sessionId = await ensureSession();
      const res = await fetch("/api/voice/command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          persona,
          transcript: text,
          context: persona === "police" ? { selectedCorridor: usePoliceStore.getState().selectedCorridor ?? undefined } : {},
        }),
      });
      const data = await res.json();
      setLastResponse(data);
      addHistory("assistant", data.spokenResponse);

      for (const action of data.uiActions ?? []) {
        if (action.type === "filter_corridor" && action.payload.corridor) {
          setSelectedCorridor(String(action.payload.corridor));
        }
        if (action.type === "show_alternate_route") {
          setAlternateRoute({
            from: String(action.payload.from ?? ""),
            to: String(action.payload.to ?? ""),
            via: String(action.payload.via ?? ""),
          });
        }
        if (action.type === "report_obstruction") {
          addReport("Voice-reported roadside obstruction");
        }
      }
    } finally {
      setProcessing(false);
      setListening(false);
    }
  }

  // Polling for outbound call status and transcript
  useEffect(() => {
    if (!activeCallId) return;

    let pollInterval: any;
    let attempts = 0;
    const maxAttempts = 30; // Max 2 minutes of polling

    const checkStatus = async () => {
      try {
        const res = await fetch(`/api/voice/call/status?id=${encodeURIComponent(activeCallId)}`);
        if (!res.ok) return;

        const data = await res.json();
        if (data.success) {
          const status = data.status;
          
          if (status === "ringing") {
            setCallStatus("🔔 Ringing...");
          } else if (status === "talking") {
            setCallStatus("📞 Connected...");
          } else if (status === "transcribing") {
            setCallStatus("📝 Finalizing...");
          } else if (status === "completed") {
            setCallStatus("✅ Call Ended");
            setActiveCallId(null);
            
            if (data.transcript) {
              addHistory("assistant", `[Outbound Call Transcript]\n${data.transcript}`);
            } else {
              addHistory("assistant", "Outbound voice call completed successfully.");
            }
            setTimeout(() => setCallStatus(null), 4000);
          } else if (status === "failed" || status === "no-answer" || status === "busy") {
            setCallStatus("❌ Failed");
            setActiveCallId(null);
            addHistory("assistant", `Outbound call ended with status: ${status}`);
            setTimeout(() => setCallStatus(null), 4000);
          }
        }
      } catch (err) {
        console.error("Error polling call status:", err);
      }

      attempts++;
      if (attempts >= maxAttempts) {
        setCallStatus("⏱️ Timeout");
        setActiveCallId(null);
        addHistory("assistant", "Outbound call status tracking timed out.");
        setTimeout(() => setCallStatus(null), 4000);
      }
    };

    checkStatus();
    pollInterval = setInterval(checkStatus, 4000);

    return () => {
      clearInterval(pollInterval);
    };
  }, [activeCallId, addHistory]);

  async function triggerPhoneCall() {
    if (activeCallId) return; // Prevent concurrent calls
    setCalling(true);
    setCallStatus("Calling...");
    addHistory("user", `Initiating outbound voice agent call to +${customPhone}...`);

    const currentCorridor = usePoliceStore.getState().selectedCorridor || "All Corridors";
    const selectedItem = usePoliceStore.getState().mapSelection;
    const activeIncidentCause = selectedItem?.type === "incident"
      ? (selectedItem.data as any)?.eventCause || "congestion"
      : "congestion";

    try {
      const res = await fetch("/api/voice/call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: customPhone,
          callee_name: customCalleeName,
          user_role: persona,
          location: currentCorridor !== "All Corridors" ? currentCorridor : "Bengaluru",
          corridor_name: currentCorridor,
          incident_type: activeIncidentCause,
          language: customLanguage,
        }),
      });
      const data = await res.json();

      if (data.success) {
        setCallStatus(data.status === "simulated" ? "Simulated!" : "Queued!");
        addHistory(
          "assistant",
          `Outbound voice call status: ${data.message}`
        );
        if (data.execution_id) {
          setActiveCallId(data.execution_id);
        }
      } else {
        setCallStatus("Failed");
        addHistory("assistant", `Failed to call: ${data.error}`);
        setTimeout(() => setCallStatus(null), 4000);
      }
    } catch (err) {
      setCallStatus("Error");
      addHistory("assistant", "Error establishing outbound Ringg AI voice session.");
      setTimeout(() => setCallStatus(null), 4000);
    } finally {
      setCalling(false);
    }
  }

  return (
    <>
      <motion.button
        type="button"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-amber-500 text-slate-950 shadow-2xl shadow-amber-500/30"
        aria-label="Open voice assistant"
      >
        <Mic className="h-6 w-6" />
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-24 right-6 z-50 w-[380px] max-w-[calc(100vw-2rem)]"
          >
            <Card className="border-amber-500/20 shadow-2xl">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Volume2 className="h-4 w-4 text-amber-400" />
                    GridSight Voice · {persona === "police" ? "Officer" : "Citizen"}
                  </CardTitle>
                  <p className="text-[10px] text-slate-500 mt-1">Ringg AI Agent Integration Enabled</p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setOpen(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Outbound call section */}
                <div className="rounded-lg border border-slate-800 bg-slate-900/30 p-2.5 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                    <div>
                      <p className="text-[10px] font-semibold text-slate-200">Live Voice Agent</p>
                      <p className="text-[9px] text-slate-500">+{customPhone}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-slate-400 hover:text-slate-200"
                      onClick={() => setShowSettings(!showSettings)}
                      title="Configure Call Parameters"
                    >
                      <Settings className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2.5 text-[10px] gap-1 border-slate-700 bg-slate-950 hover:bg-emerald-500/10 hover:text-emerald-400 hover:border-emerald-500/30 transition-colors"
                      onClick={triggerPhoneCall}
                      disabled={calling}
                    >
                      <Phone className="h-3 w-3" />
                      {callStatus || "Call Dispatcher"}
                    </Button>
                  </div>
                </div>

                {/* Settings panel for customizing variable payload */}
                {showSettings && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="rounded-lg border border-slate-800 bg-slate-950 p-3 space-y-2 text-xs overflow-hidden"
                  >
                    <p className="font-semibold text-slate-400 text-[10px] uppercase tracking-wider mb-1">
                      Call Variable Dispatch Setup
                    </p>
                    <div className="space-y-1.5">
                      <div>
                        <label className="text-[9px] text-slate-500 block font-medium">Recipient Phone (mobile_number)</label>
                        <input
                          type="text"
                          value={customPhone}
                          onChange={(e) => setCustomPhone(e.target.value)}
                          className="w-full rounded border border-slate-800 bg-slate-900 px-2 py-1 text-slate-200 focus:outline-none focus:border-amber-500/50 text-xs"
                          placeholder="e.g. 918019227239"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] text-slate-500 block font-medium">Callee Name (callee_name)</label>
                        <input
                          type="text"
                          value={customCalleeName}
                          onChange={(e) => setCustomCalleeName(e.target.value)}
                          className="w-full rounded border border-slate-800 bg-slate-900 px-2 py-1 text-slate-200 focus:outline-none focus:border-amber-500/50 text-xs"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[9px] text-slate-500 block font-medium">Language (language)</label>
                          <select
                            value={customLanguage}
                            onChange={(e) => setCustomLanguage(e.target.value)}
                            className="w-full rounded border border-slate-800 bg-slate-900 px-2 py-1 text-slate-200 focus:outline-none focus:border-amber-500/50 text-xs"
                          >
                            <option value="English">English</option>
                            <option value="Kannada">Kannada</option>
                            <option value="Hindi">Hindi</option>
                            <option value="Tamil">Tamil</option>
                            <option value="Telugu">Telugu</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-[9px] text-slate-500 block font-medium">User Role (user_role)</label>
                          <input
                            type="text"
                            value={persona}
                            disabled
                            className="w-full rounded border border-slate-800 bg-slate-900/50 px-2 py-1 text-slate-500 cursor-not-allowed text-xs"
                          />
                        </div>
                      </div>
                      <div className="border-t border-slate-900 pt-1.5 mt-1.5 space-y-1 text-[9px] text-slate-400">
                        <div className="flex justify-between">
                          <span className="text-slate-500">location:</span>
                          <span className="font-mono text-slate-300">{usePoliceStore.getState().selectedCorridor || "All Corridors"}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">corridor_name:</span>
                          <span className="font-mono text-slate-300">{usePoliceStore.getState().selectedCorridor || "All Corridors"}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">incident_type:</span>
                          <span className="font-mono text-slate-300">
                            {usePoliceStore.getState().mapSelection?.type === "incident"
                              ? (usePoliceStore.getState().mapSelection.data as any)?.eventCause || "congestion"
                              : "congestion"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                <div className="max-h-40 overflow-y-auto space-y-2 text-sm">
                  {history.length === 0 && (
                    <p className="text-slate-500 text-xs">Try a command or tap a suggestion below.</p>
                  )}
                  {history.map((h, i) => (
                    <div
                      key={i}
                      className={`rounded-lg px-3 py-2 text-xs ${h.role === "user" ? "bg-slate-800 text-slate-200 ml-6" : "bg-amber-500/10 text-amber-100 mr-6 border border-amber-500/20"}`}
                    >
                      {h.text}
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap gap-1">
                  {prompts.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => sendCommand(p)}
                      className="rounded-full border border-slate-700 bg-slate-800/50 px-2 py-1 text-[10px] text-slate-400 hover:border-amber-500/40 hover:text-amber-200 transition-colors"
                    >
                      {p.slice(0, 42)}…
                    </button>
                  ))}
                </div>

                <div className="flex gap-2 pt-1">
                  <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && sendCommand(input)}
                    placeholder="Type or use mic…"
                    className="flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                  <Button
                    size="icon"
                    variant={isListening ? "destructive" : "secondary"}
                    onClick={() => {
                      if (isListening) {
                        sendCommand(input || prompts[0]);
                      } else {
                        setListening(true);
                        setInput(prompts[0]);
                      }
                    }}
                    disabled={processing}
                  >
                    {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
