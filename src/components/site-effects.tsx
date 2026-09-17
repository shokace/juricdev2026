"use client";

import { useEffect } from "react";

export default function SiteEffects() {
  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const animations: Animation[] = [];
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        observer.unobserve(entry.target);
        if (!preference.matches) animations.push(entry.target.animate(
          [{ opacity: 0.45, transform: "translateY(8px)" }, { opacity: 1, transform: "translateY(0)" }],
          { duration: 420, easing: "cubic-bezier(.2,.7,.2,1)" },
        ));
      }
    }, { threshold: 0.06 });
    document.querySelectorAll(".hud-panel").forEach((panel) => observer.observe(panel));
    const stop = () => { if (preference.matches) animations.forEach((animation) => animation.cancel()); };
    preference.addEventListener("change", stop);
    return () => { observer.disconnect(); animations.forEach((animation) => animation.cancel()); preference.removeEventListener("change", stop); };
  }, []);
  return null;
}
