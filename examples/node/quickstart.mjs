#!/usr/bin/env node
// FastballAPI quickstart: upcoming MLB games with lines, then OPS leaders. Node 18+, no dependencies. Needs FASTBALLAPI_API_KEY. Costs about 7 credits.
const BRAND = "FastballAPI";
const KEY_ENV = "FASTBALLAPI_API_KEY";
const BASE_URL = "https://mcp.fastballapi.com/v1";
const SIGNUP_URL = "https://fastballapi.com/signup";

const key = (process.env[KEY_ENV] || "").trim();
if (!key) {
  console.error(
    `Set ${KEY_ENV} first:\n  export ${KEY_ENV}=your_key\n` +
      `Get a free key (500 credits every month, no card): ${SIGNUP_URL}`,
  );
  process.exit(1);
}

let remaining = null;

async function call(tool, args = {}) {
  let res;
  try {
    res = await fetch(`${BASE_URL}/${tool}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": key },
      body: JSON.stringify(args),
    });
  } catch (err) {
    throw new Error(`Network error calling ${tool}: ${err.cause?.code ?? err.message}`);
  }
  remaining = res.headers.get("x-credits-remaining") ?? remaining;
  const text = await res.text();
  let body = {};
  try {
    body = JSON.parse(text);
  } catch {}
  if (res.ok) return body;
  const message = body.message || body.error || res.statusText;
  if (res.status === 401) throw new Error(`401 unauthorized. Check ${KEY_ENV}. ${message}`);
  if (res.status === 402) {
    throw new Error(
      `402 out of credits. ${message} Upgrade or wait for the monthly reset: ${body.upgrade_url || SIGNUP_URL}`,
    );
  }
  throw new Error(`HTTP ${res.status} from ${tool}: ${message}`);
}

const fmt = (v, digits) => (v == null ? "-" : digits != null && typeof v === "number" ? v.toFixed(digits) : String(v));
const pct = (v, digits = 1) => (v == null ? "-" : `${(v * 100).toFixed(digits)}%`);

function table(headers, rows) {
  const cells = rows.map((r) => r.map((c) => (c == null ? "-" : String(c))));
  const widths = headers.map((h, i) => Math.max(h.length, ...cells.map((r) => r[i].length)));
  const line = (r) => r.map((c, i) => c.padEnd(widths[i])).join("  ").trimEnd();
  console.log(line(headers));
  console.log(widths.map((w) => "-".repeat(w)).join("  "));
  cells.forEach((r) => console.log(line(r)));
}

function finish() {
  if (remaining !== null) console.log(`\nCredits remaining: ${remaining}`);
}

async function main() {
  const sched = await call("get_schedule", { days: 3 });
  const games = sched.games ?? [];
  console.log("Upcoming MLB games (get_schedule, 2 credits)");
  if (games.length) {
    table(
      ["Date", "Game", "Status", "Away ML", "Home ML", "Total"],
      games.slice(0, 8).map((g) => [
        g.date,
        `${g.away.abbrev} @ ${g.home.abbrev}`,
        g.status,
        fmt(g.line?.away_ml),
        fmt(g.line?.home_ml),
        fmt(g.line?.total),
      ]),
    );
  } else {
    console.log("No games in the next 3 days.");
  }

  const leaders = await call("get_leaders", { stat: "ops", season: 2025, limit: 5 });
  console.log("\nOPS leaders, 2025 (get_leaders, 5 credits)");
  table(
    ["#", "Player", "Team", "PA", "AVG", "OPS", "HR"],
    (leaders.leaders ?? []).map((p, i) => [i + 1, p.name, p.team, p.pa, fmt(p.avg, 3), fmt(p.ops, 3), p.hr]),
  );
  finish();
}

main().catch((err) => {
  console.error(`Error: ${err.message}`);
  process.exit(1);
});
