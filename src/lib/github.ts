export type GithubContributionCell = {
  date: string;
  level: number;
  row: number;
  col: number;
};

export type GithubContributionGrid = {
  user: string;
  year: number;
  minCol: number;
  maxCol: number;
  cells: GithubContributionCell[];
};
const GITHUB_TIMEOUT_MS = 4000;

function parseContributionCells(html: string): GithubContributionCell[] {
  const cellMatches = html.matchAll(
    /<td[^>]*class="[^"]*ContributionCalendar-day[^"]*"[^>]*>/g
  );
  const cells: GithubContributionCell[] = [];

  for (const match of cellMatches) {
    const tag = match[0];
    const attrs = Object.fromEntries(
      [...tag.matchAll(/([a-zA-Z0-9:-]+)="([^"]*)"/g)].map(([, key, value]) => [
        key,
        value,
      ])
    );

    const date = attrs["data-date"];
    const level = Number(attrs["data-level"] ?? "0");
    const id = attrs["id"] ?? "";
    const idMatch = id.match(/contribution-day-component-(\d+)-(\d+)/);

    if (!date || !idMatch) {
      continue;
    }

    const rowIndex = Number(idMatch[1]);
    const colIndex = Number(idMatch[2]);

    cells.push({
      date,
      level: Number.isNaN(level) ? 0 : level,
      row: Number.isNaN(rowIndex) ? 0 : rowIndex,
      col: Number.isNaN(colIndex) ? 0 : colIndex,
    });
  }

  return cells;
}

export async function fetchGithubContributionGrid(
  user: string,
  year: number
): Promise<GithubContributionGrid> {
  const from = `${year}-01-01`;
  const to = `${year}-12-31`;
  const url = `https://github.com/users/${user}/contributions?from=${from}&to=${to}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GITHUB_TIMEOUT_MS);
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0",
      "X-Requested-With": "XMLHttpRequest",
      Accept: "text/html",
    },
    next: { revalidate: 300 },
    signal: controller.signal,
  }).finally(() => {
    clearTimeout(timeout);
  });

  if (!response.ok) {
    throw new Error("GitHub request failed.");
  }

  const html = await response.text();
  const cells = parseContributionCells(html);
  const maxCol = cells.reduce((max, cell) => Math.max(max, cell.col), 0);
  const minCol = cells.reduce((min, cell) => Math.min(min, cell.col), maxCol);

  return {
    user,
    year,
    minCol,
    maxCol,
    cells,
  };
}
