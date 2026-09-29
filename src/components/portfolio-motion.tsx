"use client";

import { useEffect } from "react";

export default function PortfolioMotion() {
  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const elements = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));
    let observer: IntersectionObserver | undefined;

    const reset = () => {
      observer?.disconnect();
      elements.forEach((element) => element.classList.remove("reveal-pending"));
    };
    const setup = () => {
      reset();
      if (preference.matches || !("IntersectionObserver" in window)) return;

      observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.remove("reveal-pending");
          observer?.unobserve(entry.target);
        });
      }, { rootMargin: "0px 0px -24px 0px", threshold: 0.04 });

      elements.forEach((element) => {
        // Keep the first screen and restored scroll position immediately readable.
        if (element.getBoundingClientRect().top < window.innerHeight - 24) return;
        element.classList.add("reveal-pending");
        observer?.observe(element);
      });
    };

    setup();
    preference.addEventListener("change", setup);
    return () => {
      reset();
      preference.removeEventListener("change", setup);
    };
  }, []);

  return null;
}
