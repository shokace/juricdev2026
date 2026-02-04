import { NextResponse } from "next/server";
import { fetchGithubContributionGrid } from "@/lib/github";

export const revalidate = 300;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const user = searchParams.get("user") ?? "shokace";
  const year = Number(searchParams.get("year") ?? new Date().getFullYear());

  try {
    const grid = await fetchGithubContributionGrid(user, year);
    return NextResponse.json(grid);
  } catch (error) {
    return NextResponse.json(
      {
        error: "GitHub request failed.",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 502 }
    );
  }
}
