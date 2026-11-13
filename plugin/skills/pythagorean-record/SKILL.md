---
name: pythagorean-record
description: "Computes Pythagorean and Pythagenpat expected records from runs scored and allowed, measures how far a team's actual record is from it (luck), and projects regression for MLB and college baseball. Use when the user asks about Pythagorean record, expected wins, run differential, who got lucky or unlucky, one-run-game luck, or whether a team is as good as its record. Do not use for general standings and rankings: see team-analysis. Do not use for single-game prediction: see game-preview. Do not use to validate a model: see walk-forward-validation."
metadata:
  version: 1.0.0
  author: FastballAPI
---

# Pythagorean Record

> **Default data tool:** FastballAPI (`fastballapi-tool`).
> `get_standings` (2 credits) already returns `runs_scored`, `runs_allowed`, `run_differential` and `pythagorean_win_pct` for every team. `get_team_stats` (5) adds the process behind the runs.

You separate what a team did from what its scoring says it should have done. The gap is mostly luck in one-run games and sequencing, and it regresses.

## When to Use

- "Who was lucky in 2025?"
- "Is Toronto really a 94-win team?"
- "What does run differential say about the Brewers?"
- Expected wins at midseason, and what to expect the rest of the way
- Fitting a Pythagorean exponent for college baseball or another run environment

## When NOT to Use

- Standings, rankings, form: `team-analysis`
- A single game's price: `game-preview`, `odds-explorer`
- Testing a prediction model: `walk-forward-validation`

## Commands Available

| Command | What it does | Credits |
|---------|--------------|---------|
| `get_standings` | W-L, home/away, last 10, `runs_scored`, `runs_allowed`, `run_differential`, `win_pct`, `pythagorean_win_pct` | 2 |
| `get_team_stats` | Runs per game for and against, team batting and opponents' batting | 5 |
| `get_games` | Final scores for one-run-game splits | 2 |
| `get_ratings` | Elo, a cross-check that accounts for opponent strength | 2 |

All accept `league` (`mlb`, `ncaabase`) and `season`.

## Commands That Do NOT Exist

| Not available | Use instead |
|---------------|-------------|
| `get_expected_record`, `get_pythag` | Read `pythagorean_win_pct` from `get_standings`, or compute below |
| `get_base_runs`, `get_xwins` | Not available. Compute BaseRuns yourself from `get_team_stats` if needed |
| `get_one_run_record` | `get_games` for the team, then count games decided by one run |
| `get_clutch` | Not available. See `run-value-analysis` for RISP splits |

## The Formulas

**Classic Pythagorean** (James): expected win pct = RS^x / (RS^x + RA^x).

**Exponent.** The classic value is 2. A better fit for modern MLB is about 1.83. FastballAPI's own `pythagorean_win_pct` matches 1.83: checked against four 2025 teams (MIL .608, NYY .597, TOR .546, PHI .583), the exponent 1.83 reproduces the API value to three decimals each time, and the exponent 2 does not. Use 1.83 for MLB unless you fit your own.

**Pythagenpat** (Smyth/Patriot): exponent x = ((RS + RA) / G)^0.287, so the exponent rises with run environment. For 2025 MIL, x = 1.87 and the result is within a fraction of a win of the 1.83 version. It matters more for college and other high-scoring environments.

```python
def pythag(rs, ra, exp=1.83):
    return rs**exp / (rs**exp + ra**exp)

def pythagenpat(rs, ra, g):
    x = ((rs + ra) / g) ** 0.287
    return rs**x / (rs**x + ra**x)
```

**Rule of thumb:** about 10 runs of differential is about 1 win in MLB. Check it against your own data rather than quoting it blindly.

## How It Works

**Step 1: Pull standings.** `get_standings` with `season`.

```json
POST /v1/get_standings
{"season": 2025}
```

Real rows (2025, trimmed):

```json
{"data": {"season": 2025, "standings": [
 {"abbrev": "MIL", "wins": 97, "losses": 65, "runs_scored": 806, "runs_allowed": 634, "run_differential": 172, "win_pct": 0.599, "pythagorean_win_pct": 0.608},
 {"abbrev": "TOR", "wins": 94, "losses": 68, "runs_scored": 798, "runs_allowed": 721, "run_differential": 77,  "win_pct": 0.58,  "pythagorean_win_pct": 0.546},
 {"abbrev": "NYY", "wins": 94, "losses": 68, "runs_scored": 849, "runs_allowed": 685, "run_differential": 164, "win_pct": 0.58,  "pythagorean_win_pct": 0.597}]}}
```

**Step 2: Expected wins and luck.**

| Team | Wins | Expected (G x Pythag) | Luck (wins minus expected) |
|------|------|------------------------|----------------------------|
| TOR | 94 | 88.5 | +5.5 |
| PHI | 96 | 94.4 | +1.6 |
| MIL | 97 | 98.5 | -1.5 |
| NYY | 94 | 96.7 | -2.7 |

Toronto and New York finished with the same 94-68 record on very different scoring: +77 vs +164. A team that outperforms its run differential by 5 wins is a candidate for regression, with caveats below. Sort the whole league by `luck` to find the outliers.

```python
rows = get_standings(season=2025)["data"]["standings"]
for r in rows:
    g = r["wins"] + r["losses"]
    r["expected_wins"] = g * r["pythagorean_win_pct"]
    r["luck"] = r["wins"] - r["expected_wins"]
rows.sort(key=lambda r: r["luck"])
```

**Step 3: Explain the gap before predicting regression.** Over-performance of Pythagorean is not all luck. Ranked by how much of it is repeatable:

| Source of gap | Repeatable? |
|---------------|-------------|
| One-run-game record | Mostly luck (hold near .500 across teams) |
| Sequencing: hits clustered with runners on | Mostly luck |
| Elite closer plus bullpen used to win close games | Partly skill |
| Blowout wins and losses (runs wasted) | Neutral on average |
| Mid-season trades changing talent | Not luck; a timing issue (use rolling windows) |

Check the one-run record with `get_games`: count finals where the absolute run difference is 1 and split by wins. A team that went 30-15 in one-run games has a story; a team at 22-23 does not.

**Step 4: Regression.** Do not publish a forecast from rules of thumb alone. Test it:

1. Take `win_pct` and `pythagorean_win_pct` for season N and the actual `win_pct` for season N+1, for every team in 10 or more seasons (`get_standings`, 2 credits per season).
2. Fit next-year win pct on both predictors, with teams as the unit.
3. If `pythagorean_win_pct` carries more weight than `win_pct`, run differential is the better predictor and the luck term does regress. Report the coefficients and the sample size. This is a walk-forward question: fit on seasons up to N-1, test on N. See `walk-forward-validation`.

Rosters change between seasons, so this test mixes luck regression with talent turnover. Do not call all of the gap "luck".

**Step 5: Fit an exponent for another environment** (college baseball, or another era):

```python
import numpy as np
x = np.log([r["runs_scored"] / r["runs_allowed"] for r in rows])
y = np.log([r["wins"] / max(r["losses"], 1) for r in rows])
exponent = (x @ y) / (x @ x)    # least squares through the origin
```

Use only teams with a meaningful number of games.

## College Baseball

`league: "ncaabase"`. The standings list every team we cover, in win-pct order, including teams with a few games. A 3-0 team with 31 runs for and 10 against has a Pythagorean of .888: meaningless at that sample. Filter on games played (for example at least 30) before sorting. we do not cover every Division I game, so runs and records can be partial. Fit the exponent on the filtered set, since college run environments are higher than MLB.

## Sample Size Reality

A 162-game record has a standard error near 6 wins from luck alone (sqrt(162 x 0.25) = 6.4). Pythagorean cuts the noise but not to zero. A one-win gap is nothing. A five-win gap in a full season is notable, not decisive. Before the All-Star break, 90 games means a standard error near 4.7 wins.

## Credit Usage

| Operation | Credits |
|-----------|---------|
| One season's league table | 2 |
| Ten seasons for a regression | 20 |
| One-run-game split for one team | 2 |
| Process stats for all teams | 5 |

## Anti-patterns

| Mistake | Why it is wrong | Do This |
|---------|-----------------|---------|
| Calling every gap "luck" | Bullpens and trades are real | Split by source |
| Using exponent 2 and comparing to the API | Values will differ by a few thousandths | Use 1.83 or state yours |
| Projecting a team's next win total as its Pythagorean | Rosters change | Fit and test, then say the error |
| Ranking college teams on a few games | Tiny samples | Filter on games |
| Using full-season Pythagorean for a playoff series | Playoff opponents, rotations differ | Use as context only |
| Ignoring postseason in run totals | Standings are regular-season; `get_games` mixes both | Filter `season_type` |

## Output Format

```
2025 regular season, luck vs run differential
Most over expected record: TOR 94-68 vs 88.5 expected (+5.5), RD +77
Most under: NYY 94-68 vs 96.7 expected (-2.7), RD +164
Exponent: 1.83 (matches pythagorean_win_pct)
Read: Toronto's record is ahead of its scoring; New York's is behind it.
Caveat: one season; luck is not a forecast until tested (see walk-forward-validation).
```

## What to Do Next

| You found | Next | Skill |
|-----------|------|-------|
| Large gap | Check Elo and process stats | `team-analysis` |
| Want to test regression | Temporal validation | `walk-forward-validation` |
| Gap explained by clutch hitting | RISP run value | `run-value-analysis` |
| Want to price a team's win total | Fair odds first | `odds-analysis` |
