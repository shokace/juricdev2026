"use client";

export default function FafrInfoButton() {
  return (
    <details className="relative" onKeyDown={(event) => { if (event.key === "Escape") event.currentTarget.open = false; }}>
      <summary aria-label="About FAFR" className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-full border border-[color:var(--border)] text-xs text-faint transition-colors hover:text-[color:var(--text0)] [&::-webkit-details-marker]:hidden">i</summary>
      <div role="note" className="absolute right-0 top-11 z-20 w-72 max-w-[calc(100vw-4rem)] rounded border border-[color:var(--border)] bg-[color:var(--bg0)] p-4 text-xs font-normal leading-6 text-[color:var(--text1)] shadow-xl">
        FAFR turns WAV or MP3 audio into a Fourier-based function description. Upload or drop a
        file, wait for processing, then read the generated f(t) formula in the box below. The
        formula is an approximation built from harmonic terms and can be scrolled if long. Learn
        more by clicking the title &quot;FAFR&quot;.
      </div>
    </details>
  );
}
