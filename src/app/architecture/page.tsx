"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { 
  ArrowLeft, 
  Camera, 
  Database, 
  Cpu, 
  Layers, 
  Smartphone, 
  Activity, 
  FileText, 
  PhoneCall, 
  Mic, 
  Copy, 
  Check, 
  Download, 
  ExternalLink,
  ChevronRight,
  TrendingUp,
  Map,
  Shield,
  HelpCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";

// Color maps for active states
interface HighlightedNode {
  [key: string]: boolean;
}

interface Scenario {
  id: string;
  title: string;
  description: string;
  steps: string[];
  activeNodes: string[]; // Nodes that should glow
  techNotes: string;
}

const SCENARIOS: Scenario[] = [
  {
    id: "camera",
    title: "1. Edge AI Camera Ingestion Flow",
    description: "How roadside CCTV cameras automatically detect violations and feed them into the police queue.",
    steps: [
      "Operator draws a virtual 'no-parking' polygon over a high-incident corridor on the map.",
      "The CCTV feed monitors the area and tracks stationary vehicles within the polygon.",
      "Once stationary time exceeds 10 seconds, a violation is detected.",
      "CCTV Simulator POSTs the details (camera ID, coordinate polygon, evidence image) to `/api/violations/detect-parking`.",
      "FastAPI backend saves the evidence to storage (local/S3) and inserts the record into MongoDB Atlas with 'pending' validation status.",
      "The Police Dashboard validation queue automatically updates, highlighting the new case for inspection."
    ],
    activeNodes: ["camera", "fastapi", "mongodb", "dashboard"],
    techNotes: "FastAPI endpoint: /api/violations/detect-parking | Data model status: 'pending'"
  },
  {
    id: "ml-impact",
    title: "2. Congestion Impact Inference Flow",
    description: "Quantifying how much delay a parking violation is actually causing to current traffic flow.",
    steps: [
      "Operator clicks on an active violation from the pending list.",
      "Dashboard triggers a POST request to FastAPI endpoint `/api/ml/predict-impact`.",
      "FastAPI loads a pre-trained scikit-learn Random Forest model (congestion_model.pkl).",
      "The backend queries live speed/flow telemetry at coordinates using the TomTom Traffic API.",
      "FastAPI blends historical ML predictions (40%) and live speed-drop data (60%) to compute traffic indicators.",
      "Response returns exact delay in minutes, expected speed drop, congestion score, and dispatch recommendation."
    ],
    activeNodes: ["dashboard", "fastapi", "ml-models", "traffic-api"],
    techNotes: "Model: Random Forest Regression (congestion_model.pkl) blended with live speed flow telemetry."
  },
  {
    id: "routing",
    title: "3. Smart Patrol Route Dispatch Flow",
    description: "Optimizing the path police officers take to clear the maximum traffic delay.",
    steps: [
      "Operator requests patrol routing optimization from the dashboard or via voice agent command.",
      "Next.js queries FastAPI endpoint `/api/ml/enforcement-priorities`.",
      "FastAPI calculates a multi-factor priority score combining violation density (DBSCAN), expected delay, sensitive spots, and time of day.",
      "Backend runs a routing heuristic (TSP variant) starting from the highest priority hotspot.",
      "Cost function balances geographical distance against priority score and open incident workload.",
      "The optimal waypoints and path lines are rendered as a custom detour overlay on the live police map."
    ],
    activeNodes: ["dashboard", "voice-ui", "fastapi", "ml-models", "mongodb", "maps-sdk"],
    techNotes: "DBSCAN Centroid Clustering (hotspot_clustering.pkl) + Haversine TSP Route Heuristic."
  },
  {
    id: "voice-call",
    title: "4. Outbound AI Call Dispatcher Flow",
    description: "Connecting digital analytics to field action by calling patrolling officers.",
    steps: [
      "Operator selects a hotspot and triggers the Call Dispatcher from the floating Voice Agent.",
      "The Voice UI triggers a POST request to Next.js API route `/api/voice/call`.",
      "Next.js API formats the context (officer role, location name, obstruction description) and triggers Ringg AI Outbound Call API.",
      "Ringg AI calls the officer, delivers the dispatch summary, and records feedback.",
      "Next.js polls `/api/voice/call/status` to grab live ringing, talking, and transcription events.",
      "The final call transcription is synced back to the dashboard chat history for validation auditing."
    ],
    activeNodes: ["voice-ui", "next-api", "ringg-api"],
    techNotes: "Outbound Call Service: Ringg AI Voice Agent API Integration with live status polling."
  }
];

export default function ArchitecturePage() {
  const [activeScenario, setActiveScenario] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const getIsActive = (nodeId: string) => {
    if (!activeScenario) return false;
    const scenario = SCENARIOS.find((s) => s.id === activeScenario);
    return scenario ? scenario.activeNodes.includes(nodeId) : false;
  };

  const handleCopyMermaid = () => {
    navigator.clipboard.writeText(MERMAID_CODE);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 relative antialiased pb-20">
      {/* Background radial glow */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-500/5 via-transparent to-transparent pointer-events-none" />
      
      {/* Dotted grid background */}
      <div 
        className="absolute inset-0 opacity-10 pointer-events-none" 
        style={{
          backgroundImage: "radial-gradient(rgba(245, 158, 11, 0.15) 1px, transparent 0)",
          backgroundSize: "24px 24px"
        }}
      />

      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/40 backdrop-blur-md sticky top-0 z-40">
        <div className="mx-auto max-w-7xl px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2 group/logo">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <Layers className="h-5 w-5" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-slate-100 tracking-wide">GridSight</span>
                <span className="text-[10px] text-amber-500 font-medium uppercase tracking-wider">Architecture</span>
              </div>
            </Link>
          </div>
          
          <Link href="/">
            <Button variant="outline" size="sm" className="gap-2 cursor-pointer border-slate-800 hover:bg-slate-800 hover:text-white">
              <ArrowLeft className="h-4 w-4" />
              Back to Pitch
            </Button>
          </Link>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="mx-auto max-w-7xl px-4 pt-10 relative">
        {/* Title */}
        <div className="mb-10 text-center max-w-3xl mx-auto">
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 uppercase tracking-widest">
            Hackathon Blueprint
          </span>
          <h1 className="text-3xl md:text-5xl font-bold tracking-tight mt-4 mb-3">
            System Architecture
          </h1>
          <p className="text-slate-400 text-base md:text-lg">
            High-throughput analytics, machine learning predictive models, and voice operations engineered for Bengaluru Traffic Police.
          </p>
        </div>

        {/* Section 1: Interactive flow and Diagram */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-16">
          {/* Left panel: Scenario selector */}
          <div className="lg:col-span-4 flex flex-col gap-4">
            <div className="rounded-xl border border-slate-800/80 bg-slate-900/25 p-5 backdrop-blur-sm">
              <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                <Activity className="h-4 w-4 text-amber-500 animate-pulse" />
                Select In-App Flow Scenario
              </h2>
              <p className="text-xs text-slate-500 mb-4 leading-relaxed">
                Click on a scenario below to trace and highlight the active data paths and microservice components in the architecture layout.
              </p>

              <div className="flex flex-col gap-2">
                {SCENARIOS.map((scen) => (
                  <button
                    key={scen.id}
                    onClick={() => setActiveScenario(activeScenario === scen.id ? null : scen.id)}
                    className={`w-full text-left p-3.5 rounded-lg border transition-all duration-300 text-sm cursor-pointer relative overflow-hidden ${
                      activeScenario === scen.id
                        ? "bg-amber-500/10 border-amber-500/40 text-amber-400 font-semibold"
                        : "bg-slate-900/40 border-slate-800 hover:border-slate-700 text-slate-300 hover:bg-slate-900/60"
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <span>{scen.title.split(" - ")[0]}</span>
                      <ChevronRight className={`h-4 w-4 transition-transform duration-300 ${
                        activeScenario === scen.id ? "rotate-90 text-amber-400" : "text-slate-500"
                      }`} />
                    </div>
                  </button>
                ))}
                {activeScenario && (
                  <button
                    onClick={() => setActiveScenario(null)}
                    className="mt-2 text-center text-xs text-slate-500 hover:text-amber-400 transition-colors py-1 underline cursor-pointer"
                  >
                    Clear scenario filters
                  </button>
                )}
              </div>
            </div>

            {/* Scenario walkthrough details */}
            {activeScenario && (
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.02] p-5 backdrop-blur-sm animate-in fade-in slide-in-from-bottom-2 duration-300">
                {(() => {
                  const scen = SCENARIOS.find((s) => s.id === activeScenario);
                  if (!scen) return null;
                  return (
                    <>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="px-2 py-0.5 rounded bg-amber-500/20 text-[10px] text-amber-400 uppercase tracking-widest font-semibold border border-amber-500/30">
                          Active Path
                        </span>
                        <span className="text-[11px] text-slate-500 font-mono">{scen.techNotes}</span>
                      </div>
                      <p className="text-xs text-slate-400 mb-4 font-medium italic">
                        {scen.description}
                      </p>
                      <ol className="list-decimal list-outside pl-4 space-y-3">
                        {scen.steps.map((step, idx) => (
                          <li key={idx} className="text-xs text-slate-300 leading-relaxed pl-1">
                            {step}
                          </li>
                        ))}
                      </ol>
                    </>
                  );
                })()}
              </div>
            )}
          </div>

          {/* Right panel: Dynamic Grid-based Architecture Diagram */}
          <div className="lg:col-span-8 flex flex-col gap-6">
            <div className="rounded-xl border border-slate-800 bg-[#0b101c]/90 p-6 shadow-2xl relative overflow-hidden min-h-[500px]">
              <div className="absolute top-4 right-4 flex items-center gap-2">
                <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] text-slate-500 uppercase tracking-wider font-mono">Live Interactive View</span>
              </div>
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-8">
                System Block Architecture
              </h3>

              {/* Diagram Layout */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative z-10">
                
                {/* Column 1: Ingestion */}
                <div className="flex flex-col gap-6">
                  <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-800 pb-2">
                    1. INGESTION & DATA INFLOW
                  </h4>
                  
                  {/* CCTV Cameras */}
                  <div className={`p-4 rounded-xl border transition-all duration-300 flex flex-col gap-2 ${
                    getIsActive("camera")
                      ? "bg-amber-500/10 border-amber-500 shadow-md shadow-amber-500/5 text-amber-400"
                      : activeScenario 
                        ? "bg-slate-900/10 border-slate-900/60 text-slate-600 opacity-40"
                        : "bg-slate-900/40 border-slate-800 text-slate-200"
                  }`}>
                    <div className="flex items-center gap-2">
                      <Camera className="h-4 w-4" />
                      <span className="font-semibold text-xs">Edge AI CCTV Feed</span>
                    </div>
                    <p className="text-[10px] text-slate-400 leading-relaxed">
                      Virtual no-parking zone monitoring & stationary-time analysis.
                    </p>
                    <span className="text-[9px] font-mono opacity-60">POST /detect-parking</span>
                  </div>

                  {/* Citizen Reports */}
                  <div className={`p-4 rounded-xl border transition-all duration-300 flex flex-col gap-2 ${
                    getIsActive("citizen")
                      ? "bg-amber-500/10 border-amber-500 shadow-md shadow-amber-500/5 text-amber-400"
                      : activeScenario 
                        ? "bg-slate-900/10 border-slate-900/60 text-slate-600 opacity-40"
                        : "bg-slate-900/40 border-slate-800 text-slate-200"
                  }`}>
                    <div className="flex items-center gap-2">
                      <Smartphone className="h-4 w-4" />
                      <span className="font-semibold text-xs">Citizen Portal Reports</span>
                    </div>
                    <p className="text-[10px] text-slate-400 leading-relaxed">
                      Public portal for route detours and reporting local obstacles.
                    </p>
                    <span className="text-[9px] font-mono opacity-60">POST /violations/ingest</span>
                  </div>

                  {/* Legacy Log File */}
                  <div className={`p-4 rounded-xl border transition-all duration-300 flex flex-col gap-2 ${
                    getIsActive("logs")
                      ? "bg-amber-500/10 border-amber-500 shadow-md shadow-amber-500/5 text-amber-400"
                      : activeScenario 
                        ? "bg-slate-900/10 border-slate-900/60 text-slate-600 opacity-40"
                        : "bg-slate-900/40 border-slate-800 text-slate-200"
                  }`}>
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      <span className="font-semibold text-xs">Bengaluru Traffic Logs</span>
                    </div>
                    <p className="text-[10px] text-slate-400 leading-relaxed">
                      298k+ historical incidents compiled into analytics pipelines.
                    </p>
                    <span className="text-[9px] font-mono opacity-60">Astram Incident Dataset</span>
                  </div>
                </div>

                {/* Column 2: Application Routing */}
                <div className="flex flex-col gap-6">
                  <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-800 pb-2">
                    2. ORCHESTRATION & ROUTING
                  </h4>

                  {/* Next.js Control Dashboard */}
                  <div className={`p-4 rounded-xl border transition-all duration-300 flex flex-col gap-2 ${
                    getIsActive("dashboard")
                      ? "bg-amber-500/10 border-amber-500 shadow-md shadow-amber-500/5 text-amber-400"
                      : activeScenario 
                        ? "bg-slate-900/10 border-slate-900/60 text-slate-600 opacity-40"
                        : "bg-slate-900/40 border-slate-800 text-slate-200"
                  }`}>
                    <div className="flex items-center gap-2">
                      <Layers className="h-4 w-4" />
                      <span className="font-semibold text-xs">Next.js Web Client</span>
                    </div>
                    <p className="text-[10px] text-slate-400 leading-relaxed">
                      React 19 App with Zustand states mapping snake_case payload integrations.
                    </p>
                    <span className="text-[9px] font-mono opacity-60">Zustand Client Stores</span>
                  </div>

                  {/* FastAPI Python Backend */}
                  <div className={`p-4 rounded-xl border transition-all duration-300 flex flex-col gap-2 ${
                    getIsActive("fastapi")
                      ? "bg-amber-500/10 border-amber-500 shadow-md shadow-amber-500/5 text-amber-400"
                      : activeScenario 
                        ? "bg-slate-900/10 border-slate-900/60 text-slate-600 opacity-40"
                        : "bg-slate-900/40 border-slate-800 text-slate-200"
                  }`}>
                    <div className="flex items-center gap-2">
                      <Cpu className="h-4 w-4" />
                      <span className="font-semibold text-xs">FastAPI ML Core</span>
                    </div>
                    <p className="text-[10px] text-slate-400 leading-relaxed">
                      Python high-throughput microservice handling ML inference & queues.
                    </p>
                    <span className="text-[9px] font-mono opacity-60">Uvicorn / Pydantic Contracts</span>
                  </div>

                  {/* Next.js Server API Routes */}
                  <div className={`p-4 rounded-xl border transition-all duration-300 flex flex-col gap-2 ${
                    getIsActive("next-api")
                      ? "bg-amber-500/10 border-amber-500 shadow-md shadow-amber-500/5 text-amber-400"
                      : activeScenario 
                        ? "bg-slate-900/10 border-slate-900/60 text-slate-600 opacity-40"
                        : "bg-slate-900/40 border-slate-800 text-slate-200"
                  }`}>
                    <div className="flex items-center gap-2">
                      <Cpu className="h-4 w-4" />
                      <span className="font-semibold text-xs">Next.js Server API</span>
                    </div>
                    <p className="text-[10px] text-slate-400 leading-relaxed">
                      Serverless API routes bridging Ringg AI voice sessions and dispatch calls.
                    </p>
                    <span className="text-[9px] font-mono opacity-60">/api/voice/*</span>
                  </div>

                  {/* Voice UI Command Center */}
                  <div className={`p-4 rounded-xl border transition-all duration-300 flex flex-col gap-2 ${
                    getIsActive("voice-ui")
                      ? "bg-amber-500/10 border-amber-500 shadow-md shadow-amber-500/5 text-amber-400"
                      : activeScenario 
                        ? "bg-slate-900/10 border-slate-900/60 text-slate-600 opacity-40"
                        : "bg-slate-900/40 border-slate-800 text-slate-200"
                  }`}>
                    <div className="flex items-center gap-2">
                      <Mic className="h-4 w-4" />
                      <span className="font-semibold text-xs">Intelligent Voice Agent</span>
                    </div>
                    <p className="text-[10px] text-slate-400 leading-relaxed">
                      Floating command center translating spoken commands into dashboard triggers.
                    </p>
                    <span className="text-[9px] font-mono opacity-60">Speech-to-Action Parser</span>
                  </div>
                </div>

                {/* Column 3: Engine & Datastores */}
                <div className="flex flex-col gap-6">
                  <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-800 pb-2">
                    3. INTELLIGENCE & CORE DATA
                  </h4>

                  {/* MongoDB Atlas */}
                  <div className={`p-4 rounded-xl border transition-all duration-300 flex flex-col gap-2 ${
                    getIsActive("mongodb")
                      ? "bg-amber-500/10 border-amber-500 shadow-md shadow-amber-500/5 text-amber-400"
                      : activeScenario 
                        ? "bg-slate-900/10 border-slate-900/60 text-slate-600 opacity-40"
                        : "bg-slate-900/40 border-slate-800 text-slate-200"
                  }`}>
                    <div className="flex items-center gap-2">
                      <Database className="h-4 w-4" />
                      <span className="font-semibold text-xs">MongoDB Atlas</span>
                    </div>
                    <p className="text-[10px] text-slate-400 leading-relaxed">
                      Dynamic database holding cases, coordinates, and officer productivity metrics.
                    </p>
                    <span className="text-[9px] font-mono opacity-60">PyMongo Aggregations</span>
                  </div>

                  {/* ML Models */}
                  <div className={`p-4 rounded-xl border transition-all duration-300 flex flex-col gap-2 ${
                    getIsActive("ml-models")
                      ? "bg-amber-500/10 border-amber-500 shadow-md shadow-amber-500/5 text-amber-400"
                      : activeScenario 
                        ? "bg-slate-900/10 border-slate-900/60 text-slate-600 opacity-40"
                        : "bg-slate-900/40 border-slate-800 text-slate-200"
                  }`}>
                    <div className="flex items-center gap-2">
                      <Cpu className="h-4 w-4" />
                      <span className="font-semibold text-xs">ML Models (scikit-learn)</span>
                    </div>
                    <p className="text-[10px] text-slate-400 leading-relaxed">
                      DBSCAN clustering hotspots and Random Forest predicting congestion delay.
                    </p>
                    <span className="text-[9px] font-mono opacity-60">Pickle Artifact Files</span>
                  </div>

                  {/* Maps & Traffic APIs */}
                  <div className={`p-4 rounded-xl border transition-all duration-300 flex flex-col gap-2 ${
                    getIsActive("traffic-api") || getIsActive("maps-sdk")
                      ? "bg-amber-500/10 border-amber-500 shadow-md shadow-amber-500/5 text-amber-400"
                      : activeScenario 
                        ? "bg-slate-900/10 border-slate-900/60 text-slate-600 opacity-40"
                        : "bg-slate-900/40 border-slate-800 text-slate-200"
                  }`}>
                    <div className="flex items-center gap-2">
                      <Map className="h-4 w-4" />
                      <span className="font-semibold text-xs">TomTom & Mappls APIs</span>
                    </div>
                    <p className="text-[10px] text-slate-400 leading-relaxed">
                      Live speed-flow telemetry and vector map route detour overlays.
                    </p>
                    <span className="text-[9px] font-mono opacity-60">Traffic Flow / Routing</span>
                  </div>

                  {/* Ringg AI Outbound Calling */}
                  <div className={`p-4 rounded-xl border transition-all duration-300 flex flex-col gap-2 ${
                    getIsActive("ringg-api")
                      ? "bg-amber-500/10 border-amber-500 shadow-md shadow-amber-500/5 text-amber-400"
                      : activeScenario 
                        ? "bg-slate-900/10 border-slate-900/60 text-slate-600 opacity-40"
                        : "bg-slate-900/40 border-slate-800 text-slate-200"
                  }`}>
                    <div className="flex items-center gap-2">
                      <PhoneCall className="h-4 w-4" />
                      <span className="font-semibold text-xs">Ringg AI Outbound Call</span>
                    </div>
                    <p className="text-[10px] text-slate-400 leading-relaxed">
                      Converts operational dashboard alerts into live dispatcher calls to officers.
                    </p>
                    <span className="text-[9px] font-mono opacity-60">Outbound call dispatch</span>
                  </div>

                </div>

              </div>
              
              {/* Reset Helper */}
              {!activeScenario && (
                <div className="mt-8 text-center text-xs text-slate-500 flex items-center justify-center gap-1">
                  <HelpCircle className="h-3 w-3" />
                  <span>Tip: Select a scenario in the left panel to trace live data propagation pathways.</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Section 2: Download Premium Slides Graphic */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center bg-slate-900/30 border border-slate-800 rounded-2xl p-8 mb-16 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-amber-500/5 via-transparent to-transparent pointer-events-none" />
          <div className="md:col-span-7 flex flex-col gap-4">
            <span className="px-3 py-1 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 w-fit uppercase tracking-widest">
              Ready for PPTX/PDF Slides
            </span>
            <h2 className="text-2xl font-bold tracking-tight text-slate-100">
              Download High-Resolution Pitch Slide Diagram
            </h2>
            <p className="text-sm text-slate-400 leading-relaxed">
              We generated an extremely clean, minimal software architecture block diagram matching the Bengaluru Traffic Police theme. Download it in high-res PNG format to put directly in your hackathon pitch presentation slides.
            </p>
            <div className="flex flex-wrap gap-4 mt-2">
              <a 
                href="/gridsight_architecture.png" 
                download="GridSight_System_Architecture.png"
                className="inline-flex items-center justify-center"
              >
                <Button className="gap-2 cursor-pointer font-medium hover:scale-[1.02] transition-transform duration-300">
                  <Download className="h-4 w-4" />
                  Download PNG (High-Res)
                </Button>
              </a>
              <a 
                href="/gridsight_architecture.png" 
                target="_blank" 
                rel="noreferrer"
                className="inline-flex items-center justify-center"
              >
                <Button variant="outline" className="gap-2 cursor-pointer border-slate-800 hover:bg-slate-800 hover:text-white">
                  <ExternalLink className="h-4 w-4" />
                  Open in New Tab
                </Button>
              </a>
            </div>
          </div>

          <div className="md:col-span-5 flex justify-center md:justify-end">
            <div className="relative group overflow-hidden rounded-xl border border-slate-800/80 bg-slate-950 p-1.5 shadow-2xl transition-all duration-300 hover:border-amber-500/20 max-w-[280px]">
              <div className="absolute inset-0 bg-gradient-to-tr from-amber-500/10 via-transparent to-transparent opacity-40 blur-xl pointer-events-none" />
              <Image
                src="/gridsight_architecture.png"
                alt="GridSight High-Res Architecture Slide Preview"
                width={300}
                height={200}
                className="rounded-lg object-cover w-full h-auto opacity-90 group-hover:opacity-100 transition-opacity duration-300"
              />
            </div>
          </div>
        </div>

        {/* Section 3: Tech Stack Matrix */}
        <div className="mb-16">
          <h2 className="text-xl font-semibold text-slate-200 mb-6 flex items-center gap-2">
            <Layers className="h-5 w-5 text-amber-500" />
            GridSight Technical Stack Matrix
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[
              {
                layer: "Frontend & UI Core",
                stack: "Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS, Lucide icons",
                highlight: "Serverless rendering, fast navigation, client-side routing structures."
              },
              {
                layer: "State Management",
                stack: "Zustand Client Stores (Police, Violation, Citizen, Voice)",
                highlight: "Hydrates FastAPI payload contracts and maps snake_case DB models to camelCase fields."
              },
              {
                layer: "Backend & Ingestion",
                stack: "Python FastAPI, Uvicorn, Pydantic, PyMongo Atlas driver",
                highlight: "CORS configured, high-throughput asynchronous execution, static evidence storage."
              },
              {
                layer: "Databases & ML Models",
                stack: "MongoDB Atlas Cloud, scikit-learn Models (DBSCAN + Random Forest Regression)",
                highlight: "DBSCAN clusters spatial coordinates; Random Forest predicts traffic delay."
              }
            ].map((item, idx) => (
              <div key={idx} className="rounded-xl border border-slate-800 bg-slate-900/10 p-5 hover:border-slate-700/80 transition-all duration-300">
                <span className="text-[10px] text-amber-500 uppercase tracking-widest font-bold font-mono">
                  {item.layer}
                </span>
                <p className="text-sm font-semibold text-slate-200 mt-2 mb-1">{item.stack}</p>
                <p className="text-xs text-slate-400 leading-relaxed mt-2">{item.highlight}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Section 4: Copyable Mermaid Code */}
        <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-6 relative overflow-hidden">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <CodeIcon className="h-4 w-4 text-amber-500" />
              Copyable Mermaid Diagram Code (for Github / Slides)
            </h2>
            <Button
              onClick={handleCopyMermaid}
              size="sm"
              variant="outline"
              className="gap-1.5 h-8 text-xs border-slate-800 cursor-pointer hover:bg-slate-900 text-slate-300 hover:text-white"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-500" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  Copy Code
                </>
              )}
            </Button>
          </div>
          <p className="text-xs text-slate-400 mb-4 leading-relaxed">
            Copy and paste this Mermaid markdown code block directly into your reports, documentation, or slides to render a high-quality vector flow diagram.
          </p>
          <pre className="text-xs text-slate-400 bg-slate-900/60 border border-slate-800 rounded-lg p-4 font-mono overflow-x-auto max-h-[300px] leading-relaxed select-all">
            {MERMAID_CODE}
          </pre>
        </div>
      </main>
    </div>
  );
}

function CodeIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </svg>
  );
}

const MERMAID_CODE = `flowchart TB
    %% Styling definitions
    classDef ingest fill:#1e293b,stroke:#ffd700,stroke-width:2px,color:#f8fafc;
    classDef routing fill:#0f172a,stroke:#3b82f6,stroke-width:1.5px,color:#f8fafc;
    classDef model fill:#1e1b4b,stroke:#d97706,stroke-width:1.5px,color:#f8fafc;
    classDef db fill:#022c22,stroke:#10b981,stroke-width:1.5px,color:#f8fafc;
    classDef client fill:#030712,stroke:#f59e0b,stroke-width:2px,color:#f8fafc;

    %% Ingestion Layer
    subgraph Ingestion ["Ingestion & Edge Layer"]
        CCTV["AI Camera Feed<br/>(Stationary detection)"]:::ingest
        Citizen["Citizen Reports<br/>(Advisory portal)"]:::ingest
        Logs["CSV Offence Logs<br/>(298k+ records)"]:::ingest
    end

    %% Application & API Layer
    subgraph Orchestration ["Orchestration & API Layer"]
        FastAPI["FastAPI ML Service<br/>(Python/Uvicorn)"]:::routing
        NextAPI["Next.js API Routes<br/>(Outbound calls)"]:::routing
    end

    %% Intelligence Layer
    subgraph Engine ["Analytics & Machine Learning Engine"]
        DBSCAN["DBSCAN Hotspots<br/>(Clustering pickle)"]:::model
        RFModel["Random Forest ML<br/>(Congestion impact)"]:::model
        Router["Patrol Optimizer<br/>(Priority-based cost)"]:::model
    end

    %% Data & Third-party integrations
    subgraph Storage ["Datastores & Third-Party APIs"]
        Atlas["MongoDB Atlas<br/>(violations collection)"]:::db
        LiveTraffic["TomTom Traffic API<br/>(Live flow & speed)"]:::db
        RinggAI["Ringg AI Call API<br/>(Voice dispatcher)"]:::db
    end

    %% Client Presentation Layer
    subgraph Clients ["Operational Interfaces (Next.js)"]
        Dashboard["Police Dashboard<br/>(Case validation queue)"]:::client
        PublicView["Citizen Portal<br/>(Detour advisory /citizen)"]:::client
        VoiceAgent["Voice Assistant<br/>(Floating command agent)"]:::client
    end

    %% Connections
    CCTV -.-> IngestionAPI["/api/violations/detect-parking"]
    IngestionAPI --> FastAPI
    Citizen --> PublicView
    PublicView --> NextAPI
    Logs --> FastAPI

    FastAPI --> Atlas
    FastAPI --> DBSCAN
    FastAPI --> RFModel
    FastAPI --> Router

    RFModel --> LiveTraffic
    Router --> LiveTraffic

    Dashboard --> FastAPI
    PublicView --> FastAPI
    VoiceAgent --> NextAPI
    NextAPI --> RinggAI

    Dashboard <--> VoiceAgent`;
