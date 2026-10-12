---
name: run-value-analysis
description: "Measures what happened in baseball in runs and win probability: RE24 run value per plate appearance, base-out state, runners in scoring position splits, win probability added and leverage-style context for MLB and college baseball. Use when the user asks about run value, RE24, run expectancy, clutch or RISP hitting, how much a home run mattered, or which plate appearances decided a game. Do not use for season rate stats: see player-scouting. Do not use for hit direction: see spray-chart-analysis. Do not use for pitcher arsenals: see pitch-mix-analysis."
metadata:
  version: 1.0.0
  author: FastballAPI
---

# Run Value Analysis

> **Default data tool:** FastballAPI (`fastballapi-tool`).
> `get_plate_appearances` (10 credits, up to 1,000 rows a call) has the base-out state, result, run value and win probability for every plate appearance. `get_player` (5) and `get_leaders` with `stat: "re24"` (5) give season RE24 totals.

You value outcomes by the runs and wins they add, not by the box-score label. A home run with the bases empty and two outs is worth exactly one run. A double with the bases loaded is worth far more than a double with the bases empty.

## When to Use

- "How much was that home run worth?"
- Player RE24 totals and per-PA values
- RISP (runners in scoring position) hitting, honestly framed
- Win probability swings in one game: which plate appearances decided it
- Comparing two hitters in run terms
- Building a context-neutral input for a model

## When NOT to Use

- Season rate stats (AVG, OBP, K%): `player-scouting`
- Hit direction and batted-ball type: `spray-chart-analysis`
- Pitch-type detail: `pitch-mix-analysis`
- Pricing a bet: `prop-modeling`, `edge-detection`

## Commands Available

| Command | What it does | Credits |
|---------|--------------|---------|
| `get_plate_appearances` | One row per plate appearance: `before` (outs, on_first, on_second, on_third), `result`, `batted_ball` (trajectory, x, y), `runs_scored`, `outs_after`, `score_after`, `home_win_prob` after, `run_value`. Filters: `game_id`, `batter_id`, `pitcher_id`, `team`, `season`, `season_type`, `result`, `inning`, `risp`, `limit` (max 1,000), `offset` | 10 |
| `get_player` | Season RE24 beside the rate stats | 5 |
| `get_leaders` | RE24 leaders (`stat: "re24"`), qualified | 5 |
| `get_game` | Win-probability range for one game | 5 |

## Commands That Do NOT Exist

| Not available | Use instead |
|---------------|-------------|
| `get_run_expectancy_table` | Not available as a call. Rebuild it from `get_plate_appearances` or use `run_value` directly |
| `get_leverage_index`, `get_wpa` | Not available. Compute WPA from consecutive `home_win_prob` as shown below |
| `get_war`, `get_wrc_plus` | Not available |
| `get_splits` | Filter `get_plate_appearances` (`risp`, `inning`, `result`) |
| `get_clutch_stats` | Not available. Build a RISP split and report the sample |

## What `run_value` Is

RE24 for a plate appearance:

```
run_value = runs_scored + RE(after) - RE(before)
```

where RE(state) is the average number of runs scored from that base-out state to the end of the inning, taken from each season's own run expectancy table (the API states it uses each season's own table). There are 24 states: 8 base configurations times 3 outs.

Real rows from two Judge home runs (2025):

```
Home run, bases empty, 2 outs, 1 run scored:   run_value 1.0
Home run, runner on first, 1 out, 2 runs:      run_value 1.749
```

The first is exactly 1 because the base-out state is the same before and after (bases empty, 2 outs) and one run scored. The second is above 2 minus the loss from clearing the runner: 2 runs plus RE(bases empty, 1 out) minus RE(runner on first, 1 out). The state before is more valuable than the state after, so the value lands under 2, near 1.75.

Rules this gives you: a walk with the bases empty is worth roughly the gain in expectation for adding a runner; an out with a runner on third and fewer than two outs is costly unless a run scores.

## How It Works

**Step 1: Pull the plate appearances.**

```json
POST /v1/get_plate_appearances
{"batter_id": "33192", "season": 2025, "result": "home-run", "limit": 2}
```

Real row shape (trimmed):

```json
{"game_id": "401697308", "inning": 1, "half": "bottom", "batting_team": "NYY",
 "batter": {"id": "33192", "name": "Aaron Judge"}, "pitcher": {"name": "Tomoyuki Sugano"},
 "before": {"outs": 2, "on_first": false, "on_second": false, "on_third": false},
 "result": "home-run", "description": "Judge homered to left center (383 feet).",
 "pitches": 2, "final_count": "0-1",
 "batted_ball": {"trajectory": "F", "x": 51, "y": 63},
 "runs_scored": 1, "outs_after": 2, "score_after": {"home": 1, "away": 0},
 "home_win_prob": 0.75, "run_value": 1}
```

`result` strings are lower-case hyphenated (`home-run`, `strikeout`, `walk`, `single`, `double`, `ground-out`). List the distinct values from a first page before filtering on one you have not seen.

**Step 2: Total and rate.** Sum `run_value` for a batter's season and divide by plate appearances. Judge's 2025 line from `get_player`: RE24 74.3 over 679 PA, about 0.109 runs per PA, about 65.7 runs per 600 PA. Compare per-PA values, not totals, between hitters with different playing time.

**Step 3: Break it down.** Group `run_value` by:

| Group | Why |
|-------|-----|
| `result` | Which outcomes carried the value (HR, BB, singles) |
| `before` base state | How much came from having runners on |
| `risp` filter | A hitter's value with runners in scoring position |
| `inning` | Late-inning value |
| `pitcher` team | Value against particular opponents |

**Step 4: RISP honestly.** Use `risp: true` to pull only plate appearances with a runner on second or third. Report the sample (PA count) and the rate stats next to RE24. RISP performance is mostly noise year to year: a hitter's RISP rate over one season has a wide interval, and the correlation between one year's RISP average and the next is weak. Report the RISP split, show how it compares to the same hitter's other PAs, and call a gap "clutch" only after several seasons of consistency, not one.

```python
risp = get_plate_appearances(batter_id=bid, season=2025, risp=True, limit=1000)["data"]["plate_appearances"]
allpa = get_plate_appearances(batter_id=bid, season=2025, limit=1000)["data"]["plate_appearances"]
risp_ids = {(p["game_id"], p["inning"], p["half"], p["description"]) for p in risp}
other = [p for p in allpa if (p["game_id"], p["inning"], p["half"], p["description"]) not in risp_ids]
```

Each call is 10 credits. Match rows on a stable key before splitting; the two calls return overlapping plate appearances. Check that both calls returned fewer rows than `limit`, or page with `offset`.

**Step 5: Win probability added.** `home_win_prob` is the home team's win probability after each plate appearance, available from 2019. Walk a game in order (`game_id`, ascending):

```python
prev = None
for pa in pas:                              # a whole game, in order
    wp = pa["home_win_prob"]
    if prev is not None and wp is not None:
        delta = wp - prev                   # home perspective
        wpa = delta if pa["half"] == "bottom" else -delta   # batter perspective
    prev = wp
```

The home team bats in the bottom half, so a rise in home win probability is good for the batter in the bottom and bad for the batter in the top. The first plate appearance has no previous value; the API does not give a pre-game win probability, so skip it or take the pre-game line from `get_odds`. Win probability is ESPN's model, not ours. Large swings in the 8th and 9th innings are normal, not noise.

**Step 6: Decide what to say.** Run value rewards both skill and opportunity. A leadoff hitter with the same ability gets fewer runners on than a number-four hitter. For skill, use rate stats and discipline; for what happened, use RE24. Say which you are reporting.

## College Baseball

`league: "ncaabase"` works for `get_plate_appearances`, but only part of each season's games have play-by-play (about 800 to 1,550 a season since 2021; 324 in 2020). On 94% or more of the games that have it since 2023, the play-by-play adds up to the final score. Do not compute a player's season RE24 from it and call it complete.

## Sample Size

| Statement | Needs |
|-----------|-------|
| "Hitter's RE24 per PA is X" | 300+ PA to be a rough read |
| "RISP split differs" | Several hundred RISP PAs, several seasons |
| "One PA decided the game" | A single game's WPA is descriptive, not predictive |
| "Team RE24 by lineup slot" | A full season of PAs |

## Credit Usage

| Operation | Credits |
|-----------|---------|
| One game of play-by-play (about 76 PAs) | 10 |
| A batter's season (about 650 PAs, one page of 1,000) | 10 |
| RISP-only filter for one batter-season | 10 |
| Season RE24 totals via `get_player` | 5 |

## Anti-patterns

| Mistake | Why it is wrong | Do This |
|---------|-----------------|---------|
| Calling a hitter "clutch" off one season | RISP rates are noisy | Show sample, call it unproven |
| Comparing total RE24 across different playing time | Totals reward volume | Use per-PA or per-600 |
| Treating RE24 as a skill stat | It includes opportunity and context | Pair with rate stats |
| Using pre-2019 win probability | Not in the data | Say it begins in 2019 |
| Reusing last year's run expectancy for this year's values | The API uses each season's own table | Do not rebuild unless needed |
| Summing `run_value` and calling it WAR | WAR needs position, defense, replacement | Call it RE24 |

## Output Format

```
Aaron Judge, 2025 (regular season)
679 PA, RE24 74.3 (0.109 per PA, 65.7 per 600)
Home runs: 53; value 1.0 (solo, 2 outs) to 1.75 (runner on first, 1 out) each in the two examples pulled
RISP: [N] PA, [rate stats]; compare to non-RISP before saying anything.
Read: run value follows his on-base and slugging; the RISP split is not a separate skill claim.
```

## What to Do Next

| You found | Next | Skill |
|-----------|------|-------|
| A hitter with high RE24 | Season rate profile | `player-scouting` |
| A power profile | Batted-ball direction | `spray-chart-analysis` |
| A game-deciding at-bat | The pitches that made it | `pitch-mix-analysis` |
| A team RE24 gap | Luck vs scoring | `pythagorean-record` |
