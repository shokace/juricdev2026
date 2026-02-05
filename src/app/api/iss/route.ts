import { NextResponse } from "next/server";

export const runtime = "edge";

type IssResponse = {
  message: string;
  timestamp: number;
  iss_position: {
    latitude: string;
    longitude: string;
  };
};

export const revalidate = 0;

export async function GET() {
  const response = await fetch("http://api.open-notify.org/iss-now.json", {
    cache: "no-store",
  });

  if (!response.ok) {
    return NextResponse.json(
      { error: "Failed to fetch ISS position." },
      { status: 502 }
    );
  }

  const payload = (await response.json()) as IssResponse;
  if (payload.message !== "success") {
    return NextResponse.json(
      { error: "ISS API returned an error." },
      { status: 502 }
    );
  }

  return NextResponse.json(payload);
}
