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
  Award,
  Zap,
  BarChart3
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface Scenario {
  id: string;
  category: "core" | "usp" | "innovative" | "operations";
  title: string;
  description: string;
  steps: string[];
  activeNodes: string[]; // Nodes that should glow
  techNotes: string;
}

const SCENARIOS: Scenario[] = [
  // ─── Core Features ──────────────────────────────────────────────────────────
  {
    id: "mappls-map",
    category: "core",
    title: "Mappls SDK Map Integration",
    description: "High-performance vector map layer mapping coordinate markers, circular density hotspots, and routing paths.",
    steps: [
      "Next.js components mount the map canvas using a unified vector map container.",
      "The SDK loader requests tiles and segment layers, dropping back to a custom styled SVG fallback grid if offline.",
      "Map queries active violation density points and registers TomTom incidents overlays.",
      "Marker sizes and route lines are plotted dynamically using geo-coordinates from Zustand store."
    ],
    activeNodes: ["dashboard", "traffic-api"],
    techNotes: "File: mappls-sdk.ts | Key: NEXT_PUBLIC_MAPPLS_API_KEY (TomTom redirection)"
  },
  {
    id: "validation-queue",
    category: "core",
    title: "Unified Case Validation Queue",
    description: "中央 control room dashboard queue where operators filter, batch-select, and validate tickets.",
    steps: [
      "Operator inputs plates, filters by station/junction, or selects validation status (e.g. pending).",
      "Next.js fetches paginated search metrics from FastAPI backend routes.",
      "Operator selects cases in batch and clicks Approve, Reject, or Flag Duplicate.",
      "FastAPI updates validation status and timestamps on MongoDB Atlas, returning write confirmations.",
      "Zustand updates the local queue list states optimistically."
    ],
    activeNodes: ["dashboard", "fastapi", "mongodb"],
    techNotes: "Endpoints: GET /api/violations/search | POST /api/violations/{id}/validate"
  },
  {
    id: "citizen-reports",
    category: "core",
    title: "Citizen Obstruction Reporting",
    description: "Citizen portal allowing the public to report roadside obstructions and track plate validation states.",
    steps: [
      "Citizen enters plate details, location names, coordinates, and uploads an image of the obstruction.",
      "Citizen store captures inputs locally and handles state mapping.",
      "Submits a payload with Base64 image data to the FastAPI ingestion route.",
      "FastAPI saves the image in local static storage (or S3) and creates a public evidence link.",
      "Saves a new case record on MongoDB Atlas with validation_status = pending."
    ],
    activeNodes: ["citizen", "fastapi", "mongodb"],
    techNotes: "Endpoints: POST /api/violations/ingest | File: storage.py"
  },
  {
    id: "camera-simulator",
    category: "core",
    title: "Polygon Editor & AI Camera Simulator",
    description: "Interactive polygon coordinate editor running stationary checks inside edge AI zones.",
    steps: [
      "Operator selects a corridor and draws a virtual no-parking boundary polygon on the map canvas.",
      "Saves polygon vertices under cameraZones[junctionName] in Zustand.",
      "Operator launches CCTV Simulator which tracks vehicle centroid coordinates across frames.",
      "Simulator sends vertices, coordinates, and frames indices to FastAPI.",
      "FastAPI runs a Ray Casting point-in-polygon algorithm. If a vehicle remains inside the polygon for >= 10 seconds, it ingests a wrong-parking ticket."
    ],
    activeNodes: ["camera", "fastapi", "mongodb", "dashboard"],
    techNotes: "Endpoints: POST /api/violations/detect-parking | Ray-Casting check in violations.py"
  },
  
  // ─── USPs ──────────────────────────────────────────────────────────────────
  {
    id: "congestion-ml",
    category: "usp",
    title: "Congestion Impact Quantification",
    description: "Random Forest ML models calculating delay times and blending them with live flow telemetry.",
    steps: [
      "Operator selects a violation case in the queue sidebar.",
      "Dashboard POSTs lat, lng, time, and vehicle metadata to the ML route.",
      "FastAPI loads a pre-trained scikit-learn Random Forest model to predict delay minutes.",
      "Queries TomTom Traffic Flow APIs to evaluate free-flow vs. current speeds at coordinates.",
      "Blends historical ML model prediction (40%) and live telemetry speed drops (60%) to return expected delay, speed loss, and congestion score."
    ],
    activeNodes: ["dashboard", "fastapi", "ml-models", "traffic-api"],
    techNotes: "Endpoints: POST /api/ml/predict-impact | Model: congestion_model.pkl"
  },
  {
    id: "outcome-loop",
    category: "usp",
    title: "Enforcement Outcomes Feedback Loop",
    description: "Dynamic simulation reflecting patrol resolutions by reducing map weights and delays by 85%.",
    steps: [
      "A severe-priority hotspot shows high congestion weight on the dashboard.",
      "Operator dispatches a patrol unit (state moves: NoPatrol -> Dispatched).",
      "Operator logs citation action on location (state moves: Dispatched -> ActionTaken).",
      "Operator closes the case (state moves: ActionTaken -> Closed).",
      "Zustand updates local scores: scales expected delay by 0.15 (85% reduction) and updates priority to low, which dynamically changes the heatmap color."
    ],
    activeNodes: ["dashboard", "mongodb"],
    techNotes: "State machine managed in Zustand store: useViolationPoliceStore"
  },
  {
    id: "mongo-atlas",
    category: "usp",
    title: "MongoDB Atlas Cloud Integration",
    description: "High-throughput cloud database replacing local SQLite to run complex aggregations on 298k+ records.",
    steps: [
      "FastAPI backend launches and reads DATABASE_URL credentials.",
      "database.py initializes a native MongoClient using secure TLS and pings the DB.",
      "API queries are processed directly on Atlas utilizing MongoDB aggregations.",
      "Pipelines use allowDiskUse=True to efficiently analyze and aggregate 298k+ records."
    ],
    activeNodes: ["fastapi", "mongodb"],
    techNotes: "File: database.py | Client driver: PyMongo (MongoClient with TLS)"
  },

  // ─── Innovative Features ──────────────────────────────────────────────────
  {
    id: "dbscan-clustering",
    category: "innovative",
    title: "DBSCAN Spatial Hotspot Clustering",
    description: "Pickled DBSCAN clustering models grouping coordinate densities into weighted hotspots.",
    steps: [
      "FastAPI initializes and loads hotspot_clustering.pkl containing DBSCAN centroid coordinates.",
      "Groups coordinate densities into hotspot clusters (200m radius threshold).",
      "Enriches centroids with case count, unique plates, peak hours, and sensitive place proximities.",
      "Client queries hotspots list, mapping database models into coordinate markers."
    ],
    activeNodes: ["fastapi", "ml-models", "mongodb", "dashboard"],
    techNotes: "Endpoints: GET /api/ml/hotspots | Model: hotspot_clustering.pkl"
  },
  {
    id: "priority-scoring",
    category: "innovative",
    title: "Multi-Factor Priority Scoring",
    description: "Enforcement prioritizer calculating index scores based on density, delay, repeat plate count, and school zones.",
    steps: [
      "Backend queries MongoDB to fetch active violation coordinates.",
      "Calculates priority index based on density, delay minutes, and repeat plate metrics.",
      "Scans local database strings for sensitive zone keywords (school, hospital, metro, bus stop) to apply severe boosts.",
      "Returns ranked items categorized by priority levels (Low, Medium, High, Severe)."
    ],
    activeNodes: ["fastapi", "mongodb", "dashboard"],
    techNotes: "Endpoints: GET /api/ml/enforcement-priorities | Formula weights: density, delay, repeat offenders, zones"
  },
  {
    id: "weighted-heatmap",
    category: "innovative",
    title: "Real Weighted Heatmap Layer",
    description: "Map overlay displaying coordinate density weights mapped to expected traffic delays.",
    steps: [
      "Frontend maps read violation coordinates from the hotspot endpoint.",
      "Each point is assigned a weight: w = violationCount * congestionScore.",
      "Weights are passed to the map canvas heatmap layer.",
      "Renders color gradients (Red = high delay impact, Green = low).",
      "Dropdown selections (time of day, station) dynamically filter the dataset, redrawing the heatmap."
    ],
    activeNodes: ["dashboard", "traffic-api"],
    techNotes: "Weight Formula: incidentCount * congestionScore | Rendered in gridsight-map.tsx"
  },
  {
    id: "patrol-routing",
    category: "innovative",
    title: "Optimized Patrol Routing TSP Heuristic",
    description: "TSP heuristic solving routing paths starting from highest priority waypoint with priority cost discount.",
    steps: [
      "Operator requests a patrol route from the dashboard.",
      "FastAPI fetches highest-ranked enforcement coordinates.",
      "A TSP heuristic calculates distance vectors between coordinates using Haversine.",
      "Cost function discounts distances if adjacent waypoints have severe priority scores or high open case counts.",
      "Paths are drawn on the vector map as a blue route line."
    ],
    activeNodes: ["dashboard", "fastapi", "ml-models", "traffic-api"],
    techNotes: "Endpoints: GET /api/ml/patrol-route | Heuristic: Haversine TSP Route Heuristic"
  },

  // ─── Operations & Analytics ────────────────────────────────────────────────
  {
    id: "recidivism-analytics",
    category: "operations",
    title: "Recidivism plate Analytics",
    description: "Enforcement scoring engine grouping case frequencies and locations per vehicle number.",
    steps: [
      "Operator selects the 'Offenders' analytics tab on the dashboard.",
      "FastAPI aggregates MongoDB records grouping by vehicle_number.",
      "Calculates an individual Enforcement Score based on infraction frequency, severity boosts (footpath/double parking), and station diversity.",
      "Returns records sorted by Enforcement Score, allowing operators to click any plate to filter their exact cases on the map."
    ],
    activeNodes: ["dashboard", "fastapi", "mongodb"],
    techNotes: "Endpoints: GET /api/violations/repeat-offenders | Score: count*12 + severity*20 + stations*6"
  },
  {
    id: "device-productivity",
    category: "operations",
    title: "Device Productivity Analytics",
    description: "Aggregation metrics tracking capture approvals, rejections, and sensor rates.",
    steps: [
      "Client requests device statistics.",
      "FastAPI groups documents by device_id.",
      "Calculates total captures, approval rates, and rejection rates.",
      "Displays analytics on the dashboard to audit sensor health and productivity."
    ],
    activeNodes: ["dashboard", "fastapi", "mongodb"],
    techNotes: "Endpoints: GET /api/violations/device-productivity"
  },
  {
    id: "hotspot-inspector",
    category: "operations",
    title: "Interactive Hotspot Inspector",
    description: "Sidebar inspector mounting unique vehicle stats, peak hours, and dispatch triggers on map clicks.",
    steps: [
      "Operator clicks a hotspot node on the map or rankings list.",
      "The click handler triggers the selector, storing the name in Zustand.",
      "The Sidebar details component mounts, displaying unique vehicles, peak hours, sensitive zones, and expected delay.",
      "Action buttons (Dispatch Patrol, Outbound Call) focus on the chosen coordinate context."
    ],
    activeNodes: ["dashboard"],
    techNotes: "Files: src/components/dashboard/ priority lists & maps selection listeners"
  },
  {
    id: "alternate-routing",
    category: "operations",
    title: "Alternate Route Detour Planner",
    description: "Citizen routing overlay displaying detours bypassing high-priority enforcement zones.",
    steps: [
      "Citizen enters Origin and Destination locations.",
      "Zustand citizen store requests enforcement priorities to find active hotspots.",
      "The router traces the primary path and calculates detour paths avoiding the highest-ranked hotspot.",
      "Renders the standard route in red (incident warning) and the detour route in green (safety advice) on the map."
    ],
    activeNodes: ["citizen", "dashboard", "traffic-api"],
    techNotes: "Files: src/app/citizen/page.tsx routing advisory simulator"
  },
  {
    id: "voice-commands",
    category: "operations",
    title: "Intelligent Voice Agent UI",
    description: "Floating voice agent parsing spoken intents and triggering Zustand store updates.",
    steps: [
      "Operator speaks a command or types into the voice input field.",
      "Sends query to the Next.js API route to identify command intent.",
      "Voice store receives the intent response and triggers the matching reducer (e.g. setCaseFilter).",
      "Zustand updates the UI state (e.g. centers map, validates tickets, generates route), playing spoken text-to-speech confirmation."
    ],
    activeNodes: ["voice-ui", "next-api", "dashboard"],
    techNotes: "Endpoints: POST /api/voice/command | Session: POST /api/voice/session"
  },
  {
    id: "call-dispatcher",
    category: "operations",
    title: "Outbound Call AI Dispatcher",
    description: "Outbound dispatch engine using Ringg AI voice calls to alert field officers with live status logs.",
    steps: [
      "Operator triggers call dispatcher from the voice agent drawer.",
      "Next.js endpoint constructs a text summary of the hotspot violation.",
      "POSTs to Ringg AI API which makes a real-world outbound phone call to the field officer.",
      "Dashboard polls call/status to show call states. Once ended, the text transcript is appended to the console logs."
    ],
    activeNodes: ["voice-ui", "next-api", "ringg-api"],
    techNotes: "Endpoints: POST /api/voice/call | GET /api/voice/call/status"
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

  const handleCopyMermaid = () => {
    navigator.clipboard.writeText(MERMAID_CODE);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

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
            Complete data flow mapping of GridSight's 17 features: Ingestion, machine learning inference, MongoDB Cloud scaling, and voice dispatch.
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
              <div className="flex flex-col gap-2 max-h-[320px] overflow-y-auto pr-1 scrollbar-thin">
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
                <div className="flex flex-col gap-6">
                  <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-800 pb-2">
                    1. INGESTION & DATA INFLOW
                  </h4>
                  
                  {/* CCTV Cameras */}
                  <div className={`p-4 rounded-xl border transition-all duration-300 flex flex-col gap-2 ${
                    getIsActive("camera")
                      ? "bg-amber-500/10 border-amber-500 shadow-md shadow-amber-500/5 text-amber-400"
                      : activeScenario 
                        ? "bg-slate-900/10 border-slate-900/60 text-slate-600 opacity-45"
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
                        ? "bg-slate-900/10 border-slate-900/60 text-slate-600 opacity-45"
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
                        ? "bg-slate-900/10 border-slate-900/60 text-slate-600 opacity-45"
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
                        ? "bg-slate-900/10 border-slate-900/60 text-slate-600 opacity-45"
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
                        ? "bg-slate-900/10 border-slate-900/60 text-slate-600 opacity-45"
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
                        ? "bg-slate-900/10 border-slate-900/60 text-slate-600 opacity-45"
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
                        ? "bg-slate-900/10 border-slate-900/60 text-slate-600 opacity-45"
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
                        ? "bg-slate-900/10 border-slate-900/60 text-slate-600 opacity-45"
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
                        ? "bg-slate-900/10 border-slate-900/60 text-slate-600 opacity-45"
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
                        ? "bg-slate-900/10 border-slate-900/60 text-slate-600 opacity-45"
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
                        ? "bg-slate-900/10 border-slate-900/60 text-slate-600 opacity-45"
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
                  <span>Tip: Select a system feature in the left panel to trace live data propagation pathways.</span>
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
