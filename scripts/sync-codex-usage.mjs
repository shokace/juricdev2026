import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { CODEX_USAGE_KEY, snapshotFromSummary } from "../src/lib/codex-usage.mjs";

// Only the installed Codex process reads credentials. No sessions or prompts are read.
export async function readAccountUsage(binary = process.env.CODEX_BIN || "codex") {
  const child = spawn(binary, ["app-server", "--stdio"], { stdio: ["pipe", "pipe", "ignore"] });
  const lines = createInterface({ input: child.stdout });
  const pending = new Map();
  let id = 0;
  const fail = () => {
    for (const { reject } of pending.values()) reject(new Error("Codex app server stopped. Check your Codex login."));
    pending.clear();
  };
  child.on("error", fail);
  child.on("exit", fail);
  child.stdin.on("error", fail);
  lines.on("line", (line) => {
    let message;
    try { message = JSON.parse(line); } catch { return; }
    const request = pending.get(message.id);
    if (!request) return;
    pending.delete(message.id);
    if (message.error) request.reject(new Error("Codex usage request failed. Check your Codex login and CLI version."));
    else request.resolve(message.result);
  });
  const request = (method, params) => new Promise((resolve, reject) => {
    const requestId = ++id;
    pending.set(requestId, { resolve, reject });
    child.stdin.write(JSON.stringify({ id: requestId, method, params }) + "\n");
  });
  const timeout = setTimeout(() => { fail(); child.kill(); }, 30_000);
  try {
    await request("initialize", {
      clientInfo: { name: "juric_usage_sync", version: "1.0.0" },
      capabilities: { experimentalApi: true },
    });
    child.stdin.write('{"method":"initialized"}\n');
    const result = await request("account/usage/read", {});
    return snapshotFromSummary(result.summary);
  } finally {
    clearTimeout(timeout);
    lines.close();
    child.stdin.end();
    child.kill();
  }
}

async function main() {
  // Node 20.12+; existing environment takes precedence over the local env file.
  try { process.loadEnvFile(fileURLToPath(new URL("../.env.local", import.meta.url))); }
  catch (error) { if (error.code !== "ENOENT") throw error; }
  const snapshot = await readAccountUsage();
  if (process.argv.includes("--dry-run")) {
    console.log(JSON.stringify(snapshot, null, 2));
    return;
  }
  const token = process.env.KVTok ?? process.env.CLOUDFLARE_KV_API_TOKEN ?? process.env.CLOUDFLARE_API_TOKEN;
  const account = process.env.CLOUDFLARE_ACCOUNT_ID;
  const namespace = process.env.CLOUDFLARE_KV_NAMESPACE_ID_CODEX ?? process.env.CLOUDFLARE_KV_NAMESPACE_ID_ISS;
  if (!token || !account || !namespace) throw new Error("Missing Cloudflare KV configuration.");
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${account}/storage/kv/namespaces/${namespace}/values/${encodeURIComponent(CODEX_USAGE_KEY)}`,
    {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(snapshot),
      signal: AbortSignal.timeout(15000),
    },
  );
  if (!response.ok || !(await response.json()).success) {
    throw new Error(`Cloudflare KV sync failed (HTTP ${response.status}).`);
  }
  console.log(`${new Date().toISOString()} Synced Codex usage: ${snapshot.total_tokens} lifetime tokens.`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
