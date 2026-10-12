---
name: walk-forward-validation
description: "Evaluates baseball prediction models honestly with time-ordered walk-forward splits: leakage-safe rolling features, expanding vs sliding windows, baselines (home field, Elo, closing line), log loss, Brier score and calibration checks. Use when the user asks how to validate a model, whether cross-validation is okay, how to engineer features without leakage, or whether a model's accuracy is real. Refuses random k-fold on games. Do not use for bankroll simulation: see backtesting. Do not use for odds math: see odds-analysis. Do not use for prop pricing: see prop-modeling."
metadata:
  version: 1.0.0
  author: FastballAPI
---

# Walk-Forward Validation

> **Default data tool:** FastballAPI (`fastballapi-tool`).
> `get_games` (2 credits per call, up to 200 games) for results, `get_standings` (2) and `get_ratings` (2) for as-of-season context, `get_odds` (10 per date) for a market baseline. This skill is mostly method.

You make a model's score honest. Baseball is the hardest major sport to predict from team data: even the best clubs win about 60% of games, so the gap between a real model and noise is a couple of percentage points. Leakage or a bad split can create that much by itself.

## When to Use

- "Is my win-probability model any good?"
- "Can I use k-fold cross-validation on games?" (no)
- Choosing features and making sure they use only past information
- Comparing a model with Elo, home field and the closing line
- Checking whether predicted probabilities are calibrated
- Setting up a train/test structure for props or totals

## When NOT to Use

- Simulating bets and bankroll: `backtesting`
- Computing fair probabilities from prices: `odds-analysis`
- Pitcher or hitter prop math: `prop-modeling`
- Team record luck: `pythagorean-record`

## Commands Available

| Command | What it does | Credits |
|---------|--------------|---------|
| `get_games` | Final scores by season, date range or team; `limit` up to 200, `offset` to page | 2 per call |
| `get_standings` | Season standings (use only as-of-prior-season for features) | 2 |
| `get_ratings` | Elo, "as of the end of a season or today" | 2 |
| `get_odds` | Closing prices for a date (10) or a game (5), with `result` for finished games | 5 or 10 |
| `get_team_stats` | Season team process stats | 5 |

## Commands That Do NOT Exist

| Not available | Use instead |
|---------------|-------------|
| `get_train_test_split`, `evaluate_model` | Implement the splits and metrics below |
| `get_rolling_stats`, `get_team_form` | Build from `get_games` with a lag, as shown |
| `get_elo_history` | `get_ratings` is end-of-season or today only. Build your own game-by-game Elo from `get_games` for as-of features |
| `get_probable_pitchers` | Not available. Pitcher identity cannot be a pre-game feature from this API |
| `get_lineups`, `get_weather`, `get_park_factors` | Not available |

A hard limit to say up front: `get_ratings` returns one rating per team per call, as of a season's end or now. Using `get_ratings` for season N as a feature for games in season N is leakage. Use the previous season's end rating, or build a rolling Elo yourself.

## Why Random K-Fold Fails

Random folds put games from the same week in train and test. A team's April and May games share its roster, its Elo and its streaks. The model sees the future of the team's season and the test score rises. Measure it: run both a random k-fold and a walk-forward split on the same data and report the gap. If the random score is higher, that gap is the leak.

Walk-forward means every prediction is made with only information that existed before first pitch.

## Splits

**Expanding window (default).** Train seasons 2015 to N-1, test season N, for N from 2019 to the latest complete season. The train set grows each fold.

**Sliding window.** Train on the last K seasons only, if the older data hurts (rule changes, the 2020 shortened season, pitch-clock effects). Test this with data, not by assumption.

**Within a season (for in-season models).** Train through date D, predict D+1 to D+7, step forward weekly. Same rule: nothing after D enters the features.

Always report per-fold results, not just an average. Seasons differ.

## Leakage-Safe Features

Every feature is built as of the start of the game.

```python
import pandas as pd

games = games.sort_values(["date", "game_id"])
# long format: one row per team per game
g["runs_for_roll10"] = (g.groupby("team")["runs_for"]
                         .transform(lambda s: s.shift(1).rolling(10, min_periods=5).mean()))
```

The `shift(1)` is the whole point: a rolling mean that includes the current game contains the answer. Rules:

1. Shift before rolling or expanding.
2. Season-level features (win pct, run differential) come from games before the date, not the final standings. Do not pull `get_standings` for the season being predicted.
3. Reset or damp features at season boundaries (rosters change over the winter); carry over with shrinkage, not at full strength.
4. Early-season rows with few prior games are noisy. Use `min_periods` and shrink toward the league mean: `(n * team_value + k * league_value) / (n + k)` with k picked by validation.
5. Doubleheaders and same-day games: order by `starts_at`, and exclude a same-day game's result from the other game's features.
6. Starting pitchers are usually the biggest input in baseball and this API has no probable-pitcher data. Team-only models are therefore structurally capped. Say that when reporting accuracy.

Candidate features that are available and leakage-safe: rolling run differential, prior-season Elo, home/away flag, rest days (from schedule dates), rolling team batting OPS from `get_games`-derived runs and hits, bullpen usage from recent box scores.

## Baselines the Model Must Beat

| Baseline | Accuracy / log loss reference |
|----------|-------------------------------|
| Always pick home | Home win rate over your sample |
| Prior-season Elo | Strong simple baseline |
| Closing moneyline, devigged | The market. The hardest baseline |

For the market baseline, `get_odds` with `date` returns closing prices; devig per `odds-analysis`. Results are in `result.favourite_won` for finished games. If your model does not beat the closing line on log loss, it is not adding information the market lacks.

Report accuracy alongside a bootstrap interval: with about 2,430 regular-season games, a standard error on accuracy is about 1 percentage point (sqrt(0.25 / 2430) = 0.0101). A 52% model against a 54% market is not close to settled.

## Metrics

```python
import numpy as np
def log_loss(y, p): p = np.clip(p, 1e-6, 1 - 1e-6); return -np.mean(y*np.log(p) + (1-y)*np.log(1-p))
def brier(y, p): return np.mean((p - y) ** 2)
```

- **Log loss** punishes confident misses. Primary metric.
- **Brier** is less sensitive to extremes. Report both.
- **Accuracy** only as a secondary number; it hides probability quality.
- Compare log loss to the market's (devigged) log loss on the same games.

## Calibration

A probability of 60% should win about 60% of the time.

1. Bin predictions (deciles, or fewer if the sample is small) in the test folds only.
2. For each bin: mean predicted, observed win rate, count.
3. Plot or tabulate. Bins with under 100 games are noise.
4. If it is off, fit Platt scaling (logistic on the logit of the score) or isotonic regression on a separate calibration fold (the fold before the test fold), never on the test fold.
5. Re-check on the test fold after calibrating.

Baseball outcomes have low signal: most calibrated predictions will sit between 40% and 65%. A model that outputs 80% on a regular-season game is almost certainly overfit.

## Worked Layout

```
Folds (expanding):  train 2015-2018 -> test 2019
                    train 2015-2019 -> test 2021   (2020 treated separately: 60 games)
                    train 2015-2021 -> test 2022
                    ...
Per fold report:    games, accuracy, log loss, Brier, market log loss, difference
Pooled:             mean difference and a bootstrap 95% interval over games
Calibration:        decile table on pooled test predictions
```

Odds exist per book from July 2020 and as ESPN's final line earlier (see `fastballapi-tool`), so the market baseline has a shorter history than results. Say which seasons the comparison covers.

## Credit Planning

| Task | Credits |
|------|---------|
| One season of games (about 2,430 games, 13 calls at 200) | about 26 |
| Ten seasons of games | about 260 |
| Closing odds for 162 days of one season (`get_odds` by date) | about 1,620 |
| Closing odds for ten seasons | about 16,000: plan the budget first |

Pull results once, store them, and add features locally.

## Anti-patterns

| Mistake | Why it is wrong | Do This |
|---------|-----------------|---------|
| Random k-fold on games | Leaks the future | Walk-forward |
| Rolling mean without `shift(1)` | The current game is in the feature | Shift first |
| `get_ratings` for season N as a feature in season N | End-of-season value includes future games | Previous season's end rating |
| Final standings as features | Leakage | Games-before-date aggregates |
| Tuning on the test fold | Optimistic | Tune on an inner earlier fold |
| Reporting accuracy only | Hides probability quality | Log loss and calibration |
| Calling a 1-point gain real | Inside the standard error | Interval over games |
| Including 2020 as normal | 60-game season, different conditions | Handle separately |
| Skipping the market baseline | Can't tell if you add information | Compare with devigged closes |

## Output Format

```
Walk-forward, expanding window, test seasons 2019, 2021-2025 (2020 excluded)
Games: [N]. Model log loss 0.6xx vs prior-season Elo 0.6xx vs devigged close 0.6xx
Accuracy: x% (bootstrap 95% interval a to b); home baseline y%
Calibration (deciles, pooled): within z points in every bin with 100+ games
Leakage checks: shift(1) before rolling; no same-season ratings; no final standings
Read: does or does not beat the closing line; sample covers [seasons].
Limits: no starting pitcher, lineup or weather data in the API.
```

## What to Do Next

| You found | Next | Skill |
|-----------|------|-------|
| A model that is calibrated and competitive | Simulate bets on closing lines | `backtesting` |
| A probability and a price | EV and sizing | `edge-detection` |
| Need market probabilities | Devig | `odds-analysis` |
| A team-level luck question | Expected record | `pythagorean-record` |
