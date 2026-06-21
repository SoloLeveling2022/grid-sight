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
  HelpCircle,
  Zap,
  Sliders,
  Radio
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface Scenario {
  id: string;
  category: "core" | "usp" | "innovative" | "operations";
  title: string;
  description: string;
  steps: string[];
  activeNodes: string[]; // Nodes that should glow in the UI diagram
  techNotes: string;
}

const SCENARIOS: Scenario[] = [
  // ─── Core Features ──────────────────────────────────────────────────────────
  {
    id: "mappls-map",
    category: "core",
    title: "Mappls SDK Map Integration",
    description: "Renders high-performance interactive maps with search capability, customized marker rendering, and real-time routing coordinate overlays.",
    steps: [
      "Next.js Client App mounts the Map component wrapper on page load.",
      "The Map component dynamically loads vector tile scripts and sets viewport coordinate bounds.",
      "If network offline or SDK key fails, map defaults to local interactive SVG vector fallback.",
      "Dashboard fetches live traffic segments and incidents data from traffic telemetry REST endpoints.",
      "Plotted markers are rendered as circular vector buffers scaled by incident count and congestion score."
    ],
    activeNodes: ["dashboard", "traffic-api"],
    techNotes: "Files: src/components/map/gridsight-map.tsx, src/services/map/mappls-sdk.ts | SDK: Mappls Vector Tile SDK"
  },
  {
    id: "validation-queue",
    category: "core",
    title: "Unified Case Validation Queue",
    description: "Provides a centralized dashboard with search and filter controls where operators can multi-select, approve, reject, or flag duplicate violation cases.",
    steps: [
      "Operator filters queue by station, violation class, and status (default: pending).",
      "Zustand store queries search endpoint on REST API Engine.",
      "Backend performs query limits and regex match filters on Cloud NoSQL Database.",
      "Operator checks multiple violations and triggers bulk validation action POST.",
      "Backend updates validation states and audit timestamps in database, optimistically updating UI tabs."
    ],
    activeNodes: ["dashboard", "fastapi", "mongodb"],
    techNotes: "Endpoints: GET /api/violations/search, POST /api/violations/{id}/validate | Files: ml-service/app/routes/violations.py, src/app/police/page.tsx"
  },
  {
    id: "citizen-reports",
    category: "core",
    title: "Citizen Obstruction Reporting",
    description: "Enables citizen personas to submit roadside parking obstruction reports with location and image uploads, syncing instantly to the validation queue.",
    steps: [
      "Citizen opens public advisory page and inputs location details and vehicle plate.",
      "Citizen uploads an evidence photo of the obstruction.",
      "Form converts image to Base64 and sends ingestion request to REST API Engine.",
      "Backend writes image to static storage or S3 bucket and generates a public URL.",
      "Insert new case record into Cloud NoSQL Database with status 'pending', showing instantly in operator queue."
    ],
    activeNodes: ["citizen", "fastapi", "mongodb", "dashboard"],
    techNotes: "Endpoints: POST /api/violations/ingest | Files: ml-service/app/services/storage.py, src/app/citizen/page.tsx"
  },
  {
    id: "camera-simulator",
    category: "core",
    title: "Interactive Polygon Zone Editor & AI Camera Inference Simulator",
    description: "Renders a custom drawing widget on the map allowing operators to define no-parking polygons, track stationary vehicles, and auto-ingest tickets if vehicles remain static for >= 10 seconds.",
    steps: [
      "Operator draws zone polygon coordinates directly on the map canvas.",
      "Map component caches vertices in Zustand store under cameraZones.",
      "Operator mounts CCTV Simulator which tracks vehicle centroid bounding boxes.",
      "Tracker POSTs frame data (bounding box coordinates, polygon vertices, time index) to FastAPI.",
      "Backend executes Ray Casting point-in-polygon math; if vehicle remains static >= 10s, it auto-ingests a parking violation."
    ],
    activeNodes: ["camera", "fastapi", "mongodb", "dashboard"],
    techNotes: "Endpoints: POST /api/violations/detect-parking | Files: ml-service/app/routes/violations.py, src/app/police/page.tsx (Simulator)"
  },
  
  // ─── USPs ──────────────────────────────────────────────────────────────────
  {
    id: "congestion-ml",
    category: "usp",
    title: "Congestion Impact Quantification",
    description: "Predicts traffic speed drops and expected delay minutes using a Random Forest model combined with live Traffic Telemetry API inputs.",
    steps: [
      "Operator clicks violation card to view details in the dashboard queue sidebar.",
      "Client requests impact predictions from backend by posting incident coordinates.",
      "Backend loads pre-trained scikit-learn Random Forest model (congestion_model.pkl).",
      "Queries live traffic flow API for current vs. free-flow speeds.",
      "Blends model prediction (40%) and live speed drop telemetry (60%) to return delay minutes and congestion scores."
    ],
    activeNodes: ["dashboard", "fastapi", "ml-models", "traffic-api"],
    techNotes: "Endpoints: POST /api/ml/predict-impact | Models: congestion_model.pkl (Random Forest) | Files: ml-service/app/predict.py"
  },
  {
    id: "fine-invoicing",
    category: "usp",
    title: "Traffic Fine Invoicing & Revenue Projections",
    description: "Simulates fine invoicing based on violation types and generates real-time municipal revenue projections with interactive graphs.",
    steps: [
      "Operator selects approved violation cases and clicks 'Generate Invoice'.",
      "Backend queries penalty rule matrix to calculate fine amounts per offense code.",
      "Invoice record is saved to Cloud NoSQL Database, generating dynamic payment links.",
      "System aggregates all active invoices by month, class, and payment status.",
      "Renders expected vs. collected revenue charts on municipal dashboard panels."
    ],
    activeNodes: ["dashboard", "fastapi", "mongodb"],
    techNotes: "Endpoints: GET /api/finance/revenue-projection | Files: ml-service/app/routes/finance.py"
  },
  {
    id: "voice-outreach",
    category: "usp",
    title: "Voice Telephony Automated Outreach",
    description: "Outbound dispatch agent using voice calls to alert field officers with live status logs and automatic post-call transcription.",
    steps: [
      "Operator clicks 'Call Dispatcher' in the voice agent drawer.",
      "Dashboard POSTs junction details, officer name, and coordinates to Next.js API.",
      "API issues REST request to Voice Telephony Gateway.",
      "Gateway dials the officer's phone, delivering spoken incident alerts.",
      "Dashboard polls status API to trace call states and appends final transcript to logs."
    ],
    activeNodes: ["voice-ui", "next-api", "telephony-gateway"],
    techNotes: "Endpoints: POST /api/voice/call, GET /api/voice/call/status | Files: src/app/api/voice/call/route.ts"
  },
  {
    id: "offence-clustering",
    category: "usp",
    title: "Offence Clustering Heatmaps",
    description: "Groups historical logs using DBSCAN clustering to identify peak violation centroids, peak hours, and proximity to sensitive places like schools and hospitals.",
    steps: [
      "Backend loads DBSCAN model (hotspot_clustering.pkl) on startup.",
      "Aggregates coordinate logs from MongoDB database using density parameters.",
      "Extracts centroids, total violations, peak hours, and schools proximity.",
      "JSON centroids list is sent to client store to update map coordinates.",
      "Map component calculates weights (weight = incidentCount * congestionScore) and renders the heatmap layer."
    ],
    activeNodes: ["dashboard", "fastapi", "ml-models", "mongodb", "traffic-api"],
    techNotes: "Endpoints: GET /api/ml/hotspots | Models: hotspot_clustering.pkl (DBSCAN Clustering) | Files: ml-service/app/routes/ml.py"
  },

  // ─── Innovative Features ──────────────────────────────────────────────────
  {
    id: "drone-planner",
    category: "innovative",
    title: "Drone Route Planner & Video Ingest Simulator",
    description: "Automatically calculates the most efficient patrol flight paths for unmanned drones across major junctions and simulates video stream ingestion.",
    steps: [
      "Operator clicks 'Launch Drone Simulation' on dashboard control panel.",
      "Server calculates patrol routing waypoints using priority TSP heuristic.",
      "Video stream simulator reads coordinates and generates simulated CCTV frame packets.",
      "Packets are POSTed to REST API Engine for real-time validation checks.",
      "Drone coordinates and status are updated live on the map overlay."
    ],
    activeNodes: ["drone", "fastapi", "ml-models", "dashboard"],
    techNotes: "Endpoints: GET /api/ml/drone-route | Files: ml-service/app/routes/drone.py"
  },
  {
    id: "rerouting-nav",
    category: "innovative",
    title: "Intelligent Rerouting & Navigation API",
    description: "Generates alternate routing paths for citizens to safely bypass traffic incidents and active violation hotspots.",
    steps: [
      "Citizen inputs origin and destination coordinates on the public advisory portal.",
      "Citizen store queries highest-ranked enforcement priority coordinates.",
      "Navigation router calculates detour path bypassing active hotspots.",
      "Renders standard route in red and detour route in green.",
      "Displays detour direction instructions (e.g. 'Standard route congested; detour via alternate path')."
    ],
    activeNodes: ["citizen", "fastapi", "traffic-api", "dashboard"],
    techNotes: "Files: src/app/citizen/page.tsx, src/components/map/gridsight-map.tsx"
  },
  {
    id: "traffic-light-analytics",
    category: "innovative",
    title: "AI-Driven Smart Traffic Light Signal Analytics",
    description: "Analyzes vehicle density logs at junctions to simulate adaptive traffic light cycles, minimizing waiting time.",
    steps: [
      "Smart junction sensors send lane-wise vehicle queue counts.",
      "Backend runs signal analytics logic to compute optimized green durations.",
      "Computes optimized traffic light state cycles.",
      "Signal timers update state in the database.",
      "Dashboard displays live junction status and traffic light cycle timelines."
    ],
    activeNodes: ["traffic-light", "fastapi", "ml-models", "dashboard"],
    techNotes: "Endpoints: GET /api/traffic-light/analytics | Files: ml-service/app/routes/signals.py"
  },
  {
    id: "multi-agent-solver",
    category: "innovative",
    title: "Multi-Agent Agentic LLM Solver",
    description: "Spawns agentic LLM solvers to resolve complex traffic logs, analyze reports, and output structured operational advice.",
    steps: [
      "Operator inputs a general query (e.g. 'Solve Magadi Road congestion').",
      "Orchestrator spawns specialized agents (Data Analyst, Dispatch Planner, Traffic Engineer).",
      "Agents exchange context, query database, and run ML impact predictions.",
      "Agents synthesize recommendations and output structured JSON advice.",
      "Next.js app renders conversational results and actionable dispatch buttons."
    ],
    activeNodes: ["dashboard", "fastapi", "agentic-llm", "mongodb"],
    techNotes: "Endpoints: POST /api/agentic/solve | LLM Engine: Multi-Agent LLM Solver API"
  },

  // ─── Operations & Analytics ────────────────────────────────────────────────
  {
    id: "device-health",
    category: "operations",
    title: "Live Device Health Monitoring",
    description: "Real-time ping telemetry tracking CCTV camera status, network connectivity, latency, and sensor diagnostic logs.",
    steps: [
      "Dashboard ping service fires heartbeat request to active devices.",
      "Devices respond with latency, FPS, memory usage, and operational status.",
      "Server logs response statistics in database.",
      "Alert trigger flags cameras with latency > 500ms or offline status.",
      "Dashboard displays live health grid with status badges."
    ],
    activeNodes: ["dashboard", "fastapi", "camera", "traffic-light"],
    techNotes: "Endpoints: GET /api/devices/health | Files: ml-service/app/routes/devices.py"
  },
  {
    id: "sla-analytics",
    category: "operations",
    title: "SLA & Response Analytics",
    description: "Tracks municipal ticket resolution times, citizen report responses, and police patrol dispatch SLA compliance.",
    steps: [
      "Case state transitions (e.g., pending -> approved -> closed) log time indices.",
      "Server aggregates elapsed duration from ticket creation to patrol closure.",
      "Compares actual duration with SLA limits (e.g., 30 minutes).",
      "Computes compliance rates per police station.",
      "Renders SLA trends and target benchmarks on analytics tab."
    ],
    activeNodes: ["dashboard", "fastapi", "mongodb"],
    techNotes: "Endpoints: GET /api/analytics/sla | Files: ml-service/app/routes/analytics.py"
  },
  {
    id: "roster-resource",
    category: "operations",
    title: "Dynamic Roster & Resource Management",
    description: "Allocates traffic police personnel and patrol vehicles based on real-time junction congestion and priority weights.",
    steps: [
      "System queries current shift rosters and active patrol positions.",
      "Scans enforcement priority scores to find high-need hotspots.",
      "Dispatch recommendation algorithm matches roster to hotspots.",
      "Operator confirms allocation, alerting officer phone.",
      "Updates roster statuses live on the operations panel."
    ],
    activeNodes: ["dashboard", "fastapi", "mongodb"],
    techNotes: "Endpoints: GET /api/roster/allocation | Files: ml-service/app/routes/roster.py"
  },
  {
    id: "operator-productivity",
    category: "operations",
    title: "Operator Productivity Dashboard",
    description: "Tracks police queue validation statistics, average check times, approval rates, and individual operator work rates.",
    steps: [
      "Database logs operator email, action type, and validation durations.",
      "Server queries validations collection (limiting to 20,000 cases).",
      "Groups metrics by operator, calculating total processed and error rate.",
      "Calculates average validation speed (seconds per case).",
      "Renders comparative bar charts on productivity tab."
    ],
    activeNodes: ["dashboard", "fastapi", "mongodb"],
    techNotes: "Endpoints: GET /api/analytics/operator-productivity | Files: ml-service/app/routes/analytics.py"
  },
  {
    id: "prompt-playground",
    category: "operations",
    title: "System Config & AI Prompt Playground",
    description: "Allows administrators to adjust congestion model weights, prompt LLM solvers, and configure edge sensor parameters live.",
    steps: [
      "Admin opens the system config playground panel.",
      "Updates parameters (e.g. static vehicle time, Random Forest weight).",
      "Modifies the system prompt template for multi-agent LLM solver.",
      "Clicking save POSTs new config variables to backend.",
      "Backend reloads config into memory, updating inference rules immediately."
    ],
    activeNodes: ["prompt-playground", "fastapi", "agentic-llm"],
    techNotes: "Endpoints: POST /api/config/update | Files: ml-service/app/routes/config.py"
  }
];

export default function ArchitecturePage() {
  const [activeScenario, setActiveScenario] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<"all" | "core" | "usp" | "innovative" | "operations">("all");
  const [copied, setCopied] = useState(false);

  const getIsActive = (nodeId: string) => {
    if (!activeScenario) return false;
    const scenario = SCENARIOS.find((s) => s.id === activeScenario);
    return scenario ? scenario.activeNodes.includes(nodeId) : false;
  };

  // const handleCopyMermaid = () => {
  //   navigator.clipboard.writeText(MERMAID_CODE);
  //   setCopied(true);
  //   setTimeout(() => setCopied(false), 2000);
  // };

  const filteredScenarios = SCENARIOS.filter(
    (s) => categoryFilter === "all" || s.category === categoryFilter
  );

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
            Complete data flow mapping of GridSight's 17 features: Ingestion, machine learning inference, Cloud Database scaling, and voice dispatch.
          </p>
        </div>

        {/* Section 1: Interactive flow and Diagram */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-16">
          {/* Left panel: Scenario selector */}
          <div className="lg:col-span-4 flex flex-col gap-4">
            <div className="rounded-xl border border-slate-800/80 bg-slate-900/25 p-5 backdrop-blur-sm">
              <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                <Activity className="h-4 w-4 text-amber-500 animate-pulse" />
                Select System Feature
              </h2>
              <p className="text-xs text-slate-500 mb-4 leading-relaxed">
                Choose a category and select any of the 17 features to view its database flow paths and specs:
              </p>

              {/* Category tabs */}
              <div className="grid grid-cols-2 gap-1.5 mb-4">
                {[
                  { id: "all", label: "All (17)" },
                  { id: "core", label: "Core" },
                  { id: "usp", label: "USPs" },
                  { id: "innovative", label: "Innovative" },
                  { id: "operations", label: "Ops/Voice" }
                ].map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => {
                      setCategoryFilter(cat.id as any);
                      setActiveScenario(null);
                    }}
                    className={`px-2 py-1 text-[11px] rounded-md border font-medium cursor-pointer text-center transition-all ${
                      categoryFilter === cat.id
                        ? "bg-amber-500/20 border-amber-500/40 text-amber-400"
                        : "bg-slate-900/60 border-slate-850 text-slate-400 hover:border-slate-700"
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              {/* Feature buttons */}
              <div className="flex flex-col gap-2 max-h-[350px] overflow-y-auto pr-1 scrollbar-thin">
                {filteredScenarios.map((scen) => (
                  <button
                    key={scen.id}
                    onClick={() => setActiveScenario(activeScenario === scen.id ? null : scen.id)}
                    className={`w-full text-left p-3 rounded-lg border transition-all duration-300 text-xs cursor-pointer relative overflow-hidden ${
                      activeScenario === scen.id
                        ? "bg-amber-500/10 border-amber-500/40 text-amber-400 font-semibold shadow-inner"
                        : "bg-slate-900/40 border-slate-800 hover:border-slate-700 text-slate-300 hover:bg-slate-900/60"
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <span className="truncate pr-2">{scen.title}</span>
                      <ChevronRight className={`h-3 w-3 shrink-0 transition-transform duration-300 ${
                        activeScenario === scen.id ? "rotate-90 text-amber-400" : "text-slate-500"
                      }`} />
                    </div>
                  </button>
                ))}
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
                        <span className="px-2 py-0.5 rounded bg-amber-500/20 text-[9px] text-amber-400 uppercase tracking-widest font-semibold border border-amber-500/30">
                          Data Pathway
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mb-4 font-medium italic">
                        {scen.description}
                      </p>
                      <ol className="list-decimal list-outside pl-4 space-y-3 mb-4">
                        {scen.steps.map((step, idx) => (
                          <li key={idx} className="text-[11px] text-slate-300 leading-relaxed pl-1">
                            {step}
                          </li>
                        ))}
                      </ol>
                      <div className="border-t border-slate-800 pt-3 text-[10px] text-slate-400 font-mono flex flex-col gap-1">
                        <span className="text-amber-500 uppercase tracking-wider text-[8px] font-bold">Specs / Files</span>
                        <span className="break-all">{scen.techNotes}</span>
                      </div>
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
                <div className="flex flex-col gap-4">
                  <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-800 pb-2">
                    1. INGESTION & EDGE LAYER
                  </h4>
                  
                  {/* CCTV Cameras */}
                  <div className={`p-3 rounded-xl border transition-all duration-300 flex flex-col gap-1.5 ${
                    getIsActive("camera")
                      ? "bg-amber-500/10 border-amber-500 shadow-md shadow-amber-500/5 text-amber-400"
                      : activeScenario 
                        ? "bg-slate-900/10 border-slate-900/60 text-slate-650 opacity-45"
                        : "bg-slate-900/40 border-slate-800 text-slate-200"
                  }`}>
                    <div className="flex items-center gap-2">
                      <Camera className="h-4 w-4" />
                      <span className="font-semibold text-xs">Edge AI CCTV Feed</span>
                    </div>
                    <p className="text-[10px] text-slate-400 leading-relaxed">
                      Virtual polygon zones & stationary vehicle simulators.
                    </p>
                    <span className="text-[9px] font-mono opacity-60">POST /detect-parking</span>
                  </div>

                  {/* Citizen Reports */}
                  <div className={`p-3 rounded-xl border transition-all duration-300 flex flex-col gap-1.5 ${
                    getIsActive("citizen")
                      ? "bg-amber-500/10 border-amber-500 shadow-md shadow-amber-500/5 text-amber-400"
                      : activeScenario 
                        ? "bg-slate-900/10 border-slate-900/60 text-slate-650 opacity-45"
                        : "bg-slate-900/40 border-slate-800 text-slate-200"
                  }`}>
                    <div className="flex items-center gap-2">
                      <Smartphone className="h-4 w-4" />
                      <span className="font-semibold text-xs">Citizen Portal / Form</span>
                    </div>
                    <p className="text-[10px] text-slate-400 leading-relaxed">
                      Citizen reports & advisory portal for route detours.
                    </p>
                    <span className="text-[9px] font-mono opacity-60">POST /violations/ingest</span>
                  </div>

                  {/* Drone Simulator */}
                  <div className={`p-3 rounded-xl border transition-all duration-300 flex flex-col gap-1.5 ${
                    getIsActive("drone")
                      ? "bg-amber-500/10 border-amber-500 shadow-md shadow-amber-500/5 text-amber-400"
                      : activeScenario 
                        ? "bg-slate-900/10 border-slate-900/60 text-slate-650 opacity-45"
                        : "bg-slate-900/40 border-slate-800 text-slate-200"
                  }`}>
                    <div className="flex items-center gap-2">
                      <Zap className="h-4 w-4" />
                      <span className="font-semibold text-xs">Drone Flight Simulator</span>
                    </div>
                    <p className="text-[10px] text-slate-400 leading-relaxed">
                      Patrol drones verifying hotspots and ingesting stream packets.
                    </p>
                    <span className="text-[9px] font-mono opacity-60">GET /ml/drone-route</span>
                  </div>

                  {/* Smart Signals */}
                  <div className={`p-3 rounded-xl border transition-all duration-300 flex flex-col gap-1.5 ${
                    getIsActive("traffic-light")
                      ? "bg-amber-500/10 border-amber-500 shadow-md shadow-amber-500/5 text-amber-400"
                      : activeScenario 
                        ? "bg-slate-900/10 border-slate-900/60 text-slate-650 opacity-45"
                        : "bg-slate-900/40 border-slate-800 text-slate-200"
                  }`}>
                    <div className="flex items-center gap-2">
                      <Activity className="h-4 w-4" />
                      <span className="font-semibold text-xs">Smart Light Signals</span>
                    </div>
                    <p className="text-[10px] text-slate-400 leading-relaxed">
                      Telemetry tracking vehicle queues and Adaptive cycle times.
                    </p>
                    <span className="text-[9px] font-mono opacity-60">GET /signals/analytics</span>
                  </div>

                  {/* Historical Offence Logs */}
                  <div className={`p-3 rounded-xl border transition-all duration-300 flex flex-col gap-1.5 ${
                    getIsActive("logs")
                      ? "bg-amber-500/10 border-amber-500 shadow-md shadow-amber-500/5 text-amber-400"
                      : activeScenario 
                        ? "bg-slate-900/10 border-slate-900/60 text-slate-650 opacity-45"
                        : "bg-slate-900/40 border-slate-800 text-slate-200"
                  }`}>
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      <span className="font-semibold text-xs">Historical Offence Logs</span>
                    </div>
                    <p className="text-[10px] text-slate-400 leading-relaxed">
                      298k+ historical incidents compiled into analytics datasets.
                    </p>
                    <span className="text-[9px] font-mono opacity-60">Offence Dataset File</span>
                  </div>
                </div>

                {/* Column 2: Orchestration */}
                <div className="flex flex-col gap-4">
                  <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-800 pb-2">
                    2. ORCHESTRATION & ROUTING
                  </h4>

                  {/* Next.js Control Dashboard */}
                  <div className={`p-3 rounded-xl border transition-all duration-300 flex flex-col gap-1.5 ${
                    getIsActive("dashboard")
                      ? "bg-amber-500/10 border-amber-500 shadow-md shadow-amber-500/5 text-amber-400"
                      : activeScenario 
                        ? "bg-slate-900/10 border-slate-900/60 text-slate-650 opacity-45"
                        : "bg-slate-900/40 border-slate-800 text-slate-200"
                  }`}>
                    <div className="flex items-center gap-2">
                      <Layers className="h-4 w-4" />
                      <span className="font-semibold text-xs">Next.js Client App</span>
                    </div>
                    <p className="text-[10px] text-slate-400 leading-relaxed">
                      React 19 App with Zustand stores mapping backend schemas.
                    </p>
                    <span className="text-[9px] font-mono opacity-60">Zustand Client Stores</span>
                  </div>

                  {/* FastAPI Python Backend */}
                  <div className={`p-3 rounded-xl border transition-all duration-300 flex flex-col gap-1.5 ${
                    getIsActive("fastapi")
                      ? "bg-amber-500/10 border-amber-500 shadow-md shadow-amber-500/5 text-amber-400"
                      : activeScenario 
                        ? "bg-slate-900/10 border-slate-900/60 text-slate-650 opacity-45"
                        : "bg-slate-900/40 border-slate-800 text-slate-200"
                  }`}>
                    <div className="flex items-center gap-2">
                      <Cpu className="h-4 w-4" />
                      <span className="font-semibold text-xs">REST API Engine (FastAPI)</span>
                    </div>
                    <p className="text-[10px] text-slate-400 leading-relaxed">
                      Python service serving predictions, validations, and analytics.
                    </p>
                    <span className="text-[9px] font-mono opacity-60">FastAPI / Uvicorn Server</span>
                  </div>

                  {/* Next.js Server API Routes */}
                  <div className={`p-3 rounded-xl border transition-all duration-300 flex flex-col gap-1.5 ${
                    getIsActive("next-api")
                      ? "bg-amber-500/10 border-amber-500 shadow-md shadow-amber-500/5 text-amber-400"
                      : activeScenario 
                        ? "bg-slate-900/10 border-slate-900/60 text-slate-650 opacity-45"
                        : "bg-slate-900/40 border-slate-800 text-slate-200"
                  }`}>
                    <div className="flex items-center gap-2">
                      <Cpu className="h-4 w-4" />
                      <span className="font-semibold text-xs">Next.js Serverless Routes</span>
                    </div>
                    <p className="text-[10px] text-slate-400 leading-relaxed">
                      Handles outbound telephony alerts and webhook notifications.
                    </p>
                    <span className="text-[9px] font-mono opacity-60">/api/voice/*</span>
                  </div>

                  {/* Voice UI Command Center */}
                  <div className={`p-3 rounded-xl border transition-all duration-300 flex flex-col gap-1.5 ${
                    getIsActive("voice-ui")
                      ? "bg-amber-500/10 border-amber-500 shadow-md shadow-amber-500/5 text-amber-400"
                      : activeScenario 
                        ? "bg-slate-900/10 border-slate-900/60 text-slate-650 opacity-45"
                        : "bg-slate-900/40 border-slate-800 text-slate-200"
                  }`}>
                    <div className="flex items-center gap-2">
                      <Mic className="h-4 w-4" />
                      <span className="font-semibold text-xs">Intelligent Voice Agent</span>
                    </div>
                    <p className="text-[10px] text-slate-400 leading-relaxed">
                      Floating agent routing microphone inputs to Zustand store actions.
                    </p>
                    <span className="text-[9px] font-mono opacity-60">Speech Intent Parser</span>
                  </div>

                  {/* Prompt Playground */}
                  <div className={`p-3 rounded-xl border transition-all duration-300 flex flex-col gap-1.5 ${
                    getIsActive("prompt-playground")
                      ? "bg-amber-500/10 border-amber-500 shadow-md shadow-amber-500/5 text-amber-400"
                      : activeScenario 
                        ? "bg-slate-900/10 border-slate-900/60 text-slate-650 opacity-45"
                        : "bg-slate-900/40 border-slate-800 text-slate-200"
                  }`}>
                    <div className="flex items-center gap-2">
                      <Sliders className="h-4 w-4" />
                      <span className="font-semibold text-xs">Prompt Config Playground</span>
                    </div>
                    <p className="text-[10px] text-slate-400 leading-relaxed">
                      UI panel adjusting model weights and editing agent LLM prompts.
                    </p>
                    <span className="text-[9px] font-mono opacity-60">Config Admin Panel</span>
                  </div>
                </div>

                {/* Column 3: Intelligence & Core Data */}
                <div className="flex flex-col gap-4">
                  <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-800 pb-2">
                    3. INTELLIGENCE & CORE DATA
                  </h4>

                  {/* Cloud Database */}
                  <div className={`p-3 rounded-xl border transition-all duration-300 flex flex-col gap-1.5 ${
                    getIsActive("mongodb")
                      ? "bg-amber-500/10 border-amber-500 shadow-md shadow-amber-500/5 text-amber-400"
                      : activeScenario 
                        ? "bg-slate-900/10 border-slate-900/60 text-slate-650 opacity-45"
                        : "bg-slate-900/40 border-slate-800 text-slate-200"
                  }`}>
                    <div className="flex items-center gap-2">
                      <Database className="h-4 w-4" />
                      <span className="font-semibold text-xs">Cloud NoSQL Database</span>
                    </div>
                    <p className="text-[10px] text-slate-400 leading-relaxed">
                      Stores offences and validations; processes heavy aggregations.
                    </p>
                    <span className="text-[9px] font-mono opacity-60">NoSQL Document Store</span>
                  </div>

                  {/* ML Models */}
                  <div className={`p-3 rounded-xl border transition-all duration-300 flex flex-col gap-1.5 ${
                    getIsActive("ml-models")
                      ? "bg-amber-500/10 border-amber-500 shadow-md shadow-amber-500/5 text-amber-400"
                      : activeScenario 
                        ? "bg-slate-900/10 border-slate-900/60 text-slate-650 opacity-45"
                        : "bg-slate-900/40 border-slate-800 text-slate-200"
                  }`}>
                    <div className="flex items-center gap-2">
                      <Cpu className="h-4 w-4" />
                      <span className="font-semibold text-xs">ML Model Core</span>
                    </div>
                    <p className="text-[10px] text-slate-400 leading-relaxed">
                      DBSCAN clustering and Random Forest predicting congestion delay.
                    </p>
                    <span className="text-[9px] font-mono opacity-60">scikit-learn Model PKLs</span>
                  </div>

                  {/* Maps & Traffic APIs */}
                  <div className={`p-3 rounded-xl border transition-all duration-300 flex flex-col gap-1.5 ${
                    getIsActive("traffic-api")
                      ? "bg-amber-500/10 border-amber-500 shadow-md shadow-amber-500/5 text-amber-400"
                      : activeScenario 
                        ? "bg-slate-900/10 border-slate-900/60 text-slate-650 opacity-45"
                        : "bg-slate-900/40 border-slate-800 text-slate-200"
                  }`}>
                    <div className="flex items-center gap-2">
                      <Map className="h-4 w-4" />
                      <span className="font-semibold text-xs">Vector Map SDK & Flow APIs</span>
                    </div>
                    <p className="text-[10px] text-slate-400 leading-relaxed">
                      Dynamic maps rendering vector tiles and live speed congestion layers.
                    </p>
                    <span className="text-[9px] font-mono opacity-60">Map SDK & Telemetry APIs</span>
                  </div>

                  {/* Telephony Gateway */}
                  <div className={`p-3 rounded-xl border transition-all duration-300 flex flex-col gap-1.5 ${
                    getIsActive("telephony-gateway")
                      ? "bg-amber-500/10 border-amber-500 shadow-md shadow-amber-500/5 text-amber-400"
                      : activeScenario 
                        ? "bg-slate-900/10 border-slate-900/60 text-slate-650 opacity-45"
                        : "bg-slate-900/40 border-slate-800 text-slate-200"
                  }`}>
                    <div className="flex items-center gap-2">
                      <PhoneCall className="h-4 w-4" />
                      <span className="font-semibold text-xs">Voice Telephony Gateway</span>
                    </div>
                    <p className="text-[10px] text-slate-400 leading-relaxed">
                      Dials patrol officer mobiles, playing structured alert speech.
                    </p>
                    <span className="text-[9px] font-mono opacity-60">Outbound Telephony API</span>
                  </div>

                  {/* Agentic LLM Orchestrator */}
                  <div className={`p-3 rounded-xl border transition-all duration-300 flex flex-col gap-1.5 ${
                    getIsActive("agentic-llm")
                      ? "bg-amber-500/10 border-amber-500 shadow-md shadow-amber-500/5 text-amber-400"
                      : activeScenario 
                        ? "bg-slate-900/10 border-slate-900/60 text-slate-650 opacity-45"
                        : "bg-slate-900/40 border-slate-800 text-slate-200"
                  }`}>
                    <div className="flex items-center gap-2">
                      <Radio className="h-4 w-4" />
                      <span className="font-semibold text-xs">Multi-Agent LLM Solver</span>
                    </div>
                    <p className="text-[10px] text-slate-400 leading-relaxed">
                      Collaborative LLM agents resolving complex traffic logs.
                    </p>
                    <span className="text-[9px] font-mono opacity-60">LLM Multi-Agent System</span>
                  </div>
                </div>

              </div>
              
              {/* Reset Helper */}
              {!activeScenario && (
                <div className="mt-8 text-center text-xs text-slate-500 flex items-center justify-center gap-1">
                  <HelpCircle className="h-3 w-3" />
                  <span>Tip: Select a system feature in the left panel to trace live data propagation pathways.</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Section 2: Download Premium Slides Graphic */}
        {/* <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center bg-slate-900/30 border border-slate-800 rounded-2xl p-8 mb-16 relative overflow-hidden">
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
        </div> */}

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
                highlight: "Hydrates backend payloads and maps snake_case DB models to camelCase fields."
              },
              {
                layer: "Backend & Ingestion",
                stack: "Python FastAPI, Uvicorn, Pydantic, PyMongo drivers",
                highlight: "CORS configured, high-throughput asynchronous execution, static evidence storage."
              },
              {
                layer: "Databases & ML Models",
                stack: "Cloud NoSQL Database, scikit-learn Models (DBSCAN + Random Forest Regression)",
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
        {/* <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-6 relative overflow-hidden">
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
        </div> */}
      </main>
    </div>
  );
}

// function CodeIcon(props: React.SVGProps<SVGSVGElement>) {
//   return (
//     <svg
//       {...props}
//       xmlns="http://www.w3.org/2000/svg"
//       width="24"
//       height="24"
//       viewBox="0 0 24 24"
//       fill="none"
//       stroke="currentColor"
//       strokeWidth="2"
//       strokeLinecap="round"
//       strokeLinejoin="round"
//     >
//       <polyline points="16 18 22 12 16 6" />
//       <polyline points="8 6 2 12 8 18" />
//     </svg>
//   );
// }

// const MERMAID_CODE = `flowchart TB
//     %% Styling definitions
//     classDef ingest fill:#1e293b,stroke:#ffd700,stroke-width:2px,color:#f8fafc;
//     classDef routing fill:#0f172a,stroke:#3b82f6,stroke-width:1.5px,color:#f8fafc;
//     classDef model fill:#1e1b4b,stroke:#d97706,stroke-width:1.5px,color:#f8fafc;
//     classDef db fill:#022c22,stroke:#10b981,stroke-width:1.5px,color:#f8fafc;
//     classDef client fill:#030712,stroke:#f59e0b,stroke-width:2px,color:#f8fafc;

//     %% Ingestion Layer
//     subgraph Ingestion ["Ingestion & Edge Layer"]
//         CCTV["Edge AI CCTV Feed<br/>(Stationary detection)"]:::ingest
//         Citizen["Citizen Portal / Form<br/>(Advisory portal)"]:::ingest
//         Drone["Drone Flight Simulator<br/>(Aerial verification)"]:::ingest
//         Signals["Smart Light Signals<br/>(Junction telemetry)"]:::ingest
//         Logs["Historical Offence Logs<br/>(298k+ records)"]:::ingest
//     end

//     %% Application & API Layer
//     subgraph Orchestration ["Orchestration & API Layer"]
//         FastAPI["REST API Engine<br/>(Python/FastAPI)"]:::routing
//         NextAPI["Next.js Server API Routes<br/>(Telephony Webhooks)"]:::routing
//         VoiceAgent["Intelligent Voice Agent<br/>(Speech-to-Action Parser)"]:::routing
//         Playground["Prompt Playground<br/>(Config panel)"]:::routing
//     end

//     %% Intelligence Layer
//     subgraph Engine ["Analytics & Machine Learning Engine"]
//         DBSCAN["ML Model Core<br/>(DBSCAN Clustering)"]:::model
//         RFModel["ML Model Core<br/>(Random Forest Regressor)"]:::model
//         LLMOrch["Multi-Agent LLM Solver<br/>(Collaborative solvers)"]:::model
//     end

//     %% Data & Third-party integrations
//     subgraph Storage ["Datastores & Third-Party APIs"]
//         Atlas["Cloud NoSQL Database<br/>(NoSQL Document Store)"]:::db
//         LiveTraffic["Vector Map SDK & Flow APIs<br/>(Map SDK & Flow Telemetry)"]:::db
//         Telephony["Voice Telephony Gateway<br/>(Outbound Telephony API)"]:::db
//     end

//     %% Client Presentation Layer
//     subgraph Clients ["Operational Interfaces (Next.js)"]
//         Dashboard["Next.js Client App<br/>(Zustand Stores)"]:::client
//         PublicView["Citizen Portal / Form<br/>(Detour advisory /citizen)"]:::client
//     end

//     %% Connections
//     CCTV -.-> IngestionAPI["/api/violations/detect-parking"]
//     IngestionAPI --> FastAPI
//     Citizen --> PublicView
//     PublicView --> NextAPI
//     Drone --> FastAPI
//     Signals --> FastAPI
//     Logs --> FastAPI

//     FastAPI --> Atlas
//     FastAPI --> DBSCAN
//     FastAPI --> RFModel
//     FastAPI --> LLMOrch

//     RFModel --> LiveTraffic
//     LLMOrch --> Atlas

//     Dashboard --> FastAPI
//     PublicView --> FastAPI
//     VoiceAgent --> NextAPI
//     NextAPI --> Telephony
//     Playground --> FastAPI
//     Playground --> LLMOrch

//     Dashboard <--> VoiceAgent`;
