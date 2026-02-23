export interface Env {
  ISS_REFRESH_URL: string;
}

async function pingIssRefresh(url: string): Promise<Response> {
  return fetch(url, {
    method: "GET",
    headers: {
      "User-Agent": "juricdev2026-iss-cron/1.0",
      "Cache-Control": "no-store",
    },
  });
}

export default {
  async scheduled(_controller: unknown, env: Env, ctx: { waitUntil: (promise: Promise<Response>) => void }) {
    ctx.waitUntil(pingIssRefresh(env.ISS_REFRESH_URL));
  },

  async fetch(_request: Request, env: Env): Promise<Response> {
    const response = await pingIssRefresh(env.ISS_REFRESH_URL);
    const text = await response.text();

    return new Response(text, {
      status: response.status,
      headers: {
        "Content-Type": response.headers.get("Content-Type") ?? "application/json",
        "Cache-Control": "no-store",
      },
    });
  },
};
