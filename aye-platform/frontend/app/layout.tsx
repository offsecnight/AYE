import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AYE Platform — Anything You Experience",
  description:
    "Zero-PII university problem-tracking and student accountability platform. No admin control. Pure student voice.",
  manifest: "/manifest.json",
  icons: { icon: "/favicon.ico" },
};

export const viewport: Viewport = {
  themeColor: "#D4F542",
  width: "device-width",
  initialScale: 1,
  // Prevent automatic zoom on small inputs (Android Chrome)
  // but keep user-scalable for accessibility
  maximumScale: 5,
  userScalable: true,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="relative z-10">
        {/* ── MARQUEE TICKER ─────────────────────────────── */}
        <div className="fixed top-0 left-0 right-0 z-50 overflow-hidden bg-ink border-b-3 border-ink h-8 flex items-center">
          <div className="flex animate-ticker whitespace-nowrap">
            {[...Array(2)].map((_, i) => (
              <span key={i} className="flex items-center gap-6 pr-6">
                {[
                  "ZERO PII PLATFORM",
                  "NO COLLEGE ADMIN CONTROL",
                  "STUDENT VOICES ONLY",
                  "HARDWARE-FINGERPRINT BANS",
                  "CHAIN-REACTION ACCOUNTABILITY",
                  "ANYTHING YOU EXPERIENCE",
                  "AYE = ACCOUNTABILITY",
                ].map((t) => (
                  <span key={t} className="flex items-center gap-4">
                    <span className="w-1.5 h-1.5 bg-acid rounded-full inline-block flex-shrink-0" />
                    <span className="text-acid font-mono text-xs font-bold uppercase tracking-widest">
                      {t}
                    </span>
                  </span>
                ))}
              </span>
            ))}
          </div>
        </div>

        {/* ── PAGE CONTENT (pushed below ticker) ─────────── */}
        <div className="pt-8">{children}</div>
      </body>
    </html>
  );
}
