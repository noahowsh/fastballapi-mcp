---
name: player-scouting
description: "Scouts MLB and college baseball players: finds a player id, pulls season-by-season batting (AVG, OBP, SLG, OPS, K%, BB%, RE24) and pitching (ERA, WHIP, K/9, BB/9) lines, game logs, season leaders and injury status, and compares players fairly. Use when the user asks about a named player, wants two players compared, asks who leads the league in a stat, or asks if a player is hurt. Do not use for a pitcher's arsenal detail: see pitch-mix-analysis. Do not use for where a hitter hits the ball: see spray-chart-analysis. Do not use for prop pricing: see prop-modeling."
metadata:
  version: 1.0.0
  author: FastballAPI
---

# Player Scouting

> **Default data tool:** FastballAPI (`fastballapi-tool`).
> `search_players` (1 credit) always comes first. Then `get_player` (5), `get_player_games` (5), `get_leaders` (5), `get_injuries` (2).

You build an honest picture of a player from rate stats, sample size and role. A hot month is not a skill change; a .380 BABIP is not a breakout.

## When to Use

- "How good is Aaron Judge?" or "How has he trended since 2022?"
- Comparing two hitters or two pitchers
- "Who leads MLB in OPS / K/9 / RE24?"
- A player's recent game log
- Is a player injured, and when is the expected return?
- Building a player list that a model or prop will use

## When NOT to Use

- Pitch types, velocity, whiff rate: `pitch-mix-analysis`
- Hit direction and batted-ball profile: `spray-chart-analysis`
- Run value per plate appearance and RISP splits: `run-value-analysis`
- Pricing a player's over/under: `prop-modeling`

## Commands Available

| Command | What it does | Credits |
|---------|--------------|---------|
| `search_players` | Player id by `name` (partial ok), `limit` 1 to 50 | 1 |
| `get_player` | Every season: batting (PA, AB, H, doubles, triples, HR, BB, SO, HBP, SF, RE24, AVG, OBP, SLG, OPS, K%, BB%) and pitching (G, GS, IP, ERA, WHIP, K/9, BB/9, HR/9) | 5 |
| `get_player_games` | Game log: each game's batting and pitching line, newest first; `season`, `season_type`, `limit` up to 200 | 5 |
| `get_leaders` | Qualified leaders. `stat` one of avg, obp, slg, ops, hr, re24, bb_pct, k_pct, era, whip, so, k_per_9, bb_per_9; `min_pa`, `min_ip`, `limit` up to 100 | 5 |
| `get_injuries` | Status, injury type, expected return for listed players; filter by `team` (MLB only) | 2 |

## Commands That Do NOT Exist

| Not available | Use instead |
|---------------|-------------|
| `get_war`, `get_fwar` | Not available. Use RE24 from `get_player` or `get_leaders` with `stat: "re24"` |
| `get_statcast`, `get_barrel_rate`, `get_exit_velocity` | Not available. No launch data. Use `get_spray_chart` trajectories |
| `get_contract`, `get_salary` | Not available |
| `get_minor_league_stats` | Not available |
| `get_splits` (vs LHP, day/night) | Not available as a call. Pull `get_plate_appearances` for the batter and group in code |
| `get_defense`, `get_oaa` | Not available |

## How It Works

**Step 1: Resolve the id.** `search_players` with `name`. Real response:

```json
{"data": {"players": [{"player_id": "33192", "name": "Aaron Judge", "position": "RF", "bats": "R", "team": "NYY"}], "count": 1}}
```

If several players match (a search for "Cole" returns Cole Hamels, Gerrit Cole, Cole Gillespie), confirm which one, by team and position, before spending 5 credits on stats. Ids are strings.

**Step 2: Season lines.** `get_player` returns `batting` and `pitching` arrays, one object per season, current season first. Real row (Judge, 2025): 679 PA, 53 HR, .331/.457/.688, OPS 1.144, K% .236, BB% .183, RE24 74.3. Real pitching row (Skubal, 2025): 195.1 IP, 2.21 ERA, 0.89 WHIP, 11.1 K/9, 1.5 BB/9. The current in-progress season is included: check `pa` or `ip` before comparing it to full years.

**Step 3: Qualify the sample.** Use these floors before saying anything is "real":

| Stat | Stabilizes roughly at | Rule |
|------|----------------------|------|
| K% (batter) | 60 PA | Trust early |
| BB% (batter) | 120 PA | Trust early-ish |
| HR rate | 170 PA | Needs a half season |
| OBP, SLG | 460 PA, 320 PA | A full season barely stabilizes them |
| BABIP, AVG | 800+ PA | Treat as noise within a season |
| K/9 (pitcher) | 70 BF | Trust early |
| ERA | Never within a season | Use K/9, BB/9, HR/9 for talent, ERA for outcome |

These are widely used approximations from public research, not API outputs. State them as rules of thumb.

**Step 4: Compare fairly.** Two hitters from different seasons: compare rate stats and RE24 per PA, not counting totals. Run `get_leaders` with the same `stat` and `season` to see where each ranks; the `qualifier` field tells you the threshold used (for pitchers, 1 inning per team game: `"162 innings"` in a full season).

```json
POST /v1/get_leaders
{"stat": "k_per_9", "season": 2025, "limit": 3}
```

Real top three: Dylan Cease 11.5 K/9 (215 SO, 168.0 IP), Garrett Crochet 11.2, Tarik Skubal 11.1.

**Step 5: Recent form.** `get_player_games` with `season` and `limit`. Roll 15 to 20 games at most for context. Report the rolling line next to the season line and say how little a 15-game window tells you.

**Step 6: Availability.** `get_injuries` with `team`. Each entry has `status` (10-Day-IL, 15-Day-IL, 60-Day-IL), `type`, `detail`, `return_date`. A `return_date` is the club's estimate, not a promise. Report it that way.

## Hitter Scouting Checklist

1. K% and BB% (plate discipline, stabilizes fast)
2. ISO = SLG minus AVG (power), from `get_player`
3. OPS and RE24 per 600 PA (production)
4. HR per fly ball, from `get_spray_chart` (is the power real?)
5. Age/role change: new team, new lineup slot (visible in `get_player_games` `batting_order`)

## Pitcher Scouting Checklist

1. K/9 minus BB/9 (command)
2. HR/9 (a volatile stat; park and fly-ball rate)
3. IP per start = `ip` divided by `gs` (workload matters for prop work)
4. Arsenal and whiff by pitch: `pitch-mix-analysis`
5. ERA vs the three above (gap = luck or sequencing)

## College Baseball

`league: "ncaabase"` works for `search_players`, `get_player`, `get_player_games`, `get_leaders`. Box scores exist for only part of each season, so a college player's line can cover fewer games than he played. Say so. No injuries, no pitch data.

## Credit Usage

| Operation | Credits |
|-----------|---------|
| One player, season lines | 1 + 5 = 6 |
| Two-player comparison | 2 + 10 = 12 |
| Game log | +5 |
| Leaders table | 5 |
| Injury list for a team | 2 |

## Anti-patterns

| Mistake | Why it is wrong | Do This |
|---------|-----------------|---------|
| Comparing a partial current season to full years | Different sample | Show PA/IP beside every line |
| Calling a 20-game hot streak a change | Noise at that n | Report the interval, wait for sample |
| Ranking by ERA | Mostly defense, luck and sequencing | Add K/9, BB/9, HR/9 |
| Treating RE24 as a skill stat | It is context-dependent counting | Pair with a rate stat |
| Trusting `return_date` | It is an estimate | Say "club estimate" |

## Output Format

```
Aaron Judge (RF, NYY), id 33192
2025: 679 PA, .331/.457/.688, 53 HR, K% 23.6, BB% 18.3, RE24 74.3
2024: 704 PA, .322/.458/.701, 58 HR, RE24 98.7
Trend: same profile both years (walks above 18%, strikeouts near 24%); RE24 gap is mostly 25 fewer PA and 5 fewer HR.
Sample note: full seasons both years. Current season partial (285 PA at last pull).
Injury report (2026-10-11): 10-Day-IL, calf strain, club estimate Oct 12.
```

## What to Do Next

| You found | Next | Skill |
|-----------|------|-------|
| A pitcher worth a closer look | Arsenal and whiff by pitch | `pitch-mix-analysis` |
| A hitter with unusual power | Batted-ball profile | `spray-chart-analysis` |
| A player with a prop line | Model the number | `prop-modeling` |
| Context-heavy production | Run value splits | `run-value-analysis` |
