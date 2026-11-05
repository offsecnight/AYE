import Link from "next/link";
import { Shield, Zap, Eye } from "lucide-react";

export function LandingHero() {
  return (
    <section className="py-8 sm:py-12 md:py-20">
      {/* STAMP LABEL */}
      <div className="section-label mb-5 inline-block">
        PLATFORM / STUDENT ACCOUNTABILITY
      </div>

      {/* BRUTALIST HEADLINE — responsive sizes */}
      <h1 className="font-mono font-bold uppercase leading-none mb-4">
        <span className="block text-4xl sm:text-6xl md:text-8xl text-ink">ANYTHING</span>
        <span className="block text-4xl sm:text-6xl md:text-8xl text-ink">YOU</span>
        <span
          className="block text-4xl sm:text-6xl md:text-8xl px-3 inline-block"
          style={{
            background: "#D4F542",
            border: "3px solid #0A0A0A",
          }}
        >
          EXPERIENCE.
        </span>
      </h1>

      <p className="font-mono text-sm text-ink/70 max-w-lg mt-5 mb-7 leading-relaxed">
        Zero-PII campus problem tracking. No admin control. No real names.
        Just verified students, raw evidence, and community accountability.
      </p>

      {/* CTA ROW — stack on tiny screens */}
      <div className="flex flex-wrap gap-3 mb-10">
        <Link href="/auth?tab=register" className="btn-primary">
          <Shield size={16} />
          JOIN YOUR CAMPUS
        </Link>
        <Link href="/auth" className="btn-secondary">
          LOGIN AS GHOST
        </Link>
      </div>

      {/* FEATURE STAMPS — 1 col mobile, 3 col sm+ */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          {
            icon: <Shield size={18} />,
            title: "ZERO PII",
            body: "No name. No email. No ID. Ghost handle only.",
          },
          {
            icon: <Zap size={18} />,
            title: "NO ADMIN POWER",
            body: "University cannot delete, hide, or suppress posts.",
          },
          {
            icon: <Eye size={18} />,
            title: "CHAIN BANS",
            body: "Trolls get hardware-banned. Their inviter pays the price.",
          },
        ].map((f) => (
          <div key={f.title} className="brute-card p-4 flex flex-col gap-2">
            <div className="flex items-center gap-2 font-mono font-bold text-sm uppercase">
              {f.icon}
              {f.title}
            </div>
            <p className="font-mono text-xs text-ink/60">{f.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
