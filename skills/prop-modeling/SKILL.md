---
name: prop-modeling
description: "Builds player prop projections for MLB: pitcher strikeouts and outs, batter hits, total bases, home runs and RBI. Pulls prop lines and results from FastballAPI, projects workload and rates, adjusts for the opponent, converts to over and under probabilities and compares them with the devigged market. Use when the user asks about a strikeout prop, a hits or total bases line, how often a player goes over, or how to model a prop. Do not use for team-level game prediction: see walk-forward-validation. Do not use to browse lines: see odds-explorer. Do not use for EV and staking: see edge-detection."
metadata:
  version: 1.0.0
  author: FastballAPI
---

# Prop Modeling

> **Default data tool:** FastballAPI (`fastballapi-tool`).
> `get_prop_history` (10 credits, up to 200 games) for line vs result history. `get_player_props` (10) for tonight's lines by book. `get_player_games` (5), `get_player` (5), `get_team_stats` (5), `get_pitch_mix` (5) for inputs. `estimate_only: true` on `get_player_props` prices a call without charging.

You project a number of events for one player in one game, turn it into a probability, and compare with the market's devigged price. Props are one-game, high-variance bets with margins near 5% to 6% on each side. Honest conclusion most of the time: the market is about right.

MLB only. College baseball has no props.

## When to Use

- "What is the projection for Skubal's strikeouts tonight?"
- "How often does Judge go over 1.5 total bases?"
- Pitcher strikeouts (`pitcher_strikeouts`), pitcher outs (`pitcher_outs`)
- Batter hits (`batter_hits`), total bases (`batter_total_bases`), home runs (`batter_home_runs`), RBI (`batter_rbis`)
- Evaluating whether a prop model beats the closing line over a sample

## When NOT to Use

- Browsing prop lines: `odds-explorer` covers game lines; use `get_player_props` here
- EV, Kelly and staking: `edge-detection`
- Backtest bookkeeping across many bets: `backtesting`
- Game-level win probability: `walk-forward-validation`

## Commands Available

| Command | What it does | Credits |
|---------|--------------|---------|
| `get_player_props` | Lines by book. `game_id`: every player's props in that game. `player_id` plus `from_date` (and `to_date`): one player across games. `market`, `bookmaker`, `snapshot_type` (`closing` default, `opening`), `estimate_only` | 10 (per game returned on the player route, up to 100) |
| `get_prop_history` | One row per game for a player and `market`: closing `line`, `open_line`, `over_odds`, `under_odds`, `books`, `actual`, `result`, `margin`, plus a summary with `over_rate`. `from_date`, `to_date`, `bookmaker`, `limit` up to 200 | 10 |
| `get_player_games` | Game log: pitching rows have `starter`, `outs`, `h`, `r`, `er`, `bb`, `so`, `hr`, `pitches`, `strikes`; batting rows have `ab`, `h`, `hr`, `bb`, `so`, `batting_order` | 5 |
| `get_player` | Season line including doubles, triples, HR (for total bases) | 5 |
| `get_team_stats` | Opponent K%, BB%, OPS (omit `team` for all 30 clubs) | 5 |
| `get_pitch_mix` | Pitcher arsenal and whiff rates | 5 |
| `search_players` | Player ids | 1 |

## Commands That Do NOT Exist

| Not available | Use instead |
|---------------|-------------|
| `get_probable_pitchers`, `get_lineups` | Not available. Props posted for a pitcher imply he is starting; confirm from the club's own announcement |
| `get_umpire`, `get_weather`, `get_park_factors` | Not available. Leave these out and say so |
| `get_prop_projection`, `get_dfs_projection` | Not available. Build with the method below |
| `get_alt_lines` | Not available. One posted line per book per market |
| `get_live_props` | Not available. Closing or opening snapshots only |
| `get_player_splits` | Not available as a call. Use `get_plate_appearances` for a batter and group by pitcher in code |

## Coverage

- Prop lines start in May 2023 (DraftKings, FanDuel, BetMGM, ESPN BET, Pinnacle and others); markets: hits, home runs, total bases, RBI, pitcher strikeouts, pitcher outs.
- Closing is the last line before first pitch. Opening is the first captured. Both per book.
- Check counts with https://fastballapi.com/data/player-props before promising a sample.

## Real Data Shape

`get_player_props` for Tarik Skubal, 2025-09-23, closing (trimmed):

```json
{"data": {"snapshot_type": "closing", "games": 1, "props": [
 {"game_id": "401697253", "game_date": "2025-09-23", "player_name": "Tarik Skubal", "market": "pitcher_strikeouts",
  "bookmaker": "draftkings", "line": 7.5, "over_odds": -146, "under_odds": 115, "source": "archive"},
 {"bookmaker": "betmgm", "line": 7.5, "over_odds": -150, "under_odds": 115},
 {"bookmaker": "fanduel", "line": 7.5, "over_odds": -132, "under_odds": 100}]}}
```

`get_prop_history` for the same pitcher, April 2025, four games:

```json
{"data": {"market": "pitcher_strikeouts", "games": [
 {"game_date": "2025-04-02", "line": 7.5, "over_odds": -110, "under_odds": -125, "books": 6, "actual": 8, "result": "over",  "margin": 0.5},
 {"game_date": "2025-04-08", "line": 7.5, "over_odds": 118,  "under_odds": -160, "books": 7, "actual": 6, "result": "under", "margin": -1.5},
 {"game_date": "2025-04-14", "line": 6.5, "over_odds": -164, "under_odds": 127,  "books": 7, "actual": 9, "result": "over",  "margin": 2.5},
 {"game_date": "2025-04-20", "line": 6.5, "over_odds": -112, "under_odds": -118, "books": 7, "actual": 4, "result": "under", "margin": -2.5}],
 "summary": {"games": 4, "overs": 2, "unders": 2, "over_rate": 0.5, "avg_line": 7, "avg_actual": 6.8}}}
```

Four games prove nothing; the summary exists to show the shape. Pull up to 200 and treat 100 as a minimum before quoting an over rate.

## Method: Pitcher Strikeouts

Strikeouts = batters faced (BF) times strikeout probability per batter. Workload (BF) is usually the larger source of uncertainty.

**Step 1: Workload.** From `get_player_games` pitching rows over the last 8 to 12 starts, take `outs` and `pitches` for rows where `starter` is true. Estimate BF per start from `outs`, hits and walks: BF is about `outs + h + bb` (misses hit-by-pitch and errors, so it understates slightly). Look at the distribution, not just the mean; skip starts cut short by injury. Check news the model cannot see: skipped starts, a new pitch limit, a recent injury.

**Step 2: Baseline K%.** From the pitching log and `get_player`, K per BF over the last full season plus the current one. Shrink toward the league mean with weight `n / (n + 70)` (K% stabilizes around 70 batters faced; rule of thumb). Skubal 2025 from real calls: 241 strikeouts, `outs` 586, 141 hits, 33 walks, so BF is about 760, K% about 31.7%.

**Step 3: Opponent adjustment (odds-ratio / log5).** Opponent K% from `get_team_stats` (`batting.k_pct`). League K% is the PA-weighted mean across the 30 clubs: 22.2% for 2025.

```python
def odds(p): return p / (1 - p)

def log5(pitcher, batter, league):
    o = odds(pitcher) * odds(batter) / odds(league)
    return o / (1 + o)
```

Real inputs: pitcher 0.317, opponent SEA batting K% 0.233, league 0.2219 → 0.331. Against TOR (0.178, the lowest club K%) the same pitcher drops well below that. This ignores park, handedness mix and lineup (see Limits).

**Step 4: Distribution.** Strikeouts out of BF batters are close to binomial. A binomial is tighter than a Poisson, which overstates tail probabilities.

```python
from math import comb

def p_at_least(n, p, k):
    return sum(comb(n, i) * p**i * (1 - p)**(n - i) for i in range(k, n + 1))

# over 7.5 means K >= 8
```

Workload dominates the answer. Same p = 0.331, only BF changes (real arithmetic):

| BF | Expected K | P(K >= 8) |
|----|------------|-----------|
| 22 | 7.3 | 45.0% |
| 24 | 7.9 | 56.6% |
| 25 | 8.3 | 62.1% |
| 27 | 8.9 | 71.6% |

So a two-batter swing in workload moves the over probability by more than 10 points. Mix over your BF distribution (weights from his recent starts) rather than picking one number.

**Step 5: Compare.** Devig the market (`odds-analysis`): DraftKings 7.5 at -146/+115 gives fair over about 56%. Your model number must beat that by more than your calibration error before it is an edge, and a single-book price is not the market: devig several books.

## Method: Pitcher Outs

Same workload model; the prop is outs recorded, which drops the strikeout rate and depends on pitches per out. Use `outs` from the pitching log, a pitch-count cap, and the hook tendency. Outs and strikeouts for the same pitcher are positively correlated: never price both as independent in a parlay.

## Method: Batter Hits

Hits ~ Binomial(AB, p), with p the per-AB hit probability, not the season average alone.

1. Expected AB: from `batting_order` in `get_player_games` (leadoff gets more PA than eighth; lineup spot is known only close to game time).
2. p: season hits per AB, shrunk to the league average with weight `AB / (AB + 400)` (average stabilizes slowly; rule of thumb). Then adjust for the opposing starter's quality with the same odds-ratio trick, using the starter's hits allowed per batter faced from his own pitching log.
3. `P(over 0.5) = 1 - (1 - p)^AB` for 0.5; sum the binomial for 1.5.

For a hitter with p = 0.25 and 4 AB: `1 - 0.75^4 = 68.4%` for at least one hit. Lines at 0.5 hits are priced near that, which is why edges are thin.

## Method: Total Bases

TB depends on hit type. `get_player_games` has only `h` and `hr`, so you cannot rebuild total bases from the log. Two options:

- Season level: `get_player` has `h`, `doubles`, `triples`, `hr`, giving TB = H + doubles + 2 x triples + 3 x HR.
- Event level: `get_plate_appearances` for the batter (10 credits per 1,000 PAs) with `result` values such as `single`, `double`, `home-run`, `walk`, `strikeout`. Group them for a per-PA outcome distribution.

Then simulate: draw PA count (3.5 to 5, by lineup slot), for each PA draw an outcome from the multinomial, sum bases. A line of 1.5 means P(TB >= 2). This distribution has a heavy right tail (one home run is 4), which is why a normal approximation misprices it. Simulate; do not use a normal curve.

## Evaluating a Prop Model

1. Pull `get_prop_history` (up to 200 games per player-market). Each row has the closing line, the prices and the `actual`. 
2. For each game, produce your probability using only data before that date (see `walk-forward-validation`; the shift-before-roll rule applies).
3. Score against the devigged closing probability: Brier score and log loss of the market vs yours. The market is the bar. 
4. Report `over_rate` against `avg_line` and your calibration by bucket. See the calibration section of `walk-forward-validation`.
5. Treat 100 graded games for one player as little; pool across players for any strong statement, with several hundred graded props per market.

## Limits to State

- No confirmed lineup, pitching change, weather, park or umpire data. Say so. 
- Props posted for a pitcher are not a guarantee he starts. A scratch voids or reprices a bet.
- Lines move; the closing line is the best information. A projection made at the opening line is not directly comparable to the closing result.
- Margins: two-way prop margins near 5% to 6% mean an estimated edge of a couple of points is inside the error of the estimate itself.

## Credit Usage

| Workflow | Credits |
|----------|---------|
| Pitcher K projection: search (1) + game log (5) + season (5) + team stats (5) + tonight's props (10) | 26 |
| + history to test (`get_prop_history`) | +10 |
| Batter total bases: search + `get_player` + one PA page + props | 26 |
| Price check before pulling | `estimate_only` costs 0 |

## Anti-patterns

| Mistake | Why it is wrong | Do This |
|---------|-----------------|---------|
| Using season K/9 as the projection | Ignores workload and opponent | Project BF and K% separately |
| Poisson for strikeouts | Overstates tails | Binomial on BF, mixed over BF |
| Normal curve for total bases | Heavy right tail, discrete | Simulate PA outcomes |
| Pricing the over at one book only | Margins differ | Devig several books |
| Judging by 10-game over rate | Noise | 100+ graded games, pooled |
| Treating a sub-3-point edge as a bet | Inside error | Pass |
| Parlaying correlated props as independent | Correlated | Price jointly or not at all |
| Quoting a "model" with 4 starts of data | n too small | Shrink toward the league mean |

## Output Format

```
Tarik Skubal, strikeouts, vs SEA (illustration, not a pick)
Workload: 24.5 BF mean over 31 starts (BF approximated as outs + h + bb); use the spread of his recent starts
K%: 31.7% season, odds-ratio vs SEA 23.3% (league 22.2%) = 33.1%
Mean K: 8.1. P(K >= 8): 57% at 24 BF, 45% at 22 BF, 72% at 27 BF
Market: DK 7.5 at -146/+115, fair over 56% (multiplicative)
Read: model is inside the market once workload uncertainty is respected. No edge claim.
Missing: confirmed starter, weather, umpire, park.
```

## What to Do Next

| You found | Next | Skill |
|-----------|------|-------|
| Projection differs from the market | EV and sizing | `edge-detection` |
| Need the price without margin | Fair probability | `odds-analysis` |
| Want to test across seasons | Backtest on closing lines | `backtesting` |
| Pitcher arsenal question | Whiff by pitch | `pitch-mix-analysis` |
