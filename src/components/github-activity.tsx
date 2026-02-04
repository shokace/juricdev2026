"use client";

import { useEffect, useState } from "react";

type ActivityItem = {
  id: string;
  type: "commit" | "pull_request";
  title: string;
  url: string;
  repo: string;
  created_at: string;
};

type ActivityResponse = {
  user: string;
  items: ActivityItem[];
};

function truncate(text: string, max = 70) {
  if (text.length <= max) {
    return text;
  }
  return `${text.slice(0, max).trim()}...`;
}

export default function GithubActivity() {
  const [items, setItems] = useState<ActivityItem[]>([]);

  useEffect(() => {
    let isMounted = true;

    const fetchActivity = async () => {
      try {
        const response = await fetch("/api/github/activity?user=shokace");
        if (!response.ok) {
          return;
        }
        const payload = (await response.json()) as ActivityResponse;
        if (isMounted) {
          setItems(payload.items ?? []);
        }
      } catch {
        // Ignore transient errors.
      }
    };

    fetchActivity();
    const interval = setInterval(fetchActivity, 60000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="space-y-3 text-[0.72rem] uppercase tracking-[0.2em] text-muted">
      {items.length ? (
        items.map((item) => (
          <a
            key={item.id}
            href={item.url}
            target="_blank"
            rel="noreferrer"
            className="block border-b border-[color:var(--border2)] pb-3 last:border-0 hover:text-[color:var(--text0)] hover:bg-white/5 hover:px-2 hover:py-2 transition-colors"
          >
            <div className="flex items-center justify-between text-[0.7rem] text-faint">
              <span className="max-w-[60%] truncate">{item.repo}</span>
              <span>{item.type === "commit" ? "Commit" : "PR"}</span>
            </div>
            <div className="mt-2 text-[0.72rem] uppercase tracking-[0.2em] text-muted">
              <span className="block max-w-full truncate">{truncate(item.title, 90)}</span>
            </div>
          </a>
        ))
      ) : (
        <div className="text-faint">No recent activity.</div>
      )}
    </div>
  );
}
