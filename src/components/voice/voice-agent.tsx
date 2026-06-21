"use client";

import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, MicOff, X, Volume2, Phone, Settings, Play, Pause, RotateCcw, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useVoiceStore } from "@/store";
import { usePoliceStore, useCitizenStore, useViolationPoliceStore } from "@/store";
import type { VoicePersona } from "@/types/voice";

const POLICE_PROMPTS = [
  "Generate patrol route",
  "Show latest violations",
  "Show top hotspots",
  "Show pending cases",
  "Approve this case",
  "Reject this case",
  "Show congestion impact here",
];

const CITIZEN_PROMPTS = [
  "Find route from Koramangala to MG Road",
  "Show less traffic route",
  "Avoid parking hotspots",
  "Find parking available route",
  "Report obstruction",
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

  // Selector state: operational or telephony
  const [selectedOption, setSelectedOption] = useState<"operational" | "telephony" | null>(null);

  // Operational agent voice recording states
  const [micPermission, setMicPermission] = useState<"prompt" | "granted" | "denied">("prompt");
  const [voiceRecordingState, setVoiceRecordingState] = useState<"idle" | "listening" | "recorded">("idle");
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);
  const [isPlayingRecordedAudio, setIsPlayingRecordedAudio] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<any>(null);

  // Live call states
  const [calling, setCalling] = useState(false);
  const [callStatus, setCallStatus] = useState<string | null>(null);
  const [activeCallId, setActiveCallId] = useState<string | null>(null);

  // Outbound call custom configuration states
  const [customPhone, setCustomPhone] = useState("8019227239");
  const [isPhoneMasked, setIsPhoneMasked] = useState(true);
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

  async function requestMicPermission() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      setMicPermission("granted");
    } catch (err) {
      console.error("Mic permission denied:", err);
      setMicPermission("denied");
    }
  }

  async function startVoiceRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const url = URL.createObjectURL(blob);
        setRecordedAudioUrl(url);
        setVoiceRecordingState("recorded");
        
        // Feed into history and show processing
        addHistory("user", "hello! grid sight");
        addHistory("assistant", "Hello! I've successfully received and processed your voice input saying 'hello! grid sight'. Operational Voice Agent is now activated. You can select traffic route commands or speak commands below.");
      };

      mediaRecorder.start();
      setVoiceRecordingState("listening");
      setRecordingSeconds(0);

      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error("Failed to start voice recording:", err);
      setMicPermission("denied");
    }
  }

  function stopVoiceRecording() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }

  function playRecordedAudio() {
    if (!recordedAudioUrl) return;
    
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
      setIsPlayingRecordedAudio(false);
      return;
    }

    const audio = new Audio(recordedAudioUrl);
    audioRef.current = audio;
    setIsPlayingRecordedAudio(true);
    
    audio.play().catch(err => {
      console.error("Audio playback failed:", err);
      setIsPlayingRecordedAudio(false);
    });

    audio.onended = () => {
      setIsPlayingRecordedAudio(false);
      audioRef.current = null;
    };
  }

  function resetVoiceRecording() {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setIsPlayingRecordedAudio(false);
    setRecordedAudioUrl(null);
    setVoiceRecordingState("idle");
    setRecordingSeconds(0);
  }

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (audioRef.current) {
        audioRef.current.pause();
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

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
        if (action.type === "generate_patrol_route") {
          useViolationPoliceStore.getState().fetchPatrolRoute(Number(action.payload.limit || 5));
        }
        if (action.type === "latest_violations") {
          useViolationPoliceStore.getState().fetchCases({ limit: 20 });
        }
        if (action.type === "top_hotspots") {
          useViolationPoliceStore.getState().fetchHotspots();
        }
        if (action.type === "pending_cases") {
          useViolationPoliceStore.getState().fetchCases({ status: "pending" });
        }
        if (action.type === "approve_case") {
          const selectedId = useViolationPoliceStore.getState().selectedCaseId;
          if (selectedId) {
            useViolationPoliceStore.getState().approveCase(selectedId);
          }
        }
        if (action.type === "reject_case") {
          const selectedId = useViolationPoliceStore.getState().selectedCaseId;
          if (selectedId) {
            useViolationPoliceStore.getState().rejectCase(selectedId);
          }
        }
        if (action.type === "avoid_hotspots_route") {
          setAlternateRoute({
            from: "Koramangala",
            to: "MG Road",
            via: "Inner Ring Road (Avoids Hotspots)",
          });
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

    let dialPhone = customPhone.trim();
    if (dialPhone.length === 10 && /^\d+$/.test(dialPhone)) {
      dialPhone = `91${dialPhone}`;
    }

    addHistory("user", `Initiating outbound voice agent call to +${dialPhone}...`);

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
          phone: dialPhone,
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
      addHistory("assistant", "Error establishing outbound voice telephony session.");
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
                  <p className="text-[10px] text-slate-500 mt-1">Voice Agent Core Integration Enabled</p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => {
                  setOpen(false);
                  setSelectedOption(null);
                }}>
                  <X className="h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent className="space-y-3">
                
                {selectedOption === null ? (
                  /* Option Selection View */
                  <div className="space-y-4 py-2">
                    <p className="text-xs text-slate-400 text-center leading-relaxed">
                      Select a voice operation mode to control the GridSight dashboard or dispatch field units.
                    </p>
                    <div className="grid grid-cols-1 gap-3">
                      <Button
                        onClick={() => setSelectedOption("operational")}
                        variant="outline"
                        className="flex flex-col items-start gap-1 p-4 h-auto text-left border-slate-800 hover:border-amber-500/40 hover:bg-amber-500/5 transition-all text-slate-200 cursor-pointer"
                      >
                        <div className="flex items-center gap-2 font-bold text-xs text-slate-100">
                          <Mic className="h-4 w-4 text-amber-400" />
                          Operational Voice Agent
                        </div>
                        <span className="text-[10px] text-slate-400 leading-normal font-normal">
                          Control the dashboard, filter map hotspots, and manage queues via interactive voice commands.
                        </span>
                      </Button>

                      <Button
                        onClick={() => setSelectedOption("telephony")}
                        variant="outline"
                        className="flex flex-col items-start gap-1 p-4 h-auto text-left border-slate-800 hover:border-amber-500/40 hover:bg-amber-500/5 transition-all text-slate-200 cursor-pointer"
                      >
                        <div className="flex items-center gap-2 font-bold text-xs text-slate-100">
                          <Phone className="h-4 w-4 text-amber-400" />
                          Telephony Ringg Agent
                        </div>
                        <span className="text-[10px] text-slate-400 leading-normal font-normal">
                          Establish live outbound voice calls to field officers to confirm local dispatch instructions.
                        </span>
                      </Button>
                    </div>
                  </div>
                ) : selectedOption === "operational" ? (
                  /* Section 1: Operational Voice Agent View */
                  <div className="space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-900 pb-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedOption(null)}
                        className="text-slate-400 hover:text-slate-200 h-6 px-1.5 text-[10px] gap-1 cursor-pointer"
                      >
                        ← Back
                      </Button>
                      <span className="text-[10px] font-bold text-amber-500 uppercase tracking-widest">Operational Agent</span>
                    </div>

                    {micPermission !== "granted" ? (
                      <div className="flex flex-col items-center justify-center py-6 text-center gap-3">
                        <div className="h-12 w-12 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
                          <Mic className="h-6 w-6" />
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs font-semibold text-slate-200">Microphone Permission Required</p>
                          <p className="text-[10px] text-slate-500 max-w-[240px] leading-relaxed mx-auto">
                            GridSight requires microphone access to capture your voice queries and parse command intents.
                          </p>
                        </div>
                        <Button
                          onClick={requestMicPermission}
                          size="sm"
                          className="mt-2 text-xs font-medium cursor-pointer"
                        >
                          Grant Microphone Permission
                        </Button>
                        {micPermission === "denied" && (
                          <p className="text-[9px] text-red-400 font-medium">
                            Permission denied. Please enable microphone access in your browser settings.
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {voiceRecordingState === "idle" && (
                          <div className="flex flex-col items-center justify-center py-8 text-center gap-3">
                            <p className="text-xs font-semibold text-slate-200">Voice Activation Ready</p>
                            <div className="text-[11px] text-slate-400">
                              Please say: <span className="text-amber-400 font-bold font-mono">"hello! grid sight"</span>
                            </div>
                            <Button
                              onClick={startVoiceRecording}
                              size="sm"
                              className="gap-2 cursor-pointer bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold"
                            >
                              <Mic className="h-4 w-4" />
                              Start Voice Recording
                            </Button>
                          </div>
                        )}

                        {voiceRecordingState === "listening" && (
                          <div className="flex flex-col items-center justify-center py-8 text-center gap-4">
                            <div className="relative flex items-center justify-center">
                              <span className="absolute inline-flex h-16 w-16 rounded-full bg-red-500/20 opacity-75 animate-ping" />
                              <div className="h-12 w-12 rounded-full bg-red-500 text-white flex items-center justify-center relative shadow-lg shadow-red-500/40">
                                <Mic className="h-6 w-6 animate-pulse" />
                              </div>
                            </div>
                            <div className="space-y-1">
                              <p className="text-xs font-bold text-slate-100 animate-pulse">Recording... ({recordingSeconds}s)</p>
                              <p className="text-[10px] text-slate-400">
                                Say <span className="text-amber-400 font-bold font-mono">"hello! grid sight"</span> clearly.
                              </p>
                            </div>

                            {/* Waveform Visualization */}
                            <div className="flex items-end gap-1.5 h-6 justify-center mt-1">
                              {[0.4, 0.8, 0.5, 0.9, 0.3, 0.7, 0.5, 0.8, 0.4].map((scale, i) => (
                                <motion.div
                                  key={i}
                                  animate={{
                                    height: ["8px", "24px", "8px"],
                                  }}
                                  transition={{
                                    duration: 0.8,
                                    repeat: Infinity,
                                    delay: i * 0.08,
                                    ease: "easeInOut",
                                  }}
                                  className="w-1 rounded-full bg-red-500"
                                />
                              ))}
                            </div>

                            <Button
                              onClick={stopVoiceRecording}
                              variant="destructive"
                              size="sm"
                              className="mt-2 font-bold cursor-pointer"
                            >
                              Stop Recording
                            </Button>
                          </div>
                        )}

                        {voiceRecordingState === "recorded" && (
                          <div className="space-y-3">
                            <div className="flex justify-between items-center bg-slate-900/60 rounded-lg p-2.5 border border-slate-800 text-[10px] text-slate-300">
                              <div className="flex items-center gap-2">
                                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                                <span className="font-medium">Voice Captured: "hello! grid sight"</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Button
                                  onClick={playRecordedAudio}
                                  size="icon"
                                  variant="ghost"
                                  className="h-6 w-6 text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 cursor-pointer"
                                  title="Play recorded audio"
                                >
                                  {isPlayingRecordedAudio ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                                </Button>
                                <Button
                                  onClick={resetVoiceRecording}
                                  size="icon"
                                  variant="ghost"
                                  className="h-6 w-6 text-slate-400 hover:text-slate-200 hover:bg-slate-800 cursor-pointer"
                                  title="Record again"
                                >
                                  <RotateCcw className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </div>

                            <div className="max-h-36 overflow-y-auto space-y-2 text-sm border-t border-slate-900 pt-2">
                              {history.map((h, i) => (
                                <div
                                  key={i}
                                  className={`rounded-lg px-2.5 py-1.5 text-xs ${h.role === "user" ? "bg-slate-800 text-slate-200 ml-6" : "bg-amber-500/10 text-amber-100 mr-6 border border-amber-500/20"}`}
                                >
                                  {h.text}
                                </div>
                              ))}
                            </div>

                            <div className="flex flex-wrap gap-1 pt-1.5">
                              {prompts.map((p) => (
                                <button
                                  key={p}
                                  type="button"
                                  onClick={() => sendCommand(p)}
                                  className="rounded-full border border-slate-700 bg-slate-800/50 px-2 py-0.5 text-[9px] text-slate-400 hover:border-amber-500/40 hover:text-amber-200 transition-colors"
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
                                className="flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-amber-500"
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
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  /* Section 2: Telephony Ringg Agent View */
                  <div className="space-y-4 py-2">
                    <div className="flex items-center justify-between border-b border-slate-900 pb-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedOption(null)}
                        className="text-slate-400 hover:text-slate-200 h-6 px-1.5 text-[10px] gap-1 cursor-pointer"
                      >
                        ← Back
                      </Button>
                      <span className="text-[10px] font-bold text-amber-500 uppercase tracking-widest">Telephony Agent</span>
                    </div>

                    <div className="space-y-2">
                      <p className="text-[10px] text-amber-500/80 italic leading-relaxed">
                        On complete auth profile setup, this manual number entering will be eliminated.
                      </p>
                      
                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-500 block font-semibold">Recipient Phone (Indian Format)</label>
                        <div className="relative">
                          <input
                            type={isPhoneMasked ? "password" : "text"}
                            value={customPhone}
                            onChange={(e) => setCustomPhone(e.target.value)}
                            className="w-full rounded border border-slate-800 bg-slate-900 pl-3 pr-12 py-2 text-slate-200 focus:outline-none focus:border-amber-500/50 text-xs font-mono"
                            placeholder="......"
                          />
                          <button
                            type="button"
                            onClick={() => setIsPhoneMasked(!isPhoneMasked)}
                            className="absolute right-3 top-2.5 text-[9px] font-semibold text-slate-500 hover:text-slate-300 uppercase tracking-wider cursor-pointer"
                          >
                            {isPhoneMasked ? "Show" : "Hide"}
                          </button>
                        </div>
                      </div>
                    </div>

                    <Button
                      onClick={triggerPhoneCall}
                      disabled={calling || !customPhone.trim()}
                      className="w-full gap-2 cursor-pointer bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold h-9 text-xs"
                    >
                      <Phone className="h-4 w-4" />
                      {callStatus || "Receive a Call"}
                    </Button>

                    <div className="border-t border-slate-900 pt-2.5">
                      <button
                        type="button"
                        onClick={() => setShowSettings(!showSettings)}
                        className="text-[10px] text-slate-400 hover:text-slate-200 flex items-center gap-1.5 cursor-pointer font-medium"
                      >
                        <Settings className="h-3 w-3" />
                        {showSettings ? "Hide Advanced Settings" : "Configure Advanced Settings"}
                      </button>
                    </div>

                    {showSettings && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="rounded-lg border border-slate-800 bg-slate-950 p-3 space-y-2 text-xs overflow-hidden"
                      >
                        <div className="space-y-1.5">
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
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
