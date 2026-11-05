"use client";

import { Download, Shield } from "lucide-react";

interface Props {
  ghostHandle: string;
  recoveryKey: string;
}

export function RecoveryKeycardModal({ ghostHandle, recoveryKey }: Props) {
  function downloadKeycard() {
    const content = [
      "+------------------------------------------+",
      "|      AYE PLATFORM RECOVERY KEYCARD       |",
      "|         KEEP THIS SAFE -- PRINTED        |",
      "+------------------------------------------+",
      `|  GHOST HANDLE : @${ghostHandle.slice(0, 22).padEnd(22)}|`,
      `|  RECOVERY KEY : ${recoveryKey.padEnd(24)}|`,
      "+------------------------------------------+",
      "|  WARNING: DO NOT SHARE. NO BACKUP.       |",
      "|  Zero-PII platform -- no email reset.    |",
      "+------------------------------------------+",
    ].join("\n");

    const blob = new Blob([content], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `AYE_Keycard_${ghostHandle}.txt`;
    a.click();
  }

  return (
    <div className="flex flex-col items-center gap-5 py-4">
      <div className="section-label">RECOVERY KEYCARD GENERATED</div>

      {/* KEYCARD */}
      <div
        className="w-full border-3 border-ink shadow-brutal-lg p-4 sm:p-6 font-mono"
        style={{ background: "#D4F542" }}
      >
        <div className="flex items-center justify-between mb-4">
          <span className="font-bold text-sm uppercase tracking-widest">AYE PLATFORM</span>
          <Shield size={20} />
        </div>

        <div className="text-xs text-ink/60 mb-1 uppercase tracking-widest">GHOST HANDLE</div>
        {/* Truncate long handles */}
        <div className="font-bold text-lg sm:text-xl mb-4 truncate">@{ghostHandle}</div>

        <div className="text-xs text-ink/60 mb-1 uppercase tracking-widest">RECOVERY KEY</div>
        {/* break-all so key never overflows on narrow phones */}
        <div className="font-bold text-lg sm:text-2xl border-2 border-ink px-3 py-2 bg-white break-all tracking-wider">
          {recoveryKey}
        </div>

        <p className="text-xs text-ink/60 mt-4 uppercase tracking-wide">
          ⚠ SHOWN ONCE — NEVER STORED IN PLAIN TEXT
        </p>
      </div>

      <button onClick={downloadKeycard} className="btn-inverse w-full justify-center">
        <Download size={16} />
        DOWNLOAD KEYCARD (.TXT)
      </button>

      <p className="font-mono text-xs text-ink/50 text-center uppercase">
        Screenshot or print this now. We cannot recover it for you.
      </p>

      <a href="/campus/wall" className="btn-primary w-full justify-center">
        ENTER CAMPUS WALL →
      </a>
    </div>
  );
}
