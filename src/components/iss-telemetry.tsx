"use client";

import { useEffect, useState } from "react";
import { subscribeIss } from "@/lib/iss-feed";

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
    return subscribeIss((snapshot) => {
      setState({
        latitude: snapshot.latitude,
        longitude: snapshot.longitude,
        status: snapshot.ok ? "STABLE" : "UNSTABLE",
      });
    });
  }, []);

  return (
    <div className="space-y-2 text-[0.72rem] uppercase tracking-[0.2em] text-faint">
      <div className="flex items-center justify-between">
        <span>Latitude</span>
        <span className="text-[color:var(--text0)]">{state.latitude}</span>
      </div>
      <div className="flex items-center justify-between">
        <span>Longitude</span>
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
