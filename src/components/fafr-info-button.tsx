"use client";

import { useState } from "react";

export default function FafrInfoButton() {
  const [open, setOpen] = useState(false);

  return (
    <div
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        aria-label="About FAFR"
        onClick={() => setOpen((v) => !v)}
        className="flex h-5 w-5 items-center justify-center rounded-full border border-[color:var(--border)] text-[0.62rem] text-faint transition hover:border-[color:var(--text0)] hover:text-[color:var(--text0)]"
      >
        i
      </button>

      {open ? (
        <div className="absolute right-0 top-7 z-20 w-72 rounded-sm border border-[color:var(--border)] bg-[color:var(--bg0)]/95 p-3 text-[0.65rem] normal-case leading-5 tracking-[0.06em] text-[color:var(--text1)] shadow-[0_8px_28px_rgba(0,0,0,0.45)]">
          FAFR turns WAV or MP3 audio into a Fourier-based function description. Upload or drop a
          file, wait for processing, then read the generated f(t) formula in the box below. The
          formula is an approximation built from harmonic terms and can be scrolled if long. Learn
          more by clicking the title &quot;FAFR&quot;.
        </div>
      ) : null}
    </div>
  );
}
