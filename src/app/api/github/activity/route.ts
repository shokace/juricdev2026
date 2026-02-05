import { NextResponse } from "next/server";

export const runtime = "edge";

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

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const username = searchParams.get("user") ?? "shokace";

  const headers = {
    "User-Agent": "juricdev2026",
    Accept: "application/vnd.github+json",
  };

  const response = await fetch(`https://api.github.com/users/${username}/events/public`, {
    headers,
    next: { revalidate },
  });

  if (!response.ok) {
    return NextResponse.json(
      { error: "Failed to fetch GitHub events." },
      { status: 502 }
    );
  }

  const events = (await response.json()) as GithubEvent[];
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

  if (items.length < 4) {
    const reposResponse = await fetch(
      `https://api.github.com/users/${username}/repos?sort=updated&per_page=10`,
      { headers, next: { revalidate } }
    );

    if (reposResponse.ok) {
      const repos = (await reposResponse.json()) as Array<{
        name: string;
        full_name: string;
      }>;

      for (const repo of repos) {
        if (items.length >= 4) {
          break;
        }
        const commitsResponse = await fetch(
          `https://api.github.com/repos/${repo.full_name}/commits?per_page=1`,
          { headers, next: { revalidate } }
        );

        if (!commitsResponse.ok) {
          continue;
        }
        const commits = (await commitsResponse.json()) as Array<{
          sha: string;
          commit: { message: string };
          html_url: string;
        }>;

        const commit = commits[0];
        if (!commit) {
          continue;
        }
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

  return NextResponse.json({
    user: username,
    items: items.slice(0, 4),
  });
}
