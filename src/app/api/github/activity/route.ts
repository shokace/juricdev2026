import { NextResponse } from "next/server";

export const runtime = "edge";
const TARGET_ITEMS = 5;
const GITHUB_TIMEOUT_MS = 4000;

type GithubEvent = {
  id: string;
  type: string;
  created_at: string;
  repo: { name: string };
  payload: {
    commits?: Array<{ sha: string; message: string }>;
    pull_request?: { html_url: string; title: string };
  };
};

type ActivityItem = {
  id: string;
  type: "commit" | "pull_request";
  title: string;
  url: string;
  repo: string;
  created_at: string;
};

export const revalidate = 300;

async function fetchGithubJson<T>(
  url: string,
  headers: Record<string, string>
): Promise<T | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GITHUB_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers,
      next: { revalidate },
      signal: controller.signal,
    });
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const username = searchParams.get("user") ?? "shokace";
  const githubToken = process.env.GITHUB_TOKEN;

  const headers: Record<string, string> = {
    "User-Agent": "juricdev2026",
    Accept: "application/vnd.github+json",
  };
  if (githubToken) {
    headers.Authorization = `Bearer ${githubToken}`;
  }

  const events =
    (await fetchGithubJson<GithubEvent[]>(
      `https://api.github.com/users/${username}/events/public?per_page=100`,
      headers
    )) ?? [];
  const items: ActivityItem[] = [];

  for (const event of events) {
    if (event.type === "PushEvent" && event.payload.commits?.length) {
      for (const commit of event.payload.commits) {
        items.push({
          id: `${event.id}-${commit.sha}`,
          type: "commit",
          title: commit.message,
          url: `https://github.com/${event.repo.name}/commit/${commit.sha}`,
          repo: event.repo.name,
          created_at: event.created_at,
        });
      }
    }

    if (event.type === "PullRequestEvent" && event.payload.pull_request) {
      items.push({
        id: `${event.id}-pr`,
        type: "pull_request",
        title: event.payload.pull_request.title,
        url: event.payload.pull_request.html_url,
        repo: event.repo.name,
        created_at: event.created_at,
      });
    }
  }

  if (items.length < TARGET_ITEMS) {
    const repos =
      (await fetchGithubJson<
        Array<{
          name: string;
          full_name: string;
        }>
      >(`https://api.github.com/users/${username}/repos?sort=updated&per_page=25`, headers)) ??
      [];

    if (repos.length) {
      const fallbackCommits = await Promise.all(
        repos.slice(0, 12).map(async (repo) => {
          const commits = await fetchGithubJson<
            Array<{
              sha: string;
              commit: { message: string };
              html_url: string;
            }>
          >(`https://api.github.com/repos/${repo.full_name}/commits?per_page=1`, headers);
          const commit = commits?.[0];
          return commit ? { repo, commit } : null;
        })
      );

      for (const entry of fallbackCommits) {
        if (items.length >= TARGET_ITEMS) {
          break;
        }
        if (!entry) {
          continue;
        }
        const { repo, commit } = entry;
        const exists = items.some((item) => item.url === commit.html_url);
        if (exists) {
          continue;
        }

        items.push({
          id: `${repo.full_name}-${commit.sha}`,
          type: "commit",
          title: commit.commit.message,
          url: commit.html_url,
          repo: repo.full_name,
          created_at: new Date().toISOString(),
        });
      }
    }
  }

  const sorted = items
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )
    .slice(0, TARGET_ITEMS);

  return NextResponse.json({
    user: username,
    items: sorted,
  });
}
