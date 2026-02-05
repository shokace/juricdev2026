import { NextResponse } from "next/server";
import { fetchNeverLandingStats, isCloudflareError } from "@/lib/neverlanding";

export const revalidate = 300;
export const runtime = "edge";

export async function GET() {
  try {
    const stats = await fetchNeverLandingStats();
    return NextResponse.json(stats);
  } catch (error) {
    if (isCloudflareError(error)) {
      return NextResponse.json(
        {
          error: "Cloudflare GraphQL error.",
          details: error.details,
        },
        { status: 502 }
      );
    }

    return NextResponse.json(
      {
        error: "Cloudflare request failed.",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 502 }
    );
  }
}
