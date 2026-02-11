import Globe3D from "@/components/globe-3d";
import GithubActivity from "@/components/github-activity";
import IssTelemetry from "@/components/iss-telemetry";
import AnthropicUsage from "@/components/anthropic-usage";
import {
  fetchGithubContributionGrid,
  type GithubContributionGrid,
} from "@/lib/github";
import { fetchNeverLandingStats, type NeverLandingStats } from "@/lib/neverlanding";

const links = [
  { label: "GitHub", href: "https://github.com/shokace/" },
  { label: "LinkedIn", href: "https://www.linkedin.com/in/pjuric/" },
  { label: "X / Twitter", href: "https://x.com/Ezkie_Music" },
];

function formatCompactNumber(value: number) {
  return new Intl.NumberFormat("en-US", { notation: "compact" }).format(value);
}

function formatGigabytes(bytes: number) {
  const gb = bytes / 1_000_000_000;
  return `${gb.toFixed(2)} GB`;
}

function formatWindowHours(hours: number) {
  if (hours % 24 === 0) {
    return `${hours / 24}d`;
  }
  return `${hours}h`;
}

async function getNeverLandingStats(): Promise<NeverLandingStats | null> {
  try {
    return await fetchNeverLandingStats();
  } catch {
    return null;
  }
}

function getEmptyGithubGrid(user: string, year: number): GithubContributionGrid {
  return {
    user,
    year,
    minCol: 0,
    maxCol: 51,
    cells: [],
  };
}

async function getGithubGrid(user: string, year: number): Promise<GithubContributionGrid> {
  try {
    return await fetchGithubContributionGrid(user, year);
  } catch {
    return getEmptyGithubGrid(user, year);
  }
}

function Panel({ title, children }: { title?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="hud-panel rounded-sm p-4">
      {title ? (
        <div className="mb-4 flex items-center justify-between text-[0.7rem] uppercase tracking-[0.3em] text-faint">
          <span>{title}</span>
          <span className="glow-red">●</span>
        </div>
      ) : null}
      {children}
    </section>
  );
}

export const dynamic = "force-dynamic";
export const runtime = "edge";

export default async function Home() {
  const currentYear = new Date().getFullYear();
  const [neverLandingStats, githubGrid] = await Promise.all([
    getNeverLandingStats(),
    getGithubGrid("shokace", currentYear),
  ]);
  const githubCellMap = new Map(
    githubGrid.cells.map((cell) => [`${cell.col}-${cell.row}`, cell.level])
  );
  const githubLevelColors = [
    "rgba(255, 255, 255, 0.04)",
    "rgba(53, 242, 139, 0.2)",
    "rgba(53, 242, 139, 0.38)",
    "rgba(53, 242, 139, 0.58)",
    "rgba(53, 242, 139, 0.78)",
  ];

  return (
    <div className="hud-grid hud-noise min-h-screen">
      <main className="relative z-10 mx-auto max-w-6xl px-6 py-10">
        <Panel>
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-[0.7rem] uppercase tracking-[0.3em] text-faint">Profile</div>
              <h1 className="mt-3 text-3xl text-[color:var(--text0)]">Petar Juric</h1>
              <p className="mt-2 text-[0.85rem] uppercase tracking-[0.25em] text-muted">
                Software Engineer
              </p>
            </div>
            <div className="grid w-full min-w-0 grid-cols-3 gap-2 text-[0.62rem] uppercase tracking-[0.12em] text-faint sm:text-[0.7rem] sm:tracking-[0.2em] md:w-auto md:gap-3">
              {links.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  className="rounded-sm border border-[color:var(--border2)] px-2 py-2 text-center whitespace-nowrap hover:border-[color:var(--border)] sm:px-3"
                  target="_blank"
                  rel="noreferrer"
                >
                  {link.label}
                </a>
              ))}
            </div>
          </div>
        </Panel>

        <section className="mt-6 grid grid-cols-12 gap-4">
          <div className="col-span-12 lg:col-span-3 flex flex-col gap-4">
            <Panel title="Detail">
              <div className="space-y-4 text-[0.75rem] uppercase tracking-[0.2em] text-muted">
                <div className="flex items-center justify-between">
                  <span>Location</span>
                  <span className="text-[color:var(--text0)]">Croatia</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Availability</span>
                  <span className="text-[color:#f59e0b]">Contracted</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Focus</span>
                  <span className="text-[color:var(--text0)]">Telecom</span>
                </div>
              </div>
            </Panel>

            <Panel title="Mission Brief">
              <p className="text-[0.72rem] uppercase leading-6 tracking-[0.2em] text-muted">
                Software engineer with experience in real-time C++ and embedded hardware. 
                Qt/Python tooling, DSP audio, and cloud workflows.
              </p>
            </Panel>

            <Panel
              title={
                <a
                  href="https://neverlanding.page"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-[color:var(--text0)]"
                >
                  NeverLanding.page Stats
                </a>
              }
            >
              <div className="space-y-3 text-[0.72rem] uppercase tracking-[0.2em] text-muted">
                <div className="flex items-center justify-between">
                  <span>Unique Visitors</span>
                  <span className="text-[color:var(--text0)]">
                    {neverLandingStats
                      ? formatCompactNumber(neverLandingStats.uniqueVisitors)
                      : "--"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Requests</span>
                  <span className="text-[color:var(--text0)]">
                    {neverLandingStats
                      ? formatCompactNumber(neverLandingStats.requests)
                      : "--"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Edge Data</span>
                  <span className="text-[color:var(--text0)]">
                    {neverLandingStats
                      ? formatGigabytes(neverLandingStats.edgeResponseBytes)
                      : "--"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Window</span>
                  <span className="text-[color:var(--text0)]">
                    {neverLandingStats ? formatWindowHours(neverLandingStats.windowHours) : "--"}
                  </span>
                </div>
              </div>
            </Panel>
          </div>

          <div className="col-span-12 lg:col-span-6 flex flex-col gap-4">
            <Panel title="ISS tracking · live orbital telemetry">
              <div className="flex w-full flex-col items-center justify-center gap-2 overflow-visible">
                <Globe3D />
              </div>
              <div className="-mt-4">
                <IssTelemetry />
              </div>
            </Panel>

            

            
          </div>

          <div className="col-span-12 lg:col-span-3 flex flex-col gap-4">
            <Panel title="Contributions">
              <GithubActivity />
            </Panel>

            <Panel title="Claude Usage">
              <AnthropicUsage />
            </Panel>

          </div>
        </section>

        <div className="mt-6">
          <Panel title={`GitHub Activity ${currentYear}`}>
            <div className="mt-4 overflow-hidden rounded-sm border border-[color:var(--border2)] bg-black/30 p-3">
              <div
                className="gh-grid grid gap-[3px]"
                style={{
                  gridTemplateColumns: `repeat(${githubGrid.maxCol - githubGrid.minCol + 1}, minmax(0, 1fr))`,
                }}
              >
                {Array.from({ length: 7 }, (_, row) =>
                  Array.from(
                    { length: githubGrid.maxCol - githubGrid.minCol + 1 },
                    (_, colIndex) => {
                      const col = colIndex + githubGrid.minCol;
                      const level = Math.min(
                        githubCellMap.get(`${col}-${row}`) ?? 0,
                        4
                      );
                      return (
                        <span
                          key={`${col}-${row}`}
                          className={`gh-cell gh-level-${level}`}
                          style={{
                            display: "block",
                            backgroundColor: githubLevelColors[level],
                            border: "1px solid rgba(255, 255, 255, 0.04)",
                          }}
                        />
                      );
                    }
                  )
                )}
              </div>
            </div>
          </Panel>
        </div>
      </main>
    </div>
  );
}
