import { Suspense } from "react";
import SiteEffects from "@/components/site-effects";
import Globe3D from "@/components/globe-3d";
import GithubActivity from "@/components/github-activity";
import IssTelemetry from "@/components/iss-telemetry";
import UsageDeck from "@/components/usage-deck";
import WavEquation from "@/components/wav-equation";
import FafrInfoButton from "@/components/fafr-info-button";
import {
  fetchGithubContributionGrid,
  type GithubContributionGrid,
} from "@/lib/github";
import { fetchNeverLandingStats, type NeverLandingStats } from "@/lib/neverlanding";

const links = [
  {
    label: "Sefaly",
    href: "https://www.sefaly.com",
    icon: "sefaly",
    description: "Quantum-safe encrypted cloud storage",
  },
  {
    label: "Vila Nena",
    href: "https://vilanena.com/",
    icon: "home",
    description: "Our villa in Croatia — book a stay",
  },
  {
    label: "GitHub",
    href: "https://github.com/shokace/",
    icon: "github",
    description: "Source code and open projects",
  },
  {
    label: "LinkedIn",
    href: "https://www.linkedin.com/in/pjuric/",
    icon: "linkedin",
    description: "Work history and experience",
  },
  {
    label: "X / Twitter",
    href: "https://x.com/Ezkie_Music",
    icon: "x",
    description: "Posts and short updates",
  },
  {
    label: "Music",
    href: "https://linktr.ee/ezkie",
    icon: "music",
    description: "Every release and streaming link",
  },
];

function HeaderIcon({ icon }: { icon: (typeof links)[number]["icon"] }) {
  const className = "h-5 w-5 text-[color:var(--text0)] sm:h-5.5 sm:w-5.5";

  switch (icon) {
    case "sefaly":
      return (
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          className={className}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 2 4 7v10l8 5 8-5V7l-8-5Z" />
          <path d="M12 22V12" />
          <path d="m20 7-8 5-8-5" />
        </svg>
      );
    case "home":
      return (
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          className={className}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M3.5 10.6 12 3.5l8.5 7.1" />
          <path d="M5.6 9.6V20h12.8V9.6" />
          <path d="M9.9 20v-5.4h4.2V20" />
        </svg>
      );
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

function NeverLandingRows({ stats }: { stats: NeverLandingStats | null }) {
  return (
    <div className="space-y-3 text-[0.78rem] tracking-normal text-muted">
      <div className="flex items-center justify-between">
        <span>Unique Visitors</span>
        <span className="text-[color:var(--text0)]">
          {stats ? formatCompactNumber(stats.uniqueVisitors) : "--"}
        </span>
      </div>
      <div className="flex items-center justify-between">
        <span>Requests</span>
        <span className="text-[color:var(--text0)]">
          {stats ? formatCompactNumber(stats.requests) : "--"}
        </span>
      </div>
      <div className="flex items-center justify-between">
        <span>Edge Data</span>
        <span className="text-[color:var(--text0)]">
          {stats ? formatGigabytes(stats.edgeResponseBytes) : "--"}
        </span>
      </div>
      <div className="flex items-center justify-between">
        <span>Window</span>
        <span className="text-[color:var(--text0)]">
          {stats ? formatWindowHours(stats.windowHours) : "--"}
        </span>
      </div>
    </div>
  );
}

async function NeverLandingLive() {
  const stats = await getNeverLandingStats();
  return <NeverLandingRows stats={stats} />;
}

function GithubGridView({ grid }: { grid: GithubContributionGrid }) {
  const cellMap = new Map(grid.cells.map((cell) => [`${cell.col}-${cell.row}`, cell.level]));
  const levelColors = [
    "rgba(255, 255, 255, 0.04)",
    "rgba(145, 200, 175, 0.22)",
    "rgba(145, 200, 175, 0.42)",
    "rgba(145, 200, 175, 0.65)",
    "rgba(145, 200, 175, 0.9)",
  ];

  return (
    <div className="github-calendar" role="region" aria-label="GitHub contribution calendar" tabIndex={0}>
      <div
        className="gh-grid grid gap-[3px]"
        style={{
          gridTemplateColumns: `repeat(${grid.maxCol - grid.minCol + 1}, minmax(0, 1fr))`,
        }}
      >
        {Array.from({ length: 7 }, (_, row) =>
          Array.from({ length: grid.maxCol - grid.minCol + 1 }, (_, colIndex) => {
            const col = colIndex + grid.minCol;
            const level = Math.min(cellMap.get(`${col}-${row}`) ?? 0, 4);
            return (
              <span
                key={`${col}-${row}`}
                className={`gh-cell gh-level-${level}`}
                title={grid.cells.find((cell) => cell.col === col && cell.row === row)?.date}
                style={{
                  display: "block",
                  backgroundColor: levelColors[level],
                  border: "1px solid rgba(255, 255, 255, 0.04)",
                }}
              />
            );
          })
        )}
      </div>
    </div>
  );
}

async function GithubGridLive({ user, year }: { user: string; year: number }) {
  const grid = await getGithubGrid(user, year);
  return <GithubGridView grid={grid} />;
}

function Panel({
  title,
  children,
  headerRight,
  className = "",
}: {
  title?: React.ReactNode;
  children: React.ReactNode;
  headerRight?: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`hud-panel min-w-0 ${className}`}>
      {title ? (
        <div className="panel-heading">
          <h2>{title}</h2>
          {headerRight}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export const dynamic = "force-dynamic";
export const runtime = "edge";

export default function Home() {
  const currentYear = new Date().getFullYear();

  return (
    <div className="site-shell min-h-screen">
      <SiteEffects />
      <main className="site-main">
        <Panel className="profile-hero">
          <div className="profile-intro">
            <div>
              <p className="eyebrow">Profile</p>
              <h1>Petar Juric<span className="name-period" aria-hidden="true">.</span></h1>
              <p className="profile-role">Software Engineer</p>
            </div>
            <nav className="project-nav" aria-label="Projects and links">
              <p className="eyebrow">Projects &amp; Links</p>
              <div className="project-links">
                {links.map((link) => (
                  <a key={link.label} href={link.href} className="project-link"
                    aria-label={`${link.label} — ${link.description}`}
                    title={link.description} target="_blank" rel="noreferrer">
                    <HeaderIcon icon={link.icon} />
                    <span>{link.label}</span>
                    <span className="link-arrow" aria-hidden="true">↗</span>
                  </a>
                ))}
              </div>
            </nav>
          </div>
        </Panel>

        <section className="dashboard-grid mt-5 grid grid-cols-12 items-stretch gap-4" data-dashboard>
          <div className="col-span-12 lg:col-span-3 flex min-w-0 flex-col gap-4" data-dashboard-column="profile">
            <Panel title="Detail" className="detail-panel">
              <div className="space-y-4 text-[0.75rem] tracking-normal text-muted">
                <div className="flex items-center justify-between">
                  <span>Location</span>
                  <span className="text-[color:var(--text0)]">USA</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Availability</span>
                  <span className="text-[color:#f59e0b]">Contracted</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Current Field</span>
                  <span className="whitespace-nowrap text-[color:var(--text0)]">AI / Big Data</span>
                </div>
              </div>
            </Panel>

            <Panel title="About Me" className="about-panel lg:flex-1">
              <p className="about-copy">
                I build software for secure storage, real-time visualization, and audio.
                My projects include the <a href="https://github.com/shokace/sefaly-cli" target="_blank" rel="noreferrer">Sefaly CLI</a>,
                satellite trackers, and <a href="https://github.com/shokace/FAFR" target="_blank" rel="noreferrer">FAFR</a>&apos;s Fourier-based audio experiments.
              </p>
              <p className="about-copy">
                I also produce music as <a href="https://linktr.ee/ezkie" target="_blank" rel="noreferrer">Ezkie</a>.
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
              <Suspense fallback={<NeverLandingRows stats={null} />}>
                <NeverLandingLive />
              </Suspense>
            </Panel>
          </div>

          <div className="col-span-12 lg:col-span-6 flex min-w-0 flex-col gap-4" data-dashboard-column="globe">
            <Panel title="ISS tracking · live orbital telemetry" className="tracker-panel flex flex-1 flex-col">
              <div className="flex w-full flex-1 flex-col items-center justify-center gap-2 overflow-visible">
                <Globe3D />
              </div>
              <div>
                <IssTelemetry />
              </div>
            </Panel>

          </div>

          <div className="col-span-12 lg:col-span-3 flex min-w-0 flex-col gap-4" data-dashboard-column="activity">
            <Panel title="Contributions">
              <div className="lg:max-h-32 lg:overflow-y-auto lg:pr-1 [scrollbar-width:thin]" role="region" aria-label="Recent GitHub contributions">
                <GithubActivity />
              </div>
            </Panel>

            <UsageDeck />

          </div>
        </section>

        <div className="mt-4">
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

        <div className="mt-4">
          <Panel title={`GitHub Activity ${currentYear}`}>
            <Suspense fallback={<GithubGridView grid={getEmptyGithubGrid("shokace", currentYear)} />}>
              <GithubGridLive user="shokace" year={currentYear} />
            </Suspense>
          </Panel>
        </div>
      </main>
    </div>
  );
}
