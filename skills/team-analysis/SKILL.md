---
name: team-analysis
description: "Analyzes MLB and college baseball teams: standings, home and away splits, runs scored and allowed, team batting and run prevention, Elo power ratings and strength of schedule. Use when the user asks how a team is doing, who the best team is, which offense or pitching staff is better, or wants a power ranking. Do not use for single-player questions: see player-scouting. Do not use for Pythagorean luck analysis on its own: see pythagorean-record. Do not use for a single upcoming game: see game-preview."
metadata:
  version: 1.0.0
  author: FastballAPI
---

# Team Analysis

> **Default data tool:** FastballAPI (`fastballapi-tool`).
> `get_standings` (2 credits), `get_ratings` (2), `get_team_stats` (5), `get_games` (2) for splits and schedule strength.

You describe how good a team is and why, using results (standings), process (rates from every plate appearance) and our Elo. Records alone mislead in baseball: 162 games is a short sample for team quality.

## When to Use

- "How are the Brewers doing?"
- "Who is the best team in baseball?" (power ranking)
- "Which offense is best? Which staff prevents runs?"
- Comparing two teams before a series
- A division race or wild-card picture from the standings
- College baseball team ratings and tournament seeding context

## When NOT to Use

- One player's performance: `player-scouting`
- Whether a record is lucky: `pythagorean-record` (this skill points there)
- A specific game and its price: `game-preview`

## Commands Available

| Command | What it does | Credits |
|---------|--------------|---------|
| `get_standings` | Record, home/away, last 10, runs scored and allowed, run differential, Pythagorean win pct | 2 |
| `get_ratings` | Elo for every team, ranked, as of season end or today | 2 |
| `get_team_stats` | Runs per game for and against; team batting and opponents' batting (AVG, OBP, SLG, OPS, K%, BB%, HR) | 5 |
| `get_games` | A team's games, for splits and schedule strength | 2 |
| `get_injuries` | Current injured list (MLB only) | 2 |
| `list_teams` | Team ids and abbreviations | 1 |

## Commands That Do NOT Exist

| Not available | Use instead |
|---------------|-------------|
| `get_team_roster`, `get_depth_chart` | Not available. Use `get_leaders` and `get_player` for named players |
| `get_bullpen_stats` | Not available. Derive from `get_game` pitching rows where `starter` is false |
| `get_team_defense`, `get_drs` | Not available. Use opponents' batting from `get_team_stats` as a rough proxy |
| `get_strength_of_schedule` | Compute from `get_games` and `get_ratings` as shown below |
| `get_playoff_odds` | Not available. Simulate with Elo if the user wants a number |

## How It Works

**Step 1: Standings snapshot.** `get_standings` with `season`. Each row has `wins`, `losses`, `home_wins`, `home_losses`, `away_wins`, `away_losses`, `last10_wins`, `runs_scored`, `runs_allowed`, `run_differential`, `win_pct`, `pythagorean_win_pct`. Real row (2025 Brewers): 97-65, 806 runs scored, 634 allowed, +172, `pythagorean_win_pct` 0.608.

**Step 2: Process stats.** `get_team_stats` with `team` and `season`. Real shape (2025 Yankees, trimmed):

```json
{"data": {"teams": [{"abbrev": "NYY", "games": 162,
  "runs_per_game": 5.24, "runs_allowed_per_game": 4.23, "run_differential": 164,
  "batting": {"hr": 274, "avg": 0.251, "obp": 0.332, "slg": 0.455, "ops": 0.787, "k_pct": 0.235, "bb_pct": 0.102},
  "pitching_against": {"hr": 175, "avg": 0.229, "obp": 0.305, "slg": 0.379, "ops": 0.684, "k_pct": 0.236, "bb_pct": 0.092}
}]}}
```

Reading it: offense is `batting`; run prevention is `pitching_against` (opponents' line against this team, so it mixes pitching and defense). A team with a .787 OPS and a .684 OPS against is a plus team on both sides.

**Step 3: Power rating.** `get_ratings` returns Elo, 1500 average. The method note in the response says a 100-point gap is about a 64% favourite on a neutral field, and ratings regress a third of the way to the mean between seasons. Real values, 2025 end: LAD 1578.3, MIL 1564.4, PHI 1559.5, NYY 1557.2. A 14-point gap between the top two is noise; do not rank on it.

**Step 4: Reconcile the three.** Compare:

| Signal | Source | Question it answers |
|--------|--------|---------------------|
| Record | `win_pct` | What happened |
| Run differential / Pythagorean | `run_differential` | What the scoring says should have happened |
| Elo | `get_ratings` | Who beat whom, weighted for opponents and margin |

When they disagree, say why. Example from the 2025 standings: Toronto won 94 games but its run differential (+77) implies about .546, roughly 88 to 89 wins. That is a record the underlying scoring did not fully earn. See `pythagorean-record`.

**Step 5: Splits and form.** `last10_wins` is a 10-game window: treat as color, not signal. Home/away splits over 81 games each carry roughly a 4.5-win standard error per side; do not call a team "a road team" off 81 games.

**Step 6: Strength of schedule (optional).**

```python
games = get_games(team="MIL", season=2025, status="final", limit=200)["data"]["games"]
elo = {r["abbrev"]: r["rating"] for r in get_ratings(season=2025)["data"]["ratings"]}
opp = [g["away"]["abbrev"] if g["home"]["abbrev"] == "MIL" else g["home"]["abbrev"] for g in games]
sos = sum(elo[o] for o in opp) / len(opp)
```

End-of-season Elo is a mild look-ahead for early-season games; say so. Postseason games are in the list unless you filter `season_type: "regular"`.

## College Baseball

Pass `league: "ncaabase"`. `get_standings`, `get_ratings` and `get_team_stats` work. There are no conference-adjusted ratings beyond our Elo, schedules differ enormously in strength, and ESPN does not carry every Division I game, so records may be incomplete. Always show games played next to the record. The college standings list every team ESPN carries, sorted by win percentage, so a team with 3 games and a 3-0 record can top the list. Filter on games played (wins plus losses) before ranking anything.

## Credit Usage

| Operation | Credits |
|-----------|---------|
| Standings + ratings (league view) | 4 |
| One team's process stats | 5 |
| All 30 teams' process stats (`get_team_stats` with no `team`) | 5 |
| Team schedule strength | 2 + 2 |

`get_team_stats` without `team` returns the whole league in one 5-credit call. Prefer that to 30 calls.

## Anti-patterns

| Mistake | Why it is wrong | Do This |
|---------|-----------------|---------|
| Ranking by win-loss alone | One-run luck swings records by several wins | Show run differential and Elo next to it |
| Calling opponent OPS "pitching" | It includes defense and park | Label it "run prevention" |
| Using last 10 as a trend | n = 10 | Report it, do not conclude from it |
| Comparing 2020 (60 games) to other years | Different sample | Scale rates, not counts |
| Treating a 20-point Elo gap as meaningful | Elo error is larger | Group teams in tiers |
| Quoting a record without a date | Standings move daily | Say "through [date]" |

## Output Format

```
Milwaukee Brewers, 2025 (regular season)
Record: 97-65 (.599). Home 52-29, away 45-36. Last 10: 4-6.
Runs: 806 scored, 634 allowed, +172. Pythagorean .608 (98.5 wins).
Elo: 1564.4 (2nd). Gap to 1st (LAD, 1578.3): inside noise.
Read: a real top-two team; record matches its scoring.
```

## What to Do Next

| You found | Next | Skill |
|-----------|------|-------|
| Record far from Pythagorean | Quantify luck and expected regression | `pythagorean-record` |
| An offense or staff that stands out | Find the players driving it | `player-scouting` |
| Two teams about to meet | Matchup report | `game-preview` |
| Want a win probability model | Validate it properly | `walk-forward-validation` |
