import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import ServiceWorkerRegister from "@/components/layout/sw-register";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "GridSight - Bengaluru Traffic Intelligence",
  description:
    "AI-powered congestion impact intelligence for Bengaluru Traffic Police. Hotspot discovery, enforcement prioritization, citizen advisories, and voice agent.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "GridSight",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}
    >
      <body className="min-h-full flex flex-col bg-[#070b14] text-slate-100">
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.addEventListener('beforeinstallprompt', (e) => {
                e.preventDefault();
                window.deferredPrompt = e;
                window.dispatchEvent(new Event('pwa-installable'));
              });
            `,
          }}
        />
        <ServiceWorkerRegister />
        {children}
      </body>
    </html>
  );
}
