"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Map, Mic, Shield, TrendingUp, Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getViolationMeta } from "@/data/violations";

export default function HomePage() {
  const meta = getViolationMeta();
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && navigator.userAgent) {
      setIsIOS(/iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream);
    }
  }, []);

  useEffect(() => {
    // 1. Check if running standalone
    const isStandalone = 
      window.matchMedia("(display-mode: standalone)").matches || 
      (navigator as any).standalone;

    if (isStandalone) return;

    // 2. Function to update deferred prompt from global window storage
    const updatePromptFromWindow = () => {
      const globalPrompt = (window as any).deferredPrompt;
      if (globalPrompt) {
        console.log("[PWA] Setting deferredPrompt from window:", globalPrompt);
        setDeferredPrompt(globalPrompt);
        if (!sessionStorage.getItem("pwa-prompt-dismissed")) {
          setShowInstallPrompt(true);
        }
        return true;
      }
      return false;
    };

    // Check immediately on mount
    const foundImmediately = updatePromptFromWindow();

    // 3. Listen for standard event in case it fires after mount
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      console.log("[PWA] beforeinstallprompt event caught in component");
      (window as any).deferredPrompt = e;
      setDeferredPrompt(e);
      if (!sessionStorage.getItem("pwa-prompt-dismissed")) {
        setShowInstallPrompt(true);
      }
    };

    // 4. Listen for custom event from root layout inline script
    const handleCustomInstallable = () => {
      console.log("[PWA] Custom pwa-installable event received");
      updatePromptFromWindow();
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("pwa-installable", handleCustomInstallable);

    // Fallback timer: Show prompt after 1.5s for demo purposes if not dismissed.
    // If deferredPrompt is available by then, it triggers native. If not, it shows inline instructions.
    const timer = setTimeout(() => {
      // Re-check window first
      const foundLater = updatePromptFromWindow();
      if (!foundLater && !sessionStorage.getItem("pwa-prompt-dismissed")) {
        setShowInstallPrompt(true);
      }
    }, 1500);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("pwa-installable", handleCustomInstallable);
      clearTimeout(timer);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      console.log(`User response to install prompt: ${outcome}`);
      setDeferredPrompt(null);
      setShowInstallPrompt(false);
    } else {
      // Toggle custom instructions inside the dialog instead of alert
      setShowInstructions(true);
    }
  };

  const handleDismiss = () => {
    sessionStorage.setItem("pwa-prompt-dismissed", "true");
    setShowInstallPrompt(false);
    setShowInstructions(false);
  };

  return (
    <div className="min-h-screen overflow-hidden bg-[#070b14] text-slate-100 relative">
      <div className="relative">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-500/10 via-transparent to-transparent" />
        <div className="relative mx-auto max-w-6xl px-4 py-20">
          <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12">
            <div className="flex flex-col justify-center lg:col-span-7">
              <div className="mb-6 flex w-fit cursor-pointer items-center gap-2 group/logo">
                <Image
                  src="/icon-192.png"
                  alt="GridSight Logo"
                  width={40}
                  height={40}
                  className="rounded-xl object-cover transition-all duration-300 group-hover/logo:rotate-3 group-hover/logo:scale-105"
                />
                <span className="text-sm uppercase tracking-widest text-slate-500 transition-colors duration-300 group-hover/logo:text-slate-300">GridSight</span>
              </div>

              <h1 className="text-4xl font-bold leading-tight tracking-tight md:text-5xl lg:text-6xl">
                Parking violation intelligence for <span className="text-amber-400">Bengaluru Traffic Police</span>
              </h1>
              <p className="mt-6 text-lg leading-relaxed text-slate-400">
                Turn violation cases into hotspot intelligence, repeat-offender patterns, validation queues,
                and congestion-aware enforcement priorities for police-first operations.
              </p>

              <div className="mt-10 flex flex-wrap gap-4">
                <Link href="/police">
                  <Button size="lg" className="group/btn relative cursor-pointer overflow-hidden transition-all duration-300">
                    Police Control Room
                    <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover/btn:translate-x-1" />
                  </Button>
                </Link>
                <Link href="/citizen">
                  <Button size="lg" variant="outline" className="cursor-pointer transition-all duration-300 hover:border-amber-500/40 hover:bg-amber-500/5 hover:text-amber-400">
                    Citizen Advisory
                  </Button>
                </Link>
              </div>
            </div>

            <div className="relative flex justify-center lg:col-span-5 lg:justify-end">
              <div className="group relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/40 p-2 shadow-2xl shadow-amber-500/5 transition-all duration-300 hover:border-amber-500/30">
                <div className="absolute inset-0 bg-gradient-to-tr from-amber-500/10 via-transparent to-transparent opacity-40 blur-xl transition-opacity group-hover:opacity-60" />
                <Image
                  src="/poster1.png"
                  alt="GridSight presentation"
                  width={720}
                  height={960}
                  priority
                  loading="eager"
                  className="h-auto max-h-[480px] w-full rounded-xl border border-slate-800 object-cover transition-transform duration-500 ease-out group-hover:scale-[1.01]"
                />
              </div>
            </div>
          </div>

          <div className="mt-16 grid grid-cols-2 gap-4 md:grid-cols-4">
            {[
              { label: "Cases analyzed", value: meta.totalCases.toLocaleString("en-IN") },
              { label: "Demo sample", value: meta.sampledCases.toLocaleString("en-IN") },
              { label: "Top stations", value: meta.topStations.length.toString() },
              { label: "Violation classes", value: meta.topViolationTypes.length.toString() },
            ].map(({ label, value }) => (
              <div key={label} className="cursor-default rounded-xl border border-slate-800 bg-slate-900/40 p-4 shadow-sm transition-all duration-300 ease-out hover:-translate-y-1 hover:border-amber-500/30 hover:bg-slate-900/60 hover:shadow-md hover:shadow-amber-500/5">
                <p className="text-2xl font-bold text-amber-400">{value}</p>
                <p className="mt-1 text-xs text-slate-500">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="border-t border-slate-800 bg-slate-900/20 py-20">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="mb-2 text-2xl font-bold">End-to-end intelligence loop</h2>
          <p className="mb-10 text-slate-400">The hackathon demo story judges will remember.</p>
          <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
            {[
              { step: "1", title: "Ingest", desc: "Violation cases", icon: Map },
              { step: "2", title: "Cluster", desc: "Hotspot ranking", icon: TrendingUp },
              { step: "3", title: "Validate", desc: "Case queue", icon: Shield },
              { step: "4", title: "Advise", desc: "Citizen guidance", icon: ArrowRight },
              { step: "5", title: "Speak", desc: "Voice agent", icon: Mic },
              { step: "6", title: "Act", desc: "Patrol focus", icon: Shield },
            ].map(({ step, title, desc, icon: Icon }) => (
              <div key={step} className="group cursor-default rounded-xl border border-slate-800 bg-slate-900/10 p-4 text-center transition-all duration-300 ease-out hover:-translate-y-1 hover:border-slate-700 hover:bg-slate-900/40">
                <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/10 text-amber-400 transition-all duration-300 group-hover:scale-110 group-hover:bg-amber-500/25 group-hover:text-amber-300">
                  <Icon className="h-5 w-5" />
                </div>
                <p className="text-[10px] font-bold text-amber-500">STEP {step}</p>
                <p className="mt-1 text-sm font-semibold">{title}</p>
                <p className="text-xs text-slate-500">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <footer className="border-t border-slate-800 py-8 text-center text-xs text-slate-600">
        GridSight / Bengaluru parking violation intelligence / MapMyIndia-ready / frontend-only demo
      </footer>

      {/* Premium Install PWA popup prompt */}
      {showInstallPrompt && (
        <div className="fixed bottom-4 right-4 z-50 max-w-sm w-[calc(100vw-32px)] rounded-xl border border-slate-800/80 bg-[#0c1220]/95 shadow-2xl shadow-amber-500/5 backdrop-blur-md p-4 animate-in fade-in slide-in-from-bottom-5 duration-300">
          <button 
            onClick={handleDismiss}
            className="absolute top-2.5 right-2.5 text-slate-500 hover:text-slate-300 transition-colors p-1"
            aria-label="Dismiss prompt"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Download className="h-5 w-5" />
            </div>
            <div className="space-y-1 w-full">
              <p className="text-sm font-semibold text-slate-100">Install GridSight App</p>
              {!showInstructions ? (
                <>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Add GridSight to your home screen for quick, offline-capable parking violation tracking.
                  </p>
                  <div className="pt-2.5 flex gap-2">
                    <Button size="sm" onClick={handleInstallClick} className="text-xs py-1.5 h-8 cursor-pointer">
                      Install App
                    </Button>
                    <Button size="sm" variant="outline" onClick={handleDismiss} className="text-xs py-1.5 h-8 cursor-pointer">
                      Later
                    </Button>
                  </div>
                </>
              ) : (
                <div className="text-xs text-slate-300 space-y-2 mt-1">
                  <p className="font-medium text-amber-400">Easy Installation Instructions:</p>
                  {isIOS ? (
                    <ol className="list-decimal list-inside space-y-1 text-slate-400">
                      <li>Tap the <span className="text-amber-400 font-semibold">Share</span> button at the bottom of Safari.</li>
                      <li>Scroll down and tap <span className="text-amber-400 font-semibold">Add to Home Screen</span>.</li>
                    </ol>
                  ) : (
                    <ol className="list-decimal list-inside space-y-1 text-slate-400">
                      <li>Tap your browser's <span className="text-amber-400 font-semibold">menu button</span> (three vertical dots).</li>
                      <li>Select <span className="text-amber-400 font-semibold">Install app</span> or <span className="text-amber-400 font-semibold">Add to Home Screen</span>.</li>
                    </ol>
                  )}
                  <div className="pt-2.5 flex gap-2">
                    <Button size="sm" onClick={handleDismiss} className="text-xs py-1.5 h-8 cursor-pointer">
                      Got it
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setShowInstructions(false)} className="text-xs py-1.5 h-8 cursor-pointer">
                      Back
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
