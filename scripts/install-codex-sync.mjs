import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

if (process.platform !== "darwin") throw new Error("This installer requires macOS launchd.");
const root = fileURLToPath(new URL("../", import.meta.url));
const binary = process.env.CODEX_BIN || execFileSync("/usr/bin/which", ["codex"], { encoding: "utf8" }).trim();
const label = "dev.juric.codex-usage";
const plist = join(homedir(), "Library", "LaunchAgents", `${label}.plist`);
const logs = join(homedir(), "Library", "Logs", label);
const xml = (value) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
mkdirSync(dirname(plist), { recursive: true });
mkdirSync(logs, { recursive: true });
writeFileSync(plist, `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>Label</key><string>${label}</string>
<key>ProgramArguments</key><array><string>${xml(process.execPath)}</string><string>${xml(join(root, "scripts/sync-codex-usage.mjs"))}</string></array>
<key>WorkingDirectory</key><string>${xml(root)}</string>
<key>EnvironmentVariables</key><dict><key>CODEX_BIN</key><string>${xml(binary)}</string><key>PATH</key><string>${xml(`${dirname(binary)}:${dirname(process.execPath)}:/usr/bin:/bin:/usr/sbin:/sbin`)}</string></dict>
<key>RunAtLoad</key><true/>
<key>StartInterval</key><integer>900</integer>
<key>ProcessType</key><string>Background</string>
<key>StandardOutPath</key><string>${xml(join(logs, "sync.log"))}</string>
<key>StandardErrorPath</key><string>${xml(join(logs, "error.log"))}</string>
</dict></plist>\n`, { mode: 0o600 });
const domain = `gui/${process.getuid()}`;
try { execFileSync("launchctl", ["bootout", `${domain}/${label}`], { stdio: "ignore" }); } catch { /* First install. */ }
execFileSync("launchctl", ["bootstrap", domain, plist]);
console.log(`Installed ${label}: refresh every 15 minutes while logged in and awake. Logs: ${logs}`);
