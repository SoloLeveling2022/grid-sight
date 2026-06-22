"use client";

import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, MicOff, X, Volume2, Phone, Settings, Play, Pause, RotateCcw, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useVoiceStore } from "@/store";
import { usePoliceStore, useCitizenStore, useViolationPoliceStore } from "@/store";
import type { VoicePersona } from "@/types/voice";
import { useRouter, usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

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
  const router = useRouter();
  const pathname = usePathname();
  const { isOpen, setOpen, isListening, setListening, history, addHistory, setLastResponse, setSession, session } =
    useVoiceStore();
  const setSelectedCorridor = usePoliceStore((s) => s.setSelectedCorridor);
  const setAlternateRoute = useCitizenStore((s) => s.setAlternateRoute);
  const addReport = useCitizenStore((s) => s.addReport);
  const [input, setInput] = useState("");
  const [processing, setProcessing] = useState(false);
  const [orchestrationStep, setOrchestrationStep] = useState<number>(0);

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
  const recognitionRef = useRef<any>(null);
  const silenceTimeoutRef = useRef<any>(null);

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

  async function startContinuousListening() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      stream.getTracks().forEach((track) => track.stop());
      setMicPermission("granted");
    } catch (err) {
      console.error("Mic permission denied:", err);
      setMicPermission("denied");
      return;
    }

    const SpeechRecognition = typeof window !== "undefined" && ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
    if (!SpeechRecognition) {
      console.warn("SpeechRecognition is not supported in this browser. Falling back to simulation mode.");
      setVoiceRecordingState("listening");
      setRecordingSeconds(0);
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
      return;
    }

    try {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (e) {
          // ignore
        }
      }

      const recognition = new SpeechRecognition();
      recognitionRef.current = recognition;
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-IN";

      recognition.onstart = () => {
        setVoiceRecordingState("listening");
        setRecordingSeconds(0);
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = setInterval(() => {
          setRecordingSeconds((prev) => prev + 1);
        }, 1000);
      };

      recognition.onresult = (event: any) => {
        let interimTranscript = "";
        let finalTranscript = "";

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }

        const currentText = finalTranscript || interimTranscript;
        if (currentText.trim()) {
          setInput(currentText);

          if (silenceTimeoutRef.current) {
            clearTimeout(silenceTimeoutRef.current);
          }

          silenceTimeoutRef.current = setTimeout(() => {
            handleSpeechCommandSubmit(currentText);
          }, 2000);
        }
      };

      recognition.onerror = (event: any) => {
        console.error("Speech recognition error:", event.error);
        if (event.error === "not-allowed") {
          setMicPermission("denied");
        }
      };

      recognition.onend = () => {
        if (selectedOption === "operational") {
          setTimeout(() => {
            try {
              if (recognitionRef.current) {
                recognitionRef.current.start();
              }
            } catch (e) {
              console.error("Failed to restart SpeechRecognition:", e);
            }
          }, 300);
        }
      };

      recognition.start();
    } catch (err) {
      console.error("SpeechRecognition start error:", err);
    }
  }

  async function executeUiActions(uiActions: Array<any>) {
    for (const action of uiActions ?? []) {
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
      if (action.type === "quit_agent") {
        setOpen(false);
        setSelectedOption(null);
        stopContinuousListening();
      }
      if (action.type === "take_screenshot") {
        try {
          const html2canvas = (await import("html2canvas")).default;
          const canvas = await html2canvas(document.body, {
            useCORS: true,
            logging: false,
            backgroundColor: "#070b14",
          });
          const imgData = canvas.toDataURL("image/png");
          const link = document.createElement("a");
          link.href = imgData;
          link.download = "gridsight-screenshot.png";
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        } catch (err) {
          console.error("Screenshot capture failed:", err);
        }
      }
      if (action.type === "scroll") {
        const dir = action.payload.direction;
        if (dir === "down") {
          window.scrollBy({ top: window.innerHeight * 0.6, behavior: "smooth" });
        } else if (dir === "up") {
          window.scrollBy({ top: -window.innerHeight * 0.6, behavior: "smooth" });
        } else if (dir === "top") {
          window.scrollTo({ top: 0, behavior: "smooth" });
        } else if (dir === "bottom") {
          window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
        }
      }
      if (action.type === "navigate_section") {
        const { route, elementId, tab } = action.payload;
        
        const doScrollAndTab = () => {
          if (tab) {
            window.dispatchEvent(new CustomEvent("switch-police-tab", { detail: tab }));
          }
          setTimeout(() => {
            const el = elementId === "root" ? document.documentElement : document.getElementById(elementId);
            if (el) {
              el.scrollIntoView({ behavior: "smooth", block: "center" });
              if (elementId !== "root") {
                el.classList.add("ring-4", "ring-yellow-500", "ring-offset-2", "ring-offset-slate-950", "transition-all", "duration-500");
                setTimeout(() => {
                  el.classList.remove("ring-4", "ring-yellow-500", "ring-offset-2", "ring-offset-slate-950");
                }, 2500);
              }
            }
          }, 300);
        };

        if (pathname !== route) {
          router.push(route);
          setTimeout(doScrollAndTab, 850);
        } else {
          doScrollAndTab();
        }
      }
    }
  }

  async function handleSpeechCommandSubmit(text: string) {
    if (!text.trim()) return;
    setProcessing(true);
    setInput("");

    try {
      // Step 1: STT Parse
      setOrchestrationStep(1);
      await new Promise((resolve) => setTimeout(resolve, 600));

      // Step 2: NLP Intent Matcher (Fetch API)
      setOrchestrationStep(2);
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

      // Step 3: UI Action Dispatcher
      setOrchestrationStep(3);
      await new Promise((resolve) => setTimeout(resolve, 800));

      setLastResponse(data);
      addHistory("assistant", data.spokenResponse);

      await executeUiActions(data.uiActions ?? []);

      // Step 4: Complete
      setOrchestrationStep(4);
      await new Promise((resolve) => setTimeout(resolve, 1500));
    } catch (e) {
      console.error("Error submitting command:", e);
    } finally {
      setOrchestrationStep(0);
      setProcessing(false);
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          // ignore
        }
      }
    }
  }

  function stopContinuousListening() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current);
      silenceTimeoutRef.current = null;
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch (e) {
        // ignore
      }
      recognitionRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setVoiceRecordingState("idle");
    setRecordingSeconds(0);
  }

  function formatDuration(sec: number) {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }

  useEffect(() => {
    return () => {
      stopContinuousListening();
      if (audioRef.current) {
        audioRef.current.pause();
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

      await executeUiActions(data.uiActions ?? []);
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
            setCallStatus("Ringing...");
          } else if (status === "talking") {
            setCallStatus("Connected...");
          } else if (status === "transcribing") {
            setCallStatus("Finalizing...");
          } else if (status === "completed") {
            setCallStatus("Call Ended");
            setActiveCallId(null);
            
            if (data.transcript) {
              addHistory("assistant", `[Outbound Call Transcript]\n${data.transcript}`);
            } else {
              addHistory("assistant", "Outbound voice call completed successfully.");
            }
            setTimeout(() => setCallStatus(null), 4000);
          } else if (status === "failed" || status === "no-answer" || status === "busy") {
            setCallStatus("Failed");
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
        setCallStatus("Timeout");
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
                        onClick={() => {
                          setSelectedOption("operational");
                          startContinuousListening();
                        }}
                        variant="outline"
                        className="flex flex-col items-start gap-1 p-4 h-auto text-left border-slate-800 hover:border-amber-500/40 hover:bg-amber-500/5 transition-all text-slate-200 cursor-pointer"
                      >
                        <div className="flex items-center gap-2 font-bold text-xs text-slate-100">
                          <Mic className="h-4 w-4 text-amber-400" />
                          Operational Voice Agent
                        </div>
                        <span className="text-[10px] text-slate-400 leading-normal font-normal text-wrap">
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
                        <span className="text-[10px] text-slate-400 leading-normal font-normal text-wrap">
                          Establish live outbound voice calls to field officers to confirm local dispatch instructions.
                        </span>
                      </Button>
                    </div>
                  </div>
                ) : selectedOption === "operational" ? (
                  /* Section 1: Operational Voice Agent View (Continuous hands-free) */
                  <div className="flex flex-col min-h-[380px] justify-between relative py-1">
                    {/* Header with Back button */}
                    <div className="flex items-center justify-between border-b border-slate-900 pb-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          stopContinuousListening();
                          setSelectedOption(null);
                        }}
                        className="text-slate-400 hover:text-slate-200 h-6 px-1.5 text-[10px] gap-1 cursor-pointer"
                      >
                        ← Back
                      </Button>
                      <span className="text-[10px] font-bold text-amber-500 uppercase tracking-widest">
                        Continuous Operational Mode
                      </span>
                    </div>

                    {micPermission === "denied" ? (
                      /* Denied Permission View */
                      <div className="flex flex-col items-center justify-center py-10 text-center gap-3 my-auto">
                        <div className="h-12 w-12 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center">
                          <MicOff className="h-6 w-6" />
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs font-semibold text-slate-200">Microphone Access Denied</p>
                          <p className="text-[10px] text-slate-500 max-w-[240px] leading-relaxed mx-auto">
                            Please enable microphone access in your browser settings to use the continuous hands-free voice agent.
                          </p>
                        </div>
                      </div>
                    ) : (
                      /* Active Continuous Listening Interface */
                      <>
                        {/* 1. Center Top: Text Bar */}
                        <div className="w-full mt-4">
                          <div className="relative flex items-center">
                            <input
                              type="text"
                              value={input}
                              onChange={(e) => {
                                setInput(e.target.value);
                                if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
                                silenceTimeoutRef.current = setTimeout(() => {
                                  handleSpeechCommandSubmit(e.target.value);
                                }, 3000); // 3 seconds timeout for typed inputs
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
                                  handleSpeechCommandSubmit(input);
                                }
                              }}
                              placeholder={processing ? "Processing intent..." : "Speak a command or type here..."}
                              className="w-full text-center rounded-lg border border-slate-800 bg-slate-950/80 px-4 py-2.5 text-xs font-medium text-amber-200 placeholder:text-slate-600 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all shadow-inner"
                              disabled={processing}
                            />
                            {processing && (
                              <div className="absolute right-3 h-3.5 w-3.5 rounded-full border-2 border-amber-500 border-t-transparent animate-spin" />
                            )}
                          </div>
                        </div>

                        {/* 2. Center Middle: Pulsing mic + Continuous speech/recording animation */}
                        <div className="flex flex-col items-center justify-center my-auto gap-4 py-6">
                          <div className="relative flex items-center justify-center">
                            {/* Animated concentric pulsing waves */}
                            <motion.span
                              animate={{
                                scale: [1, 1.8, 1],
                                opacity: [0.15, 0, 0.15],
                              }}
                              transition={{
                                duration: 2,
                                repeat: Infinity,
                                ease: "easeInOut",
                              }}
                              className="absolute inline-flex h-20 w-20 rounded-full bg-amber-500/20"
                            />
                            <motion.span
                              animate={{
                                scale: [1, 2.4, 1],
                                opacity: [0.1, 0, 0.1],
                              }}
                              transition={{
                                duration: 2.5,
                                repeat: Infinity,
                                ease: "easeInOut",
                                delay: 0.5,
                              }}
                              className="absolute inline-flex h-24 w-24 rounded-full bg-amber-500/10"
                            />

                            <div className="h-16 w-16 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center relative shadow-lg shadow-amber-500/40 z-10">
                              <Mic className="h-7 w-7 animate-pulse" />
                            </div>
                          </div>

                          {/* Continuous visualizer bars working continuously as requested */}
                          <div className="flex items-end gap-1.5 h-8 justify-center mt-2">
                            {[0.5, 0.9, 0.6, 1.2, 0.4, 0.8, 1.1, 0.5, 0.8, 0.3].map((heightScale, i) => (
                              <motion.div
                                key={i}
                                animate={{
                                  height: ["10px", `${28 * heightScale}px`, "10px"],
                                }}
                                transition={{
                                  duration: 0.6 + (i % 3) * 0.1,
                                  repeat: Infinity,
                                  delay: i * 0.05,
                                  ease: "easeInOut",
                                }}
                                className="w-1 rounded-full bg-amber-500"
                              />
                            ))}
                          </div>
                        </div>

                        {/* 3. Center Bottom: Active duration or Orchestration */}
                        <div className="w-full text-center space-y-2 border-t border-slate-900 pt-3">
                          {orchestrationStep > 0 ? (
                            /* Center Bottom: Orchestration Sequence */
                            <div className="space-y-2">
                              <div className="text-[10px] font-mono text-slate-400 uppercase tracking-widest font-bold">
                                Orchestrating Command
                              </div>
                              <div className="flex items-center justify-between px-6 text-[9px] font-semibold">
                                <div className={`flex flex-col items-center gap-1 ${orchestrationStep >= 1 ? "text-amber-400" : "text-slate-600"}`}>
                                  <span className={`h-2 w-2 rounded-full ${orchestrationStep === 1 ? "bg-amber-400 animate-ping" : orchestrationStep > 1 ? "bg-emerald-500" : "bg-slate-800"}`} />
                                  <span>1. STT Parse</span>
                                </div>
                                <div className={`h-[1px] flex-1 mx-2 bg-slate-800 ${orchestrationStep > 1 ? "bg-emerald-500/50" : ""}`} />
                                
                                <div className={`flex flex-col items-center gap-1 ${orchestrationStep >= 2 ? "text-amber-400" : "text-slate-600"}`}>
                                  <span className={`h-2 w-2 rounded-full ${orchestrationStep === 2 ? "bg-amber-400 animate-ping" : orchestrationStep > 2 ? "bg-emerald-500" : "bg-slate-800"}`} />
                                  <span>2. NLP Intent</span>
                                </div>
                                <div className={`h-[1px] flex-1 mx-2 bg-slate-800 ${orchestrationStep > 2 ? "bg-emerald-500/50" : ""}`} />

                                <div className={`flex flex-col items-center gap-1 ${orchestrationStep >= 3 ? "text-amber-400" : "text-slate-600"}`}>
                                  <span className={`h-2 w-2 rounded-full ${orchestrationStep === 3 ? "bg-amber-400 animate-ping" : orchestrationStep > 3 ? "bg-emerald-500" : "bg-slate-800"}`} />
                                  <span>3. UI Action</span>
                                </div>
                              </div>
                              <div className="text-[9px] text-slate-500 font-mono italic animate-pulse">
                                {orchestrationStep === 1 && "Parsing voice stream..."}
                                {orchestrationStep === 2 && "Matching pipeline intent..."}
                                {orchestrationStep === 3 && "Executing full-stack update..."}
                                {orchestrationStep === 4 && "⚡ Actions complete. Resuming listener."}
                              </div>
                            </div>
                          ) : (
                            /* Center Bottom: Active duration and guidance */
                            <>
                              <div className="text-[11px] font-mono text-slate-400 font-bold uppercase tracking-wider">
                                Active: {formatDuration(recordingSeconds)}
                              </div>
                              {/* <div className="text-[9px] text-slate-500 max-w-[280px] mx-auto leading-relaxed">
                                💡 Say <span className="text-amber-400 font-medium">"show latest violations"</span>, <span className="text-amber-400 font-medium">"generate route"</span>, or <span className="text-amber-400 font-medium">"approve"</span>.
                                <br />
                                <span className="italic text-slate-600">Continuous hands-free mode. Pause 2.0s to trigger.</span>
                              </div> */}
                            </>
                          )}
                        </div>
                      </>
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
                            placeholder="XXXX"
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

      {/* Viewport-wide yellow borderless vignette ambient edge glow overlay when voice controlled */}
      {isOpen && selectedOption === "operational" && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{
            opacity: voiceRecordingState === "listening" ? [0.65, 1, 0.65] : 0.7,
            boxShadow: voiceRecordingState === "listening"
              ? [
                  "inset 0 0 70px rgba(245, 158, 11, 0.35), inset 0 0 25px rgba(245, 158, 11, 0.18)",
                  "inset 0 0 130px rgba(245, 158, 11, 0.65), inset 0 0 55px rgba(245, 158, 11, 0.35)",
                  "inset 0 0 70px rgba(245, 158, 11, 0.35), inset 0 0 25px rgba(245, 158, 11, 0.18)"
                ]
              : "inset 0 0 60px rgba(245, 158, 11, 0.3), inset 0 0 20px rgba(245, 158, 11, 0.15)"
          }}
          transition={{
            duration: 2.2,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          className="fixed inset-0 pointer-events-none z-[99999]"
        />
      )}
    </>
  );
}
