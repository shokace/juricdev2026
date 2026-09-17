import { NextResponse } from "next/server";
import { CODEX_USAGE_KEY, normalizeCodexUsage } from "@/lib/codex-usage.mjs";

export const runtime = "edge";
export const dynamic = "force-dynamic";

export async function GET() {
  const token = process.env.KVTok ?? process.env.CLOUDFLARE_KV_API_TOKEN ?? process.env.CLOUDFLARE_API_TOKEN;
  const account = process.env.CLOUDFLARE_ACCOUNT_ID;
  const namespace = process.env.CLOUDFLARE_KV_NAMESPACE_ID_CODEX ?? process.env.CLOUDFLARE_KV_NAMESPACE_ID_ISS;
  if (!token || !account || !namespace) {
    return NextResponse.json({ error: "Codex usage is not configured." }, { status: 503 });
  }

  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${account}/storage/kv/namespaces/${namespace}/values/${encodeURIComponent(CODEX_USAGE_KEY)}`,
      { headers: { Authorization: `Bearer ${token}` }, cache: "no-store", signal: AbortSignal.timeout(8000) },
    );
    if (!response.ok) throw new Error("Usage snapshot unavailable.");
    const snapshot = normalizeCodexUsage(await response.json());
    return NextResponse.json(snapshot, {
      headers: { "Cache-Control": "public, max-age=60, s-maxage=60" },
    });
  } catch {
    return NextResponse.json({ error: "Codex usage is temporarily unavailable." }, { status: 503 });
  }
}
