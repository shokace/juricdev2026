import Globe3D from "@/components/globe-3d";
import IssTelemetry from "@/components/iss-telemetry";
import { fetchGithubContributionGrid } from "@/lib/github";
import { fetchNeverLandingStats, type NeverLandingStats } from "@/lib/neverlanding";

type SparklineProps = {
  data: number[];
  color: string;
};

type StatProps = {
  label: string;
  value: string;
  delta: string;
  positive?: boolean;
};

type Position = {
  symbol: string;
  qty: number;
  avg: string;
  last: string;
  pnl: string;
  positive: boolean;
  data: number[];
};

type OpsItem = {
  title: string;
  detail: string;
  status: string;
};

const kpis: StatProps[] = [
  { label: "Equity", value: "$124,480.88", delta: "+2.8%", positive: true },
  { label: "Cash", value: "$18,230.42", delta: "-0.4%", positive: false },
  { label: "Buying Power", value: "$36,910.23", delta: "+1.2%", positive: true },
];

const positions: Position[] = [
  {
    symbol: "NVDA",
    qty: 42,
    avg: "$512.33",
    last: "$540.12",
    pnl: "+$1,166.94",
    positive: true,
    data: [12, 14, 13, 18, 22, 19, 24, 26, 28, 30, 29, 31],
  },
  {
    symbol: "AAPL",
    qty: 120,
    avg: "$176.91",
    last: "$173.44",
    pnl: "-$416.40",
    positive: false,
    data: [30, 28, 29, 27, 26, 25, 26, 24, 23, 22, 23, 21],
  },
  {
    symbol: "AMD",
    qty: 65,
    avg: "$148.40",
    last: "$156.02",
    pnl: "+$495.30",
    positive: true,
    data: [14, 16, 15, 17, 18, 20, 21, 23, 22, 24, 25, 26],
  },
  {
    symbol: "PLTR",
    qty: 90,
    avg: "$22.05",
    last: "$20.84",
    pnl: "-$108.90",
    positive: false,
    data: [18, 17, 18, 16, 15, 14, 13, 14, 12, 13, 12, 11],
  },
];

const opsItems: OpsItem[] = [
  { title: "Market Open Sweep", detail: "Macro volatility scan", status: "ACTIVE" },
  { title: "Risk Envelope", detail: "VaR recalibration", status: "SYNC" },
  { title: "Order Routing", detail: "Dark pool check", status: "STANDBY" },
  { title: "Signal Drift", detail: "Model variance +0.8%", status: "ALERT" },
];

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

function StatCard({ label, value, delta, positive }: StatProps) {
  return (
    <div className="hud-panel rounded-sm p-4">
      <div className="text-[0.65rem] uppercase tracking-[0.28em] text-faint">{label}</div>
      <div className="mt-3 text-xl text-[color:var(--text0)]">{value}</div>
      <div
        className={`mt-2 text-[0.7rem] uppercase tracking-[0.2em] ${
          positive ? "text-[color:var(--accent-green)]" : "text-[color:var(--accent-red)]"
        }`}
      >
        {delta}
      </div>
    </div>
  );
}

function Sparkline({ data, color }: SparklineProps) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const points = data
    .map((value, index) => {
      const x = (index / (data.length - 1)) * 100;
      const y = 100 - ((value - min) / (max - min || 1)) * 100;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg viewBox="0 0 100 100" className="h-8 w-24">
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
        opacity="0.8"
      />
    </svg>
  );
}

function HUDTable({ rows }: { rows: Position[] }) {
  return (
    <div className="overflow-hidden rounded-sm border border-[color:var(--border2)]">
      <table className="w-full text-left text-[0.7rem] uppercase tracking-[0.2em] text-faint">
        <thead className="border-b border-[color:var(--border2)]">
          <tr>
            <th className="px-3 py-2">Symbol</th>
            <th className="px-3 py-2">Qty</th>
            <th className="px-3 py-2">Avg</th>
            <th className="px-3 py-2">Last</th>
            <th className="px-3 py-2">P&L</th>
            <th className="px-3 py-2">Trend</th>
          </tr>
        </thead>
        <tbody className="text-[0.75rem] tracking-[0.18em] text-muted">
          {rows.map((row) => (
            <tr key={row.symbol} className="border-b border-[color:var(--border2)] last:border-0">
              <td className="px-3 py-3 text-[color:var(--text0)]">{row.symbol}</td>
              <td className="px-3 py-3">{row.qty}</td>
              <td className="px-3 py-3">{row.avg}</td>
              <td className="px-3 py-3">{row.last}</td>
              <td
                className={`px-3 py-3 ${
                  row.positive ? "text-[color:var(--accent-green)]" : "text-[color:var(--accent-red)]"
                }`}
              >
                {row.pnl}
              </td>
              <td className="px-3 py-3">
                <Sparkline
                  data={row.data}
                  color={row.positive ? "var(--accent-green)" : "var(--accent-red)"}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function OpsListItem({ item }: { item: OpsItem }) {
  const statusColor =
    item.status === "ALERT"
      ? "text-[color:var(--accent-red)]"
      : item.status === "ACTIVE"
        ? "text-[color:var(--accent-green)]"
        : "text-faint";

  return (
    <div className="border-b border-[color:var(--border2)] pb-3 last:border-0">
      <div className="flex items-center justify-between text-[0.72rem] uppercase tracking-[0.25em] text-[color:var(--text0)]">
        <span>{item.title}</span>
        <span className={statusColor}>{item.status}</span>
      </div>
      <div className="mt-2 text-[0.7rem] uppercase tracking-[0.2em] text-faint">{item.detail}</div>
    </div>
  );
}

export const dynamic = "force-dynamic";

export default async function Home() {
  const neverLandingStats = await getNeverLandingStats();
  const currentYear = new Date().getFullYear();
  const githubGrid = await fetchGithubContributionGrid("shokace", currentYear);
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
                Software Engineer · Hardware Connoisseur
              </p>
            </div>
            <div className="flex flex-wrap gap-3 text-[0.7rem] uppercase tracking-[0.2em] text-faint">
              {links.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  className="rounded-sm border border-[color:var(--border2)] px-3 py-2 hover:border-[color:var(--border)]"
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
              <div className="grid gap-6 md:grid-cols-[1.2fr_1fr]">
                <div className="space-y-4">
                  <div className="text-[0.9rem] uppercase tracking-[0.2em] text-muted">
                    Earth visualization focused on current ISS position
                  </div>
                </div>
                <div className="flex items-center justify-center">
                  <div>
                    <Globe3D />
                  </div>
                </div>
              </div>
              <div className="mt-4">
                <IssTelemetry />
              </div>
            </Panel>

            <div className="grid gap-4 md:grid-cols-3">
              {kpis.map((kpi) => (
                <StatCard key={kpi.label} {...kpi} />
              ))}
            </div>

            <Panel title="Positions">
              <HUDTable rows={positions} />
            </Panel>
          </div>

          <div className="col-span-12 lg:col-span-3 flex flex-col gap-4">
            <Panel title="Operations">
              <div className="space-y-4">
                {opsItems.map((item) => (
                  <OpsListItem key={item.title} item={item} />
                ))}
              </div>
            </Panel>

            <Panel title="System Stats">
              <div className="space-y-3 text-[0.72rem] uppercase tracking-[0.2em] text-muted">
                <div className="flex items-center justify-between">
                  <span>API Requests</span>
                  <span className="text-[color:var(--text0)]">12.4k</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>LLM Cost</span>
                  <span className="text-[color:var(--accent-red)]">$42.18</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Memory</span>
                  <span className="text-[color:var(--text0)]">72%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Alerts</span>
                  <span className="text-[color:var(--accent-red)]">3</span>
                </div>
              </div>
            </Panel>

            <Panel title="Announcements">
              <div className="space-y-3 text-[0.72rem] uppercase leading-6 tracking-[0.2em] text-muted">
                <p>Portfolio rebalanced to reduce beta exposure.</p>
                <p>Latency optimization sprint scheduled.</p>
                <p>New automation pass for reporting stack.</p>
              </div>
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
