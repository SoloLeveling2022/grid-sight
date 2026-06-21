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
      "Backend writes image to static storage and generates a public URL.",
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
    id: "outcome-loop",
    category: "usp",
    title: "Enforcement Outcomes Feedback Loop",
    description: "Dynamically simulates patrol dispatch, updating map weights to show an 85% traffic delay reduction on case closure.",
    steps: [
      "Active corridor is flagged as severe on the dashboard showing high expected delay.",
      "Operator clicks 'Dispatch Patrol' to assign units (state changes: NoPatrol -> Dispatched).",
      "Patrol clears the vehicle and operator logs clearing action (state: Dispatched -> ActionTaken).",
      "Operator clicks 'Close Case' to archive the violation (state: ActionTaken -> Closed).",
      "Zustand store intercepts action and scales expected delay by 0.15 (85% reduction) locally.",
      "Heatmap overlay updates instantly, reducing color intensity to represent resolved traffic flow."
    ],
    activeNodes: ["dashboard", "mongodb"],
    techNotes: "State machine managed in Zustand store: useViolationPoliceStore"
  },
  {
    id: "mongo-atlas",
    category: "usp",
    title: "MongoDB Atlas Database Integration",
    description: "Establishes a native MongoClient connection to Atlas MongoDB instead of local SQLite, executing high-throughput aggregation pipelines for real-time KPIs across 298k+ records.",
    steps: [
      "FastAPI server reads database credentials from environment variables on startup.",
      "Establishes a native MongoClient connection using secure TLS certs.",
      "Endpoints leverage database aggregation frameworks to group, filter, and count records on the fly.",
      "Pipelines use allowDiskUse=True to process large datasets (298k+ records) with optimized filters.",
      "Results are cached or sent as serialized JSON payloads back to Next.js Client App."
    ],
    activeNodes: ["fastapi", "mongodb"],
    techNotes: "Files: ml-service/app/models/database.py | Library: PyMongo (MongoClient with TLS)"
  },

  // ─── Innovative Features ──────────────────────────────────────────────────
  {
    id: "dbscan-clustering",
    category: "innovative",
    title: "DBSCAN Spatial Hotspot Clustering",
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
  {
    id: "priority-scoring",
    category: "innovative",
    title: "Multi-Factor Enforcement Priority Scoring",
    description: "Computes a dynamic priority index (0-100) using violation density, expected delay, repeat offender rate, sensitive zone weight, and queue workload.",
    steps: [
      "Backend queries database to fetch active, unvalidated violations.",
      "Scores are calculated per hotspot using a weighted multi-factor formula.",
      "Factors check keyword lists (school, hospital, metro, crossing) to apply sensitive zone boosts.",
      "Results are ranked descending and categorized into Severity levels (Low, Medium, High, Severe) to focus patrol routing."
    ],
    activeNodes: ["fastapi", "mongodb", "dashboard"],
    techNotes: "Endpoints: GET /api/ml/enforcement-priorities | Formula: (Violations * 0.75) + (Repeat Offenders * 4.0) + (Sensitive Zones * 8.0) + (Open Cases * 0.25)"
  },
  {
    id: "weighted-heatmap",
    category: "innovative",
    title: "Real Weighted Heatmap",
    description: "Renders map hotspots with size and opacity weighted by traffic impact, with filters for time of day, police station, and violation type.",
    steps: [
      "Map component loads coordinate list from hotspots endpoint.",
      "Calculates weight for each coordinate: weight = incidentCount * congestionScore.",
      "Passes coordinates and weights to the map's native heatmap canvas layer.",
      "Renders color intensities (Red = severe delay, Green = low delay) on the map.",
      "Dropdown filters (time, station) update Zustand store, filtering coordinates and redrawing the heatmap."
    ],
    activeNodes: ["dashboard", "traffic-api"],
    techNotes: "Files: src/components/map/gridsight-map.tsx, src/app/police/page.tsx | Weight Formula: incidentCount * congestionScore"
  },
  {
    id: "patrol-routing",
    category: "innovative",
    title: "Optimized Patrol Routing",
    description: "Automatically calculates the most efficient routing waypoints across hotspots using a travel distance vs. priority cost heuristic, rendering starting-point indicators and navigation lines.",
    steps: [
      "Operator prompts 'Generate patrol route' via Voice UI or dashboard button.",
      "Dashboard requests route coordinates from backend endpoint.",
      "FastAPI server runs a Travelling Salesperson (TSP) heuristic starting at highest priority hotspot.",
      "Cost algorithm discounts distance weight if adjacent waypoints have severe delay or high case count.",
      "Returns optimal coordinates connected via live routing APIs and drawn as a thick blue line on the map."
    ],
    activeNodes: ["dashboard", "fastapi", "ml-models", "traffic-api"],
    techNotes: "Endpoints: GET /api/ml/patrol-route | Heuristic: Haversine TSP Route Heuristic | Files: ml-service/app/routes/ml.py"
  },

  // ─── Operations & Analytics ────────────────────────────────────────────────
  {
    id: "recidivism-analytics",
    category: "operations",
    title: "Recidivism Analytics",
    description: "Groups violations by vehicle registration plates to analyze offender frequency, locations, and individual repeat-offender scores.",
    steps: [
      "Operator selects 'Offenders' panel in the dashboard sidebar.",
      "FastAPI aggregates violations collection grouping by vehicle registration plate.",
      "Limits query scope to the latest 20,000 cases to prevent database cluster RAM limit crashes.",
      "Calculates Enforcement Score using vehicle infraction frequency, location diversity, and severity boosts.",
      "Returns sorted offenders list, allowing operator to click a plate to filter all its cases on the map."
    ],
    activeNodes: ["dashboard", "fastapi", "mongodb"],
    techNotes: "Endpoints: GET /api/violations/repeat-offenders | Formula: (Case Count * 12) + (Severity Boost * 20) + (Station Count * 6)"
  },
  {
    id: "device-productivity",
    category: "operations",
    title: "Device Productivity Analytics",
    description: "Tracks speed and CCTV camera capture rates, validating approval/rejection statistics and identifying primary violation types per device.",
    steps: [
      "Client requests device capture statistics.",
      "FastAPI groups violations collection by capture source device_id (limiting to latest 20,000 cases).",
      "Aggregates total captures, approval counts, rejection counts, and duplicate counts.",
      "Computes validation metrics (e.g. approval rate = approved / total * 100) to identify faulty cameras.",
      "Returns statistics to render workload and productivity Recharts graphs on the dashboard."
    ],
    activeNodes: ["dashboard", "fastapi", "mongodb"],
    techNotes: "Endpoints: GET /api/violations/device-productivity | Files: ml-service/app/routes/violations.py"
  },
  {
    id: "hotspot-inspector",
    category: "operations",
    title: "Interactive Hotspot Inspector",
    description: "Displays detailed hotspot metrics (unique vehicles, peak hours, sensitive places, and dispatch controls) inside a sidebar.",
    steps: [
      "Operator clicks a hotspot coordinate marker or ranks card.",
      "Map click handler stores selected junction name in Zustand store.",
      "Junction details panel mounts in the sidebar, displaying unique vehicles, peak hours, and sensitive place proximities.",
      "Renders a mini live traffic telemetry card showing current vs. free-flow speeds.",
      "Activates Dispatch Patrol and Call Dispatcher controls centered on the coordinate context."
    ],
    activeNodes: ["dashboard"],
    techNotes: "Files: src/app/police/page.tsx, src/components/dashboard/*"
  },
  {
    id: "alternate-routing",
    category: "operations",
    title: "Alternate Route Planner",
    description: "Generates alternate routing paths for citizens to safely bypass traffic incidents and active violation hotspots.",
    steps: [
      "Citizen enters origin and destination on advisory page.",
      "Citizen store queries highest-ranked enforcement priority coordinates from database.",
      "Planner calculates standard routing path and alternate path bypassing the hotspot.",
      "Renders standard route in red and detour route in green.",
      "Displays detour direction instructions (e.g. 'Standard route congested; detour via alternate path')."
    ],
    activeNodes: ["citizen", "fastapi", "traffic-api", "dashboard"],
    techNotes: "Files: src/app/citizen/page.tsx, src/components/map/gridsight-map.tsx"
  },
  {
    id: "voice-commands",
    category: "operations",
    title: "Intelligent Voice Agent",
    description: "Enables conversational control using a deterministic voice command parser to filter maps, calculate routes, and trigger interface actions.",
    steps: [
      "Operator types a command or triggers microphone in the floating agent drawer.",
      "Next.js API endpoint parses query to classify semantic intent against a set of predefined commands.",
      "API returns command intent, spoken text response, and UI actions.",
      "Zustand store dispatches matching UI reducer action (e.g. filter by station, show route).",
      "Next.js client updates layout elements, focuses map, and plays voice audio confirmation."
    ],
    activeNodes: ["voice-ui", "next-api", "dashboard"],
    techNotes: "Endpoints: POST /api/voice/command | Files: src/components/voice/voice-agent.tsx, src/store/index.ts | Parser: Deterministic command intent matcher"
  },
  {
    id: "call-dispatcher",
    category: "operations",
    title: "Outbound Call Dispatcher",
    description: "Triggers live outbound phone calls to field officers to dispatch them to hotspots, polling status and displaying final call transcripts.",
    steps: [
      "Operator prompts a dispatch command or clicks 'Call Dispatcher' in the voice agent drawer.",
      "Dashboard POSTs junction details, officer name, and coordinates to Next.js server route.",
      "Next.js serverless route triggers Voice Telephony Gateway API.",
      "Gateway dials the officer's phone, delivering spoken incident alerts.",
      "Dashboard polls status API to trace call states and appends final transcript to logs upon completion."
    ],
    activeNodes: ["voice-ui", "next-api", "telephony-gateway"],
    techNotes: "Endpoints: POST /api/voice/call, GET /api/voice/call/status | Files: src/app/api/voice/call/route.ts"
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
                    1. INGESTION & DATA INFLOW
                  </h4>
                  
                  {/* CCTV Cameras */}
                  <div className={`p-4 rounded-xl border transition-all duration-300 flex flex-col gap-2 ${
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
                  <div className={`p-4 rounded-xl border transition-all duration-300 flex flex-col gap-2 ${
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

                  {/* Historical Offence Logs */}
                  <div className={`p-4 rounded-xl border transition-all duration-300 flex flex-col gap-2 ${
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
                  <div className={`p-4 rounded-xl border transition-all duration-300 flex flex-col gap-2 ${
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
                  <div className={`p-4 rounded-xl border transition-all duration-300 flex flex-col gap-2 ${
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
                  <div className={`p-4 rounded-xl border transition-all duration-300 flex flex-col gap-2 ${
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
                  <div className={`p-4 rounded-xl border transition-all duration-300 flex flex-col gap-2 ${
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
                </div>

                {/* Column 3: Intelligence & Core Data */}
                <div className="flex flex-col gap-4">
                  <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-800 pb-2">
                    3. INTELLIGENCE & CORE DATA
                  </h4>

                  {/* Cloud Database */}
                  <div className={`p-4 rounded-xl border transition-all duration-300 flex flex-col gap-2 ${
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
                      Stores offences and validations; processes heavy database aggregations.
                    </p>
                    <span className="text-[9px] font-mono opacity-60">NoSQL Document Store</span>
                  </div>

                  {/* ML Models */}
                  <div className={`p-4 rounded-xl border transition-all duration-300 flex flex-col gap-2 ${
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
                  <div className={`p-4 rounded-xl border transition-all duration-300 flex flex-col gap-2 ${
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
                  <div className={`p-4 rounded-xl border transition-all duration-300 flex flex-col gap-2 ${
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
      </main>
    </div>
  );
}
