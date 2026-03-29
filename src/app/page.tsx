import Globe3D from "@/components/globe-3d";
import GithubActivity from "@/components/github-activity";
import IssTelemetry from "@/components/iss-telemetry";
import AnthropicUsage from "@/components/anthropic-usage";
import WavEquation from "@/components/wav-equation";
import FafrInfoButton from "@/components/fafr-info-button";
import {
  fetchGithubContributionGrid,
  type GithubContributionGrid,
} from "@/lib/github";
import { fetchNeverLandingStats, type NeverLandingStats } from "@/lib/neverlanding";

const links = [
  { label: "GitHub", href: "https://github.com/shokace/", icon: "github" },
  { label: "LinkedIn", href: "https://www.linkedin.com/in/pjuric/", icon: "linkedin" },
  { label: "X / Twitter", href: "https://x.com/Ezkie_Music", icon: "x" },
  { label: "Music", href: "https://linktr.ee/ezkie", icon: "music" },
];

function HeaderIcon({ icon }: { icon: (typeof links)[number]["icon"] }) {
  const className = "h-5 w-5 text-[color:var(--text0)] sm:h-5.5 sm:w-5.5";

  switch (icon) {
    case "github":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="currentColor">
          <path d="M12 2C6.48 2 2 6.59 2 12.25c0 4.53 2.87 8.37 6.84 9.72.5.1.66-.22.66-.5 0-.25-.01-.91-.01-1.79-2.78.62-3.37-1.38-3.37-1.38-.46-1.2-1.11-1.52-1.11-1.52-.91-.64.07-.63.07-.63 1 .08 1.53 1.06 1.53 1.06.9 1.57 2.35 1.12 2.92.86.09-.67.35-1.12.63-1.38-2.22-.26-4.56-1.15-4.56-5.1 0-1.13.39-2.05 1.03-2.78-.1-.26-.45-1.3.1-2.72 0 0 .84-.28 2.75 1.06A9.3 9.3 0 0 1 12 6.8a9.3 9.3 0 0 1 2.5.35c1.9-1.34 2.75-1.06 2.75-1.06.54 1.42.2 2.46.1 2.72.64.73 1.03 1.65 1.03 2.78 0 3.96-2.34 4.83-4.57 5.08.36.32.68.95.68 1.92 0 1.39-.01 2.5-.01 2.84 0 .28.18.61.67.5A10.27 10.27 0 0 0 22 12.25C22 6.59 17.52 2 12 2Z" />
        </svg>
      );
    case "linkedin":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="currentColor">
          <path d="M6.94 8.5H3.56V20h3.38V8.5Zm.22-3.56C7.15 3.84 6.28 3 5.26 3S3.38 3.84 3.38 4.94c0 1.07.84 1.94 1.86 1.94h.02c1.03 0 1.9-.87 1.9-1.94ZM20.62 13.01c0-3.53-1.88-5.17-4.39-5.17-2.02 0-2.93 1.13-3.44 1.92V8.5H9.41c.04.83 0 11.5 0 11.5h3.38v-6.42c0-.34.02-.69.12-.93.27-.69.87-1.4 1.9-1.4 1.34 0 1.88 1.04 1.88 2.56V20h3.38v-6.99Z" />
        </svg>
      );
    case "x":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="currentColor">
          <path d="M18.9 2H22l-6.78 7.75L23.2 22h-6.27l-4.9-7.4L5.56 22H2.44l7.25-8.29L1.98 2h6.43l4.42 6.76L18.9 2Zm-1.1 18h1.74L7.46 3.9H5.59L17.8 20Z" />
        </svg>
      );
    case "music":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="currentColor">
          <path d="M8.8 15.8c-1.95 0-3.4 1.07-3.4 2.55C5.4 19.89 6.85 21 8.8 21s3.4-1.11 3.4-2.65V7.55l6.3-1.7v8.05c-.54-.3-1.2-.45-1.95-.45-1.95 0-3.4 1.07-3.4 2.55 0 1.54 1.45 2.65 3.4 2.65 1.96 0 3.45-1.11 3.45-2.65V3.2L10.2 5.8v10c-.42-.02-.85 0-1.4 0Z" />
        </svg>
      );
    default:
      return null;
  }
}

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

function Panel({
  title,
  children,
  headerRight,
}: {
  title?: React.ReactNode;
  children: React.ReactNode;
  headerRight?: React.ReactNode;
}) {
  return (
    <section className="hud-panel rounded-sm p-4">
      {title ? (
        <div className="mb-4 flex items-center justify-between text-[0.7rem] uppercase tracking-[0.3em] text-faint">
          <span>{title}</span>
          {headerRight ?? <span className="glow-red">●</span>}
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
      <main className="relative z-10 mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        <Panel>
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-[0.7rem] uppercase tracking-[0.3em] text-faint">Profile</div>
              <h1 className="mt-3 text-3xl text-[color:var(--text0)]">Petar Juric</h1>
              <p className="mt-2 text-[0.85rem] uppercase tracking-[0.25em] text-muted">
                Software Engineer
              </p>
            </div>
            <div className="grid w-full min-w-0 grid-cols-4 gap-1 text-[0.48rem] uppercase tracking-[0.04em] text-faint [@media(min-width:375px)]:gap-1.5 [@media(min-width:375px)]:text-[0.52rem] [@media(min-width:375px)]:tracking-[0.06em] sm:gap-2 sm:text-[0.62rem] sm:tracking-[0.12em] md:w-auto md:gap-3 md:text-[0.7rem] md:tracking-[0.2em]">
              {links.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  aria-label={link.label}
                  title={link.label}
                  className="flex min-w-0 min-h-[2.75rem] items-center justify-center rounded-sm border border-[color:var(--border2)] px-1 py-2 text-center leading-tight break-words hover:border-[color:var(--border)] [@media(min-width:375px)]:px-1.5 sm:px-2.5 md:px-3"
                  target="_blank"
                  rel="noreferrer"
                >
                  <HeaderIcon icon={link.icon} />
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
                  <span className="text-[color:var(--text0)]">USA / EU</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Availability</span>
                  <span className="text-[color:#f59e0b]">Contracted</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Current Field</span>
                  <span className="text-[color:var(--text0)]">Telecom</span>
                </div>
              </div>
            </Panel>

            <Panel title="About Me">
              <p className="text-[0.72rem] uppercase leading-6 tracking-[0.2em] text-muted">
                Software engineer focused on real-time data visualization, machine learning,
                and performance-driven real-time systems.
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
          <Panel
            title={
              <a
                href="https://github.com/shokace/W2F"
                target="_blank"
                rel="noreferrer"
                className="hover:text-[color:var(--text0)]"
              >
                FAFR
              </a>
            }
            headerRight={<FafrInfoButton />}
          >
            <WavEquation />
          </Panel>
        </div>

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
