---
name: game-preview
description: "Builds a pre-game report for one MLB or college baseball matchup: records, run differential, Elo, recent form, injuries, the median and per-book lines, and what the market implies. Use when the user asks for a game preview, a breakdown of Team A vs Team B, tonight's matchup, or a shareable pre-game summary. Do not use for a full slate: loop get_odds by date instead and see odds-explorer. Do not use for odds-only lookups: see odds-explorer. Do not use for building a model: see walk-forward-validation."
metadata:
  version: 1.0.0
  author: FastballAPI
---

# Game Preview

> **Default data tool:** FastballAPI (`fastballapi-tool`).
> Typical cost: `get_schedule` (2) + `get_standings` (2) + `get_ratings` (2) + `get_team_stats` (5) + `get_injuries` (2 per team) + `get_odds` (5) = about 20 credits.
> If the user only needs the lines, stop at `get_odds` and use `odds-explorer`.

You compose one tight report that replaces 20 minutes of tab hopping. Starting pitchers drive baseball games and FastballAPI has no probable-pitcher endpoint, so the report states that gap instead of papering over it.

## When to Use

- "Preview tonight's Dodgers game"
- "Brewers vs Dodgers, what should I know?"
- "Break down Game 3"
- A shareable one-page summary of a matchup

## When NOT to Use

- A whole slate: use `get_odds` with `date` (10 credits) and `odds-explorer`
- Only prices or line moves: `odds-explorer`
- Season-long team assessment: `team-analysis`
- A pitcher's full arsenal: `pitch-mix-analysis`

## Commands Available

| Command | Use in a preview | Credits |
|---------|------------------|---------|
| `get_schedule` | Find the game, its id, first pitch, and the median line | 2 |
| `get_standings` | Record, home/away split, last 10, run differential, Pythagorean | 2 |
| `get_ratings` | Elo for both teams | 2 |
| `get_team_stats` | Team offence and run prevention (omit `team` for the league in one call, 5) | 5 |
| `get_injuries` | Injured list for each club (MLB only) | 2 per team |
| `get_odds` | Every book's lines for the `game_id` | 5 |
| `get_games` | The last meetings between the two teams (filter in code) | 2 |
| `get_pitch_mix` | The starter's arsenal, if the user names him | 5 |

## Commands That Do NOT Exist

| Not available | Use instead |
|---------------|-------------|
| `get_game_preview` | Compose from the calls above |
| `get_probable_pitchers`, `get_starting_lineups` | Not available. Ask the user who is starting, or label the section "starter unconfirmed" |
| `get_head_to_head` | `get_games` for one team and filter by opponent |
| `get_weather`, `get_park_factors` | Not available. Do not guess the wind |
| `get_bullpen_usage` | Rebuild from recent `get_game` pitching rows if the user asks (5 credits each) |
| `get_umpire` | Not available |

## How It Works

**Step 1: Find the game.** `get_schedule` with `team` and `days`. Take `game_id`, `starts_at` (UTC; convert), `venue`, `line` (median `home_ml`, `away_ml`, `home_run_line`, `total`, `books`). If `line` is null, the books have not posted. Say so; do not estimate.

**Step 2: Context for both clubs.** One `get_standings` call returns both. One `get_ratings` call returns both. From the standings row take `win_pct`, `pythagorean_win_pct`, home/away record, `last10_wins`, `run_differential`. A 2025 comparison, real values: MIL 97-65, +172, Pythagorean .608; LAD 93-69, +142, Pythagorean .586; Elo 1564.4 vs 1578.3.

**Step 3: Process.** `get_team_stats` (no `team`, 5 credits) gives both clubs in one call. Compare `runs_per_game`, `runs_allowed_per_game`, `batting.ops`, `pitching_against.ops`, `k_pct`, `bb_pct`.

**Step 4: Availability.** `get_injuries` for each `team`. List only players who matter to the game: starters, regulars, closers. `return_date` is the club's estimate.

**Step 5: Starting pitchers.** No endpoint. Options, in order:
1. The user states them. Then pull each starter with `search_players` (1) and `get_pitch_mix` (5), plus `get_player` (5) for the season line.
2. Skip and say "starters not confirmed; this preview is team-level".

A starter change alone can move a baseball line by a wide margin, so a team-level preview without the starters is half a preview. Say that.

**Step 6: The market.** `get_odds` with the `game_id`. Show best price per side, median, and the margin (see `odds-analysis`). Convert the median moneyline into a fair probability with the stated method and put it beside the Elo-implied probability:

```
Elo-implied P(home) = 1 / (1 + 10^(-(elo_home - elo_away + home_adv)/400))
```

The `get_ratings` response notes that a 100-point gap is about a 64% favourite on a neutral field (consistent with a 400-point logistic scale). `home_adv` is not exposed by the API: do not insert a number. Say "neutral-field Elo probability" and note that home field adds a few points.

**Step 7: Compare, then stop.** If the market and Elo disagree by more than 5 points, the likely cause is a starting pitcher, not an edge. Say that. Hand off to `edge-detection` only if the user has their own calibrated model.

## Report Layout

```
LAD at MIL, Sun Oct 11 2026, 8:00 PM ET, American Family Field (postseason)
Market (median of 8 books): MIL -111, LAD -105, run line MIL +1.5, total 6.
Fair split (multiplicative devig): about MIL 50.7 / LAD 49.3
Form (2025 reg. season): MIL 97-65 (+172), LAD 93-69 (+142)
Elo (end of 2025): MIL 1564, LAD 1578 (14 points, inside noise)
Offence vs run prevention: from get_team_stats
Injuries: [only players who matter]
Starters: not confirmed in the data. A change can move the line a lot.
Read: market is a coin flip; nothing in team-level data separates them.
```

The numbers in the schedule line above come from a real `get_schedule` response on 2026-10-11 (median line MIL -111 / LAD -105, total 6, 8 books). Verify the date and refresh before using any of it.

## College Baseball

`league: "ncaabase"` works for `get_schedule`, `get_standings`, `get_ratings`, `get_team_stats`, `get_game`, `get_odds`. No injuries, no pitch data. College previews live or die on the starting pitcher and the schedule strength; say both are missing when they are.

## Credit Usage

| Operation | Credits |
|-----------|---------|
| Core preview (schedule, standings, ratings, team stats, odds) | 16 |
| + injuries both clubs | +4 |
| + one starter's arsenal | +6 |
| + last meetings | +2 |

## Anti-patterns

| Mistake | Why it is wrong | Do This |
|---------|-----------------|---------|
| Previewing without starters and not saying so | Starter is the biggest single input | Label it |
| Calling a Pythagorean gap a pick | It is a luck estimate over a season | Use it as context |
| Reading regular-season records for a playoff series | Playoff rosters use the top starters and relievers | Note the context shift |
| Quoting the median line as the best line | Median is not purchasable | Show best and median |
| Inventing a park or weather note | No such data | Leave it out |
| Treating Elo difference as a spread | 100 points is about 64% on a neutral field, not a number of runs | Convert to probability only |

## What to Do Next

| You found | Next | Skill |
|-----------|------|-------|
| Market and Elo disagree | Check who is starting; price the gap | `odds-analysis` |
| A pitcher with a big arsenal edge | Arsenal and whiff detail | `pitch-mix-analysis` |
| User has a model | EV and sizing | `edge-detection` |
| Strikeout or hit props for the game | Prop projections | `prop-modeling` |
