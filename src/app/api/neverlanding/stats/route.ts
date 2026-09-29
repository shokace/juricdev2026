import { NextResponse } from "next/server";
import { fetchNeverLandingStats } from "@/lib/neverlanding";

export const dynamic = "force-dynamic";
export const runtime = "edge";

export async function GET() {
  try {
    return NextResponse.json(await fetchNeverLandingStats(), {
      headers: { "Cache-Control": "public, max-age=0, s-maxage=60" },
    });
  } catch {
    return NextResponse.json({ error: "Traffic data is temporarily unavailable." }, {
      status: 502,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
