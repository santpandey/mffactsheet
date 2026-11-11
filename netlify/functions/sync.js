// Netlify Function: proxies the site's "Sync Data" button to GitHub Actions.
// Required env var: GH_SYNC_TOKEN — fine-grained PAT with Actions:write on this repo.
// Optional env var:  SYNC_SECRET — if set, requests must pass ?key=<SYNC_SECRET>.
const REPO = "santpandey/mffactsheet";
const WORKFLOW = "sync-portfolios.yml";

const gh = async (path, method) => {
  const res = await fetch(`https://api.github.com/repos/${REPO}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${process.env.GH_SYNC_TOKEN}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "mffactsheet-sync",
    },
    ...(method === "POST" ? { body: JSON.stringify({ ref: "main" }) } : {}),
  });
  return res;
};

exports.handler = async (event) => {
  const secret = process.env.SYNC_SECRET;
  if (secret && event.queryStringParameters?.key !== secret) {
    return { statusCode: 403, body: JSON.stringify({ error: "forbidden" }) };
  }
  if (!process.env.GH_SYNC_TOKEN) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "GH_SYNC_TOKEN not configured" }),
    };
  }

  // GET ?status=1 → latest workflow run state (for the button to poll)
  if (event.queryStringParameters?.status) {
    const res = await gh(
      `/actions/workflows/${WORKFLOW}/runs?per_page=1`,
      "GET",
    );
    const data = await res.json();
    const run = data.workflow_runs?.[0];
    return {
      statusCode: res.ok ? 200 : res.status,
      body: JSON.stringify({
        status: run?.status || "unknown",
        conclusion: run?.conclusion || null,
        url: run?.html_url || null,
      }),
    };
  }

  // POST → trigger the workflow
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "use POST" }) };
  }

  // Abuse guard: refuse if a run is active or one started <10 min ago.
  // Bounds GitHub Actions usage regardless of how often the button is hit.
  const runs = await gh(
    `/actions/workflows/${WORKFLOW}/runs?per_page=1`,
    "GET",
  ).then((r) => r.json());
  const last = runs.workflow_runs?.[0];
  if (last) {
    if (["queued", "in_progress", "waiting", "pending"].includes(last.status)) {
      return {
        statusCode: 429,
        body: JSON.stringify({ error: "A sync is already running" }),
      };
    }
    const age = Date.now() - new Date(last.created_at).getTime();
    if (age < 10 * 60 * 1000) {
      const wait = Math.ceil((10 * 60 * 1000 - age) / 60000);
      return {
        statusCode: 429,
        body: JSON.stringify({
          error: `Synced recently — try again in ~${wait} min`,
        }),
      };
    }
  }

  const res = await gh(`/actions/workflows/${WORKFLOW}/dispatches`, "POST");
  return {
    statusCode: res.status === 204 ? 200 : res.status,
    body: JSON.stringify(
      res.status === 204
        ? { ok: true, message: "Sync triggered" }
        : { error: `GitHub returned ${res.status}` },
    ),
  };
};
