#!/usr/bin/env python3
"""MLB pitcher arsenal and strikeout props. Usage: python3 mlb_pitch_mix_and_props.py [pitcher name] [--season 2025] [--limit 15]. Costs 16 credits (search_players 1 + get_pitch_mix 5 + get_prop_history 10)."""
import json
import os
import sys
import urllib.error
import urllib.request
import argparse

BRAND = "FastballAPI"
KEY_ENV = "FASTBALLAPI_API_KEY"
BASE_URL = "https://mcp.fastballapi.com/v1"
SIGNUP_URL = "https://fastballapi.com/signup"
LAST_REMAINING = None


class ApiError(Exception):
    pass


def require_key():
    key = os.environ.get(KEY_ENV, "").strip()
    if not key:
        sys.exit(
            f"Set {KEY_ENV} first:\n"
            f"  export {KEY_ENV}=your_key\n"
            f"Get a free key (500 credits every month, no card): {SIGNUP_URL}"
        )
    return key


def call(key, tool, args=None):
    """POST /v1/<tool> with a JSON body and return the parsed response."""
    global LAST_REMAINING
    req = urllib.request.Request(
        f"{BASE_URL}/{tool}",
        data=json.dumps(args or {}).encode(),
        headers={
            "Content-Type": "application/json",
            "x-api-key": key,
            "User-Agent": "fastballapi.com-examples/1.0",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            LAST_REMAINING = resp.headers.get("X-Credits-Remaining", LAST_REMAINING)
            body = json.load(resp)
            # Every response is wrapped as {"data": ...}.
            return body.get("data", body) if isinstance(body, dict) else body
    except urllib.error.HTTPError as err:
        raise ApiError(describe(err, tool)) from None
    except urllib.error.URLError as err:
        raise ApiError(f"Network error calling {tool}: {err.reason}") from None


def describe(err, tool):
    try:
        body = json.loads(err.read().decode() or "{}")
    except ValueError:
        body = {}
    message = body.get("message") or body.get("error") or err.reason
    if err.code == 401:
        return f"401 unauthorized. Check {KEY_ENV}. {message}"
    if err.code == 402:
        upgrade = body.get("upgrade_url") or SIGNUP_URL
        return f"402 out of credits. {message} Upgrade or wait for the monthly reset: {upgrade}"
    return f"HTTP {err.code} from {tool}: {message}"


def fmt(value, digits=None):
    if value is None:
        return "-"
    if digits is not None and isinstance(value, (int, float)):
        return f"{value:.{digits}f}"
    return str(value)


def pct(value, digits=1):
    return "-" if value is None else f"{value * 100:.{digits}f}%"


def table(headers, rows):
    rows = [["-" if c is None else str(c) for c in r] for r in rows]
    widths = [max([len(h)] + [len(r[i]) for r in rows]) for i, h in enumerate(headers)]
    line = lambda cells: "  ".join(c.ljust(w) for c, w in zip(cells, widths)).rstrip()
    print(line(headers))
    print("  ".join("-" * w for w in widths))
    for r in rows:
        print(line(r))


def finish():
    if LAST_REMAINING is not None:
        print(f"\nCredits remaining: {LAST_REMAINING}")

def main():
    ap = argparse.ArgumentParser(description="Pitch mix and strikeout prop history for one pitcher.")
    ap.add_argument("name", nargs="?", default="Taijuan Walker", help="pitcher name (default: Taijuan Walker)")
    ap.add_argument("--season", type=int, default=2025)
    ap.add_argument("--limit", type=int, default=15, help="games of prop history")
    args = ap.parse_args()
    key = require_key()

    found = call(key, "search_players", {"name": args.name, "limit": 1}).get("players") or []
    if not found:
        sys.exit(f"No player found for {args.name!r}.")
    player = found[0]
    print(f"{player['name']} ({player.get('team')}, {player.get('position')}), player_id {player['player_id']}")

    mix = call(key, "get_pitch_mix", {"pitcher_id": player["player_id"], "season": args.season})
    print(f"\nPitch mix, {args.season}: {mix.get('pitches')} pitches tracked")
    table(
        ["Pitch", "Count", "Usage", "Avg mph", "Max mph", "Whiff", "Ball"],
        [[p.get("name"), p.get("pitches"), pct(p.get("usage")), fmt(p.get("avg_velocity"), 1),
          fmt(p.get("max_velocity")), pct(p.get("whiff_rate")), pct(p.get("ball_rate"))]
         for p in mix.get("mix") or []],
    )

    hist = call(key, "get_prop_history", {
        "player_id": player["player_id"],
        "market": "pitcher_strikeouts",
        "from_date": f"{args.season}-01-01",
        "to_date": f"{args.season}-12-31",
        "limit": args.limit,
    })
    games = hist.get("games") or []
    print(f"\nStrikeout prop lines vs results, {args.season}")
    if games:
        table(
            ["Date", "Line", "Over", "Under", "Strikeouts", "Result"],
            [[g.get("game_date"), fmt(g.get("line")), fmt(g.get("over_odds")), fmt(g.get("under_odds")),
              fmt(g.get("actual")), g.get("result")] for g in games],
        )
        s = hist.get("summary") or {}
        print(f"\nOver rate {pct(s.get('over_rate'))} over {s.get('graded')} graded games "
              f"(average line {fmt(s.get('avg_line'), 1)}, average actual {fmt(s.get('avg_actual'), 1)}).")
    else:
        print("No strikeout prop lines found for this pitcher and season.")
    finish()


if __name__ == "__main__":
    try:
        main()
    except ApiError as err:
        sys.exit(f"Error: {err}")
