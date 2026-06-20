"use client";

import Link from "next/link";
import { WifiOff, RotateCw, Shield, LayoutDashboard, Compass } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function OfflinePage() {
  const handleRetry = () => {
    if (typeof window !== "undefined") {
      if (navigator.onLine) {
        window.location.href = "/";
      } else {
        // Simple visual pulse feedback
        const el = document.getElementById("offline-card");
        if (el) {
          el.classList.add("scale-[1.01]", "border-amber-500");
          setTimeout(() => el.classList.remove("scale-[1.01]", "border-amber-500"), 300);
        }
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 flex flex-col justify-center items-center px-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-amber-500/5 via-transparent to-transparent pointer-events-none" />

      <Card id="offline-card" className="w-full max-w-md border-slate-800 bg-slate-900/60 backdrop-blur-md shadow-2xl transition-all duration-300">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-500/10 text-red-400 animate-pulse border border-red-500/20">
            <WifiOff className="h-6 w-6" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">GridSight Offline</CardTitle>
          <CardDescription className="text-slate-400 text-sm mt-1">
            Network connection lost or unavailable
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6 pt-2">
          <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-4 text-xs text-slate-400 space-y-2 leading-relaxed">
            <p className="flex items-center gap-1.5 font-semibold text-amber-400">
              <Shield className="h-3.5 w-3.5" /> Offline Mode Enabled
            </p>
            <p>
              Because GridSight works using an in-memory processed sample from ASTraM datasets, you can still view already cached pages (such as dashboard charts and case management details) fully offline.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <Button onClick={handleRetry} className="w-full relative overflow-hidden group cursor-pointer">
              <RotateCw className="h-4 w-4 animate-spin-slow group-hover:rotate-180 transition-transform duration-500" />
              Check connection & retry
            </Button>

            <div className="grid grid-cols-2 gap-2 mt-2">
              <Link href="/police" className="w-full">
                <Button variant="outline" size="sm" className="w-full text-[11px] gap-1 cursor-pointer">
                  <LayoutDashboard className="h-3 w-3" />
                  Police view
                </Button>
              </Link>
              <Link href="/citizen" className="w-full">
                <Button variant="outline" size="sm" className="w-full text-[11px] gap-1 cursor-pointer">
                  <Compass className="h-3 w-3" />
                  Citizen view
                </Button>
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <footer className="mt-8 text-center text-[10px] text-slate-600">
        GridSight PWA / offline cache status active
      </footer>
    </div>
  );
}
