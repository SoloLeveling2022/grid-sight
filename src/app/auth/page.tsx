"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signInWithPopup } from "firebase/auth";
import { getFirebaseAuth, getGoogleAuthProvider } from "@/lib/firebase";
import { AlertTriangle, LogIn, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

// 6 Hours Session Expiry in milliseconds
const SESSION_EXPIRY_MS = 6 * 60 * 60 * 1000;

function AuthContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get("redirect") || "/police";

  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Check if session is already active
  useEffect(() => {
    if (typeof window !== "undefined") {
      const sessionStr = localStorage.getItem("gridsight_session");
      if (sessionStr) {
        try {
          const session = JSON.parse(sessionStr);
          const now = Date.now();
          if (now - session.createdAt < SESSION_EXPIRY_MS) {
            // Active session found! Skip login screen
            router.push(redirectUrl);
            return;
          }
        } catch (e) {
          localStorage.removeItem("gridsight_session");
        }
      }
      setCheckingSession(false);
    }
  }, [router, redirectUrl]);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);

    const auth = getFirebaseAuth();
    const googleProvider = getGoogleAuthProvider();

    if (!auth || !googleProvider) {
      setError("Firebase Authentication is not configured or failed to initialize.");
      setLoading(false);
      return;
    }

    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;

      // Store serializable session data in local storage
      const session = {
        user: {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
        },
        createdAt: Date.now(),
      };

      localStorage.setItem("gridsight_session", JSON.stringify(session));
      router.push(redirectUrl);
    } catch (err: any) {
      console.error("Firebase auth error:", err);
      if (err?.code === "auth/popup-blocked") {
        setError("Sign-in popup blocked by browser. Please enable popups.");
      } else {
        setError(err?.message || "Failed to authenticate. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  if (checkingSession) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#070b14] text-slate-400 gap-2">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
        <span className="text-xs font-semibold tracking-wide">Securing Session...</span>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#070b14] px-4 relative overflow-hidden">
      {/* Background Gradients */}
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-[350px] h-[350px] rounded-full bg-amber-500/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-[350px] h-[350px] rounded-full bg-orange-600/5 blur-[120px] pointer-events-none" />

      {/* Grid Pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b15_1px,transparent_1px),linear-gradient(to_bottom,#1e293b15_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] pointer-events-none" />

      <Card className="w-full max-w-md border-slate-800 bg-[#0c1220]/80 shadow-2xl backdrop-blur-md relative z-10">
        <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-amber-500/40 to-transparent" />
        
        <CardHeader className="text-center pb-6">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight bg-gradient-to-r from-slate-100 to-slate-400 bg-clip-text text-transparent">
            GridSight Authority Gateway
          </CardTitle>
          <CardDescription className="text-slate-400 text-xs mt-1.5 leading-relaxed">
            Targeted Parking Violation & Downstream Traffic Congestion Analytics. Security validation required for access.
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          <div className="rounded-lg bg-[#070b14]/50 border border-slate-800/80 p-3 text-[11px] text-slate-400 leading-relaxed space-y-1">
            <div className="flex items-center gap-1.5 font-semibold text-amber-500 mb-1">
              <AlertTriangle className="h-3.5 w-3.5" />
              Operational Notice
            </div>
            <p>Access is restricted to authorized traffic controllers, dispatch coordinators, and verified citizens. Authenticated sessions remain active for exactly <strong>6 hours</strong> before requiring re-validation.</p>
          </div>

          {error && (
            <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3 text-[11px] text-red-400">
              {error}
            </div>
          )}

          <Button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full py-6 bg-slate-900 border border-slate-700/80 hover:bg-slate-850 text-slate-200 hover:text-white rounded-lg flex items-center justify-center gap-2.5 cursor-pointer font-semibold transition-all hover:border-amber-500/30 group text-xs shadow-xl"
          >
            {loading ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-transparent" />
            ) : (
              <>
                <LogIn className="h-4 w-4 text-amber-500 group-hover:scale-115 transition-transform" />
                Sign in with Google Account
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#070b14] text-slate-400 gap-2">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
        <span className="text-xs font-semibold tracking-wide">Loading Gateway...</span>
      </div>
    }>
      <AuthContent />
    </Suspense>
  );
}
