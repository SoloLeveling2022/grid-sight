"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  LayoutDashboard,
  MapPin,
  Radio,
  Search,
  Users,
  Menu,
  X,
  ArrowLeftRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getViolationMeta } from "@/data/violations";

export function AppShell({ children, title }: { children: React.ReactNode; title: string }) {
  const pathname = usePathname();
  const meta = getViolationMeta();
  const [isExpanded, setIsExpanded] = useState(false);

  const isCitizen = pathname.startsWith("/citizen");

  const policeNav = [
    { href: "/police", label: "Police Control", icon: LayoutDashboard },
    { href: "/violations", label: "Case Explorer", icon: Search },
    { href: "/hotspots", label: "Hotspots", icon: MapPin },
    { href: "/analytics", label: "Analytics", icon: BarChart3 },
  ];

  const citizenNav = [
    { href: "/citizen", label: "Citizen Advisory", icon: Users },
  ];

  const activeNav = isCitizen ? citizenNav : policeNav;

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 flex flex-col">
      <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-[#070b14]/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-[1600px] items-center justify-between px-4">
          <div className="flex items-center gap-3 sm:gap-6">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500 text-sm font-bold text-slate-950">
                GS
              </div>
              <div className="hidden xs:block">
                <p className="text-sm font-semibold leading-none">GridSight</p>
                <p className="text-[10px] text-slate-500">Parking Violation Intelligence</p>
              </div>
            </Link>

            {/* Desktop Navigation - Hidden on Mobile */}
            <nav className="hidden md:flex gap-1">
              {activeNav.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                    pathname.startsWith(href)
                      ? "bg-amber-500/15 text-amber-300"
                      : "text-slate-400 hover:text-slate-200"
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </Link>
              ))}
            </nav>

            {/* Compact Mobile Navigation (Icons Only by Default) */}
            <nav className="flex md:hidden gap-1 items-center">
              {activeNav.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  title={label}
                  className={cn(
                    "flex items-center justify-center rounded-lg p-2 transition-colors",
                    pathname.startsWith(href)
                      ? "bg-amber-500/15 text-amber-300"
                      : "text-slate-400 hover:text-slate-200"
                  )}
                >
                  <Icon className="h-4 w-4" />
                </Link>
              ))}
              
              {/* Expand Toggle Button */}
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="flex items-center justify-center p-2 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800/40 transition-colors"
                aria-label={isExpanded ? "Collapse menu" : "Expand menu"}
              >
                {isExpanded ? <X className="h-4 w-4 text-amber-400" /> : <Menu className="h-4 w-4" />}
              </button>
            </nav>
          </div>

          <div className="flex items-center gap-2 sm:gap-4 text-xs text-slate-500">
            {/* Total count badge (hidden on tiny screens) */}
            <span className="hidden sm:flex items-center gap-1.5">
              <Radio className="h-3 w-3 animate-pulse text-emerald-400" />
              {meta.sampledCases.toLocaleString("en-IN")} loaded
            </span>

            {/* Mode Switching Button (Switch to Citizen / Switch to Police) */}
            <Link
              href={isCitizen ? "/police" : "/citizen"}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-slate-900 border border-slate-800 text-[10px] text-amber-400 hover:text-amber-300 hover:bg-slate-850 hover:border-amber-500/30 transition-all font-semibold"
            >
              <ArrowLeftRight className="h-3 w-3" />
              <span className="hidden sm:inline">Switch to {isCitizen ? "Police" : "Citizen"}</span>
              <span className="sm:hidden">{isCitizen ? "Police" : "Citizen"}</span>
            </Link>

            <span className="text-slate-600">|</span>
            <span className="text-[10px] sm:text-xs font-semibold text-slate-300 truncate max-w-[80px] sm:max-w-none">{title}</span>
          </div>
        </div>

        {/* Collapsible Mobile Dropdown (Displays full list when expanded) */}
        {isExpanded && (
          <div className="md:hidden border-t border-slate-800 bg-[#070b14]/95 px-4 py-2 space-y-1 animate-in slide-in-from-top duration-200">
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider px-3 py-1">
              {isCitizen ? "Citizen View" : "Police Control View"}
            </p>
            {activeNav.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setIsExpanded(false)}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  pathname.startsWith(href)
                    ? "bg-amber-500/15 text-amber-300"
                    : "text-slate-400 hover:text-slate-200"
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            ))}
            <div className="border-t border-slate-800/80 my-2 pt-2">
              <Link
                href={isCitizen ? "/police" : "/citizen"}
                onClick={() => setIsExpanded(false)}
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-amber-400 hover:bg-amber-500/10 transition-colors"
              >
                <ArrowLeftRight className="h-4 w-4" />
                Switch to {isCitizen ? "Police Control" : "Citizen Portal"}
              </Link>
            </div>
          </div>
        )}
      </header>
      <main className="mx-auto w-full max-w-[1600px] p-3 sm:p-4 flex-1 flex flex-col">{children}</main>
    </div>
  );
}
