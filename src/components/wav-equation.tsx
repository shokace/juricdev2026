"use client";

import { useState } from "react";

type EquationResult = {
  text: string;
  durationSec: number;
  samplesAnalyzed: number;
};

function downsampleAverage(input: Float32Array, targetCount: number): Float64Array {
  if (input.length <= targetCount) {
    return Float64Array.from(input);
  }
  const out = new Float64Array(targetCount);
  for (let i = 0; i < targetCount; i++) {
    const start = Math.floor((i * input.length) / targetCount);
    const end = Math.floor(((i + 1) * input.length) / targetCount);
    let sum = 0;
    let count = 0;
    for (let j = start; j < end; j++) {
      sum += input[j];
      count++;
    }
    out[i] = count > 0 ? sum / count : 0;
  }
  return out;
}

function buildFourierEquation(samples: Float64Array, durationSec: number, harmonics: number): string {
  const N = samples.length;
  const K = Math.min(harmonics, Math.floor(N / 2));
  if (N < 2 || K < 1) {
    throw new Error("Audio is too short to derive an equation.");
  }

  const twoOverN = 2 / N;
  let a0 = 0;
  for (let n = 0; n < N; n++) {
    a0 += samples[n];
  }
  a0 *= twoOverN;

  const format = (value: number) => {
    if (!Number.isFinite(value)) return "0";
    if (Math.abs(value) < 1e-9) return "0";
    return Number(value.toPrecision(6)).toString();
  };

  const T = format(durationSec);
  const lines: string[] = [];
  lines.push("f(t) =");
  lines.push(`  ${format(a0 * 0.5)}`);

  for (let k = 1; k <= K; k++) {
    let ak = 0;
    let bk = 0;
    for (let n = 0; n < N; n++) {
      const theta = (2 * Math.PI * k * n) / N;
      const x = samples[n];
      ak += x * Math.cos(theta);
      bk += x * Math.sin(theta);
    }
    ak *= twoOverN;
    bk *= twoOverN;
    lines.push(
      `  + ${format(ak)} cos((2π·${k}·t)/${T})`
    );
    lines.push(
      `  + ${format(bk)} sin((2π·${k}·t)/${T})`
    );
  }
  return lines.join("\n");
}

async function fileToEquation(file: File): Promise<EquationResult> {
  const bytes = await file.arrayBuffer();
  const audioCtx = new AudioContext();
  try {
    const audio = await audioCtx.decodeAudioData(bytes);
    const channels = audio.numberOfChannels;
    const frames = audio.length;
    const mono = new Float32Array(frames);

    for (let c = 0; c < channels; c++) {
      const chan = audio.getChannelData(c);
      for (let i = 0; i < frames; i++) {
        mono[i] += chan[i];
      }
    }
    for (let i = 0; i < frames; i++) {
      mono[i] /= channels;
    }

    const samplesAnalyzed = 8192;
    const harmonics = 64;
    const analysis = downsampleAverage(mono, samplesAnalyzed);
    const text = buildFourierEquation(analysis, audio.duration, harmonics);
    return {
      text,
      durationSec: audio.duration,
      samplesAnalyzed: analysis.length,
    };
  } finally {
    await audioCtx.close();
  }
}

export default function WavEquation() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [equationText, setEquationText] = useState("");
  const [meta, setMeta] = useState("");
  const [error, setError] = useState("");
  const [selectedFileName, setSelectedFileName] = useState("");
  const [isDragOver, setIsDragOver] = useState(false);

  function isSupportedAudio(file: File) {
    const name = file.name.toLowerCase();
    return name.endsWith(".wav") || name.endsWith(".mp3");
  }

  async function processFile(file: File) {
    if (!isSupportedAudio(file)) {
      setError("Please drop or choose a .wav or .mp3 file.");
      return;
    }

    setSelectedFileName(file.name);
    setIsProcessing(true);
    setEquationText("");
    setMeta("");
    setError("");

    try {
      const result = await fileToEquation(file);
      setMeta(
        `domain: 0 <= t < ${result.durationSec.toFixed(6)} | analyzed samples: ${result.samplesAnalyzed}`
      );
      setEquationText(result.text);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to process WAV.");
    } finally {
      setIsProcessing(false);
    }
  }

  async function onFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    await processFile(file);
    event.target.value = "";
  }

  return (
    <div className="space-y-3">
      <input
        id="wav-upload"
        type="file"
        accept=".wav,.mp3,audio/wav,audio/x-wav,audio/mpeg"
        onChange={onFileChange}
        className="sr-only"
      />
      <label
        htmlFor="wav-upload"
        className="block cursor-pointer rounded-sm border border-[color:var(--border2)] px-3 py-3 text-center text-[0.72rem] uppercase tracking-[0.2em] text-[color:var(--text0)] hover:border-[color:var(--border)]"
      >
        Choose WAV or MP3 File (Click Here)
      </label>
      {selectedFileName ? (
        <p className="text-[0.7rem] uppercase tracking-[0.12em] text-faint">
          Selected: {selectedFileName}
        </p>
      ) : null}

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragEnter={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          if (!e.currentTarget.contains(e.relatedTarget as Node)) {
            setIsDragOver(false);
          }
        }}
        onDrop={async (e) => {
          e.preventDefault();
          setIsDragOver(false);
          const file = e.dataTransfer.files?.[0];
          if (!file) return;
          await processFile(file);
        }}
        className={`h-64 overflow-auto rounded-sm border bg-black/30 p-3 text-[0.72rem] ${
          isDragOver
            ? "border-[color:var(--text0)]"
            : "border-[color:var(--border2)]"
        }`}
      >
        {isProcessing ? (
          <div className="flex h-full items-center justify-center gap-3 text-faint">
            <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-[color:var(--border2)] border-t-[color:var(--text0)]" />
            <span className="uppercase tracking-[0.2em]">Processing...</span>
          </div>
        ) : null}

        {!isProcessing && error ? (
          <p className="whitespace-pre-wrap break-words text-[color:#f59e0b]">{error}</p>
        ) : null}

        {!isProcessing && !error && equationText ? (
          <div className="space-y-2">
            <p className="text-faint">{meta}</p>
            <pre className="whitespace-pre-wrap break-words text-[0.8rem] leading-6 text-[color:var(--text0)]">
              {equationText}
            </pre>
          </div>
        ) : null}

        {!isProcessing && !error && !equationText ? (
          <p className="text-faint uppercase tracking-[0.18em]">
            {isDragOver
              ? "Drop WAV or MP3 file here..."
              : "Upload a WAV or MP3 file to generate f(t)."}
          </p>
        ) : null}
      </div>
    </div>
  );
}
