---
name: dispatch
description: "Routes a baseball analytics request to the right 2 to 3 skills in this pack. Load this FIRST when an MLB or college baseball data, analytics or betting request comes in and you are unsure which skills to activate. Prevents loading all 16 skills when two will do. Do not use when the request already names one skill's job, such as devigging two prices: load odds-analysis directly."
metadata:
  version: 1.0.0
  author: FastballAPI
---

# Skill Dispatch Guide

Match the request to a pattern, load those skills, stop. Always pair with `fastballapi-tool` when live data is needed: it holds the tool list, credit costs and the coverage limits.

## First-Use Persona Check

| Signal | Persona | Start with |
|--------|---------|------------|
| "What happened last night?" / exploring | Explorer | `game-lookup` |
| "Who is better, X or Y?" / scouting | Scout | `player-scouting`, `pitch-mix-analysis` |
| "I want to build a model" | Builder | `walk-forward-validation`, `pythagorean-record` |
| "What are the lines? Any edge?" | Bettor | `odds-explorer`, `edge-detection` |
| "Is my strategy real?" | Validator | `backtesting`, `walk-forward-validation` |
| "I am new to betting" | New bettor | `odds-analysis`, `edge-detection` |

## Request Patterns

### "What was the score?" / "Who plays tonight?" / "Schedule"
1. `game-lookup`: `get_games`, `get_schedule`, `get_game`.
2. Add `fastballapi-tool` only if you need cost or parameter detail.

### "How are the Dodgers doing?" / "Standings" / "Best team" / "Run differential"
1. `team-analysis`: standings, team stats, Elo.
2. `pythagorean-record` if the question is luck, regression or "are they as good as their record?".

### "Tell me about Aaron Judge" / "Compare two hitters" / "Who leads the league in OPS?"
1. `player-scouting`: search, season lines, leaders, injuries.
2. `run-value-analysis` if the user wants RE24 or clutch splits.
3. `spray-chart-analysis` if the question is where he hits the ball.

### "What does Tarik Skubal throw?" / "Whiff rate by pitch" / "Pitch mix"
1. `pitch-mix-analysis`: `get_pitch_mix`, `get_pitches`.
2. `player-scouting` for the season line behind it.

### "Run value" / "RE24" / "How much did that home run matter?" / "Hitting with runners in scoring position"
1. `run-value-analysis`: `get_plate_appearances`, `get_player`.

### "Where does he hit the ball?" / "Shift" / "Pull rate" / "Spray chart"
1. `spray-chart-analysis`: `get_spray_chart`.
2. `player-scouting` for context.

### "Pythagorean record" / "Who got lucky?" / "Expected wins"
1. `pythagorean-record`: `get_standings`, `get_team_stats`.
2. `team-analysis` for the surrounding picture.

### "What are the odds?" / "Best price" / "Did the line move?"
1. `odds-explorer`: `get_odds`, `get_line_movement`.
2. `odds-analysis` for devigging and implied probability.

### "Preview tonight's Dodgers game" / "Game breakdown"
1. `game-preview`: composes standings, ratings, schedule, injuries and odds.
2. `odds-explorer` only if the user wants the full book-by-book table.

### "Devig these odds" / "No-vig price" / "Implied probability"
1. `odds-analysis`. No data call needed for plain math.

### "Is this a bet?" / "Expected value" / "Kelly" / "CLV"
1. `edge-detection`: needs a model probability from the user or from `prop-modeling`.
2. `odds-analysis` first if the price still has the margin in it.

### "Strikeout prop" / "Total bases over" / "Will he go over his hits line?"
1. `prop-modeling`: pitcher strikeouts, hits, total bases.
2. `pitch-mix-analysis` for pitcher inputs, `edge-detection` for the price decision.

### "Backtest this" / "Would this have made money?" / "Closing line value"
1. `backtesting`: closing lines from `get_odds`, props from `get_prop_history`.
2. `walk-forward-validation` for the model underneath.

### "Is my model accurate?" / "Cross-validation" / "Train/test split" / "Features"
1. `walk-forward-validation`: temporal splits, leakage, calibration check.

### "College baseball" / "Omaha" / "NCAA"
1. Route as above, then tell the user what college lacks (no pitch rows, no spray charts, no props, no injuries). `fastballapi-tool` has the full list.

## Common Chains

| Goal | Chain |
|------|-------|
| Scout a pitcher end to end | `player-scouting` (season line) then `pitch-mix-analysis` (arsenal) then `prop-modeling` (strikeout line) |
| Understand a hitter's power | `player-scouting` then `spray-chart-analysis` then `run-value-analysis` |
| Find out if a club is overrated | `team-analysis` then `pythagorean-record` |
| Go from a model to a bet | `walk-forward-validation` then `odds-analysis` then `edge-detection` |
| Prove or kill a strategy | `walk-forward-validation` then `backtesting` |
| Cover tonight's game | `game-preview` then `odds-explorer`, adding `prop-modeling` for a named player |

## Ambiguity Resolver

| The user says | They probably mean | Ask or assume |
|---------------|--------------------|---------------|
| "The odds" | Moneyline for a named game | Assume moneyline, show run line and total too |
| "His stats" | Season batting or pitching line | Assume the latest completed season, say which |
| "Whiffs" | Whiff rate per swing by pitch | `pitch-mix-analysis` |
| "Is he good?" | Rate stats with a sample caveat | `player-scouting` |
| "Over/under" | Game total, unless a player is named | Ask if unclear |
| "Last year" | The most recent completed season | State the year |
| "Tonight" | The next date with games in `get_schedule` | Check the date first |

## Credit-Aware Routing

| Request | Rough cost |
|---------|-----------|
| Scores for a date | 2 |
| Standings and Pythagorean | 2 |
| Pitcher arsenal (search + mix) | 6 |
| Game preview | about 9 to 20 |
| One day of odds | 10 |
| Pitcher strikeout prop history | 11 |
| Season of game-by-game odds | about 12,000: ask first |

If the free 500 credits a month will not cover the job, say so and link https://fastballapi.com/pricing. Do not trim the method to fit.

## Rules

1. Two or three skills per request. More is noise.
2. Never invent a tool. If a skill's "Commands That Do NOT Exist" table lists it, stay out.
3. Say the data window before the answer when it matters (props start May 2023, win probability 2019, college has no pitch data).
4. For anything involving money, load `edge-detection` or `backtesting` and keep its warnings: edges are estimates, variance is large, sample size decides.

## When NOT to Use This Guide

Single-skill requests do not need routing. "What was the Yankees score last night" is `game-lookup`. "Convert +150 to a probability" is `odds-analysis`.
