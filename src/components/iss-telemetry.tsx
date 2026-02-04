"use client";

import { useEffect, useState } from "react";

type IssPayload = {
  message: string;
  timestamp: number;
  iss_position: {
    latitude: string;
    longitude: string;
  };
};

type IssState = {
  latitude: string;
  longitude: string;
  status: "STABLE" | "UNSTABLE";
};

export default function IssTelemetry() {
  const [state, setState] = useState<IssState>({
    latitude: "--",
    longitude: "--",
    status: "UNSTABLE",
  });

  useEffect(() => {
    let isMounted = true;

    const fetchIss = async () => {
      try {
        const response = await fetch("/api/iss");
        if (!response.ok) {
          if (isMounted) {
            setState((prev) => ({ ...prev, status: "UNSTABLE" }));
          }
          return;
        }
        const payload = (await response.json()) as IssPayload;
        if (isMounted) {
          setState({
            latitude: payload?.iss_position?.latitude ?? "--",
            longitude: payload?.iss_position?.longitude ?? "--",
            status: payload?.message === "success" ? "STABLE" : "UNSTABLE",
          });
        }
      } catch {
        if (isMounted) {
          setState((prev) => ({ ...prev, status: "UNSTABLE" }));
        }
      }
    };

    fetchIss();
    const interval = setInterval(fetchIss, 5000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="space-y-2 text-[0.72rem] uppercase tracking-[0.2em] text-faint">
      <div className="flex items-center justify-between">
        <span>Lat</span>
        <span className="text-[color:var(--text0)]">{state.latitude}</span>
      </div>
      <div className="flex items-center justify-between">
        <span>Long</span>
        <span className="text-[color:var(--text0)]">{state.longitude}</span>
      </div>
      <div className="flex items-center justify-between">
        <span>Signal Integrity</span>
        <span
          className={
            state.status === "STABLE"
              ? "text-[color:var(--accent-green)]"
              : "text-[color:var(--accent-red)]"
          }
        >
          {state.status}
        </span>
      </div>
    </div>
  );
}
