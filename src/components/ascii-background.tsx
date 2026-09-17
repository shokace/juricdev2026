"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

const motionQuery = () => window.matchMedia("(prefers-reduced-motion: reduce)");
function subscribeMotion(callback: () => void) {
  const query = motionQuery();
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}
type TrailPoint = { x: number; y: number; vx: number; vy: number; age: number };

export default function AsciiBackground() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const bloom = useRef<HTMLCanvasElement>(null);
  const particles = useRef<TrailPoint[]>([]);
  const phase = useRef(0);
  const seed = useRef<number | null>(null);
  const initialized = useRef(false);
  const [paused, setPaused] = useState(false);
  const reduced = useSyncExternalStore(subscribeMotion, () => motionQuery().matches, () => true);
  const still = paused || reduced;

  useEffect(() => {
    const surface = canvas.current, glow = bloom.current;
    const context = surface?.getContext("2d", { alpha: true });
    const light = glow?.getContext("2d", { alpha: true });
    if (!surface || !context || !glow || !light) return;
    if (seed.current === null) seed.current = Math.random() * Math.PI * 2;
    const offset = seed.current;
    const pointerQuery = window.matchMedia("(hover: hover) and (pointer: fine)");
    let width = 0, height = 0, columns = 0, rows = 0, mobile = false;
    let stepX = 13, stepY = 18, interval = 1000 / 24;
    let frame = 0, last = 0, pointerAt = -Infinity;
    let head = { x: 0, y: 0 }, target = { x: 0, y: 0 };
    let field = new Float32Array(0), direction = new Float32Array(0);
    let pixels: ImageData;
    const glyphs = "_-:><";
    const atlas = document.createElement("canvas");
    atlas.width = glyphs.length * 18;
    atlas.height = 24;
    const ink = atlas.getContext("2d");
    if (!ink) return;
    ink.font = "13px monospace";
    ink.textBaseline = "top";
    ink.fillStyle = "#b5d4c4";
    for (let i = 0; i < glyphs.length; i++) ink.fillText(glyphs[i], i * 18, 2);

    // Two incommensurate curves give phones a slow, wandering source with no sharp turns.
    const wander = (t: number) => ({
      x: width * (.5 + Math.sin(t * .31 + offset) * .32 + Math.sin(t * .13) * .1),
      y: height * (.5 + Math.cos(t * .23 + offset) * .31 + Math.sin(t * .37) * .1),
    });
    const emit = (from: {x: number; y: number}, to: {x: number; y: number}, dt: number) => {
      const dx = to.x - from.x, dy = to.y - from.y;
      const distance = Math.hypot(dx, dy);
      if (distance < .3) return;
      const steps = Math.min(16, Math.max(1, Math.ceil(distance / 18)));
      for (let n = 1; n <= steps; n++) particles.current.push({
        x: from.x + dx * n / steps, y: from.y + dy * n / steps,
        vx: Math.max(-35, Math.min(35, dx / dt * .06)),
        vy: Math.max(-25, Math.min(25, dy / dt * .06)), age: 0,
      });
      if (particles.current.length > 140) particles.current.splice(0, particles.current.length - 140);
    };
    const draw = () => {
      field.fill(0); direction.fill(0);
      for (const point of particles.current) {
        const life = Math.max(0, 1 - point.age / 4.5);
        const radius = (mobile ? 50 : 76) * (.65 + life * .35);
        const left = Math.max(0, Math.floor((point.x - radius) / stepX));
        const right = Math.min(columns - 1, Math.ceil((point.x + radius) / stepX));
        const top = Math.max(0, Math.floor((point.y - radius) / stepY));
        const bottom = Math.min(rows - 1, Math.ceil((point.y + radius) / stepY));
        for (let row = top; row <= bottom; row++) for (let col = left; col <= right; col++) {
          const dx = (col * stepX - point.x) / radius, dy = (row * stepY - point.y) / radius;
          const weight = Math.max(0, 1 - dx * dx - dy * dy) ** 2 * life;
          const index = row * columns + col;
          // Max instead of addition keeps brightness steady when the pointer slows down.
          if (weight > field[index]) { field[index] = weight; direction[index] = point.vx; }
        }
      }
      context.clearRect(0, 0, width, height);
      for (let index = 0; index < field.length; index++) {
        const strength = field[index];
        const col = index % columns, row = Math.floor(index / columns);
        const pixel = index * 4;
        pixels.data[pixel] = 83; pixels.data[pixel + 1] = 143; pixels.data[pixel + 2] = 123;
        pixels.data[pixel + 3] = Math.round(strength * 90);
        if (strength < .045) continue;
        const glyph = strength < .22 ? 0 : strength < .42 ? 1 : strength < .56 ? 2 : direction[index] >= 0 ? 3 : 4;
        context.globalAlpha = Math.min(.68, strength * .72);
        context.drawImage(atlas, glyph * 18, 0, 18, 24, col * stepX, row * stepY, 18, 24);
      }
      context.globalAlpha = 1;
      light.putImageData(pixels, 0, 0);
    };
    const tick = (now: number) => {
      if (now - last >= interval) {
        const dt = last ? Math.min(now - last, 100) / 1000 : interval / 1000;
        last = now;
        phase.current += dt;
        particles.current = particles.current.filter(point => point.age < 4.5);
        for (const point of particles.current) {
          point.age += dt;
          point.x += (point.vx + Math.sin(point.age * 1.3) * 5) * dt;
          point.y += (point.vy - 5) * dt;
        }
        if (mobile) { const next = wander(phase.current); emit(head, next, dt); head = next; }
        else if (now - pointerAt < 450) {
          const ease = 1 - Math.exp(-dt * 14);
          const next = { x: head.x + (target.x - head.x) * ease, y: head.y + (target.y - head.y) * ease };
          emit(head, next, dt); head = next;
        }
        draw();
      }
      if (mobile || particles.current.length || now - pointerAt < 450) frame = requestAnimationFrame(tick);
      else { frame = 0; surface.dataset.motion = "idle"; }
    };
    const resume = () => {
      cancelAnimationFrame(frame); frame = 0; last = 0;
      surface.dataset.motion = still ? "static" : document.hidden ? "paused" : "flowing";
      if (!document.hidden && !still) frame = requestAnimationFrame(tick);
    };
    const move = (event: PointerEvent) => {
      if (mobile || still || event.pointerType !== "mouse") return;
      if (performance.now() - pointerAt > 1000) head = { x: event.clientX, y: event.clientY };
      target = { x: event.clientX, y: event.clientY };
      pointerAt = performance.now();
      if (!frame && !document.hidden) resume();
    };
    const resize = () => {
      const previousWidth = width, previousHeight = height;
      width = window.innerWidth; height = Math.max(document.documentElement.clientHeight, window.innerHeight);
      mobile = width < 768 || !pointerQuery.matches;
      stepX = mobile ? 14 : 13; stepY = mobile ? 20 : 18;
      interval = 1000 / (mobile ? 18 : 24);
      columns = Math.ceil(width / stepX); rows = Math.ceil(height / stepY);
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      surface.width = Math.round(width * dpr); surface.height = Math.round(height * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      glow.width = columns; glow.height = rows;
      field = new Float32Array(columns * rows); direction = new Float32Array(columns * rows);
      pixels = light.createImageData(columns, rows);
      if (previousWidth) for (const point of particles.current) { point.x *= width / previousWidth; point.y *= height / previousHeight; }
      if (!particles.current.length && !initialized.current) {
        // An initial wake makes the effect discoverable, including in reduced-motion mode.
        for (let age = 3; age >= 0; age -= .09) {
          const position = wander(phase.current - age);
          particles.current.push({ ...position, vx: 8, vy: -2, age });
        }
      }
      initialized.current = true;
      head = wander(phase.current); target = head;
      draw(); resume();
    };
    resize();
    window.addEventListener("resize", resize, { passive: true });
    window.addEventListener("pointermove", move, { passive: true });
    pointerQuery.addEventListener("change", resize);
    document.addEventListener("visibilitychange", resume);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", move);
      pointerQuery.removeEventListener("change", resize);
      document.removeEventListener("visibilitychange", resume);
    };
  }, [still]);

  return (
    <>
      <div className="ambient-background" aria-hidden="true">
        <div className="ambient-glow" />
        <canvas ref={bloom} className="ascii-bloom" />
        <canvas ref={canvas} className="ascii-flow" />
        <div className="ambient-shade" />
      </div>
      <div className="background-controls">
        <button type="button" onClick={() => setPaused(value => !value)} disabled={reduced}
          aria-pressed={still} aria-label={reduced ? "Background motion disabled by your reduced motion preference" : paused ? "Play background animation" : "Pause background animation"}>
          <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true" fill="currentColor">
            {still ? <path d="m5 3 8 5-8 5Z" /> : <path d="M4 3h3v10H4zm5 0h3v10H9z" />}
          </svg>
          {reduced ? "Reduced motion" : paused ? "Motion paused" : "Pause motion"}
        </button>
      </div>
    </>
  );
}
