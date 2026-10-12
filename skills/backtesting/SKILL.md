---
name: backtesting
description: "Tests a baseball betting strategy on history with walk-forward discipline: closing lines from FastballAPI odds history, prop lines and results from prop history, flat and fractional-Kelly staking, ROI, drawdown, bootstrap intervals, closing line value and edge decay. Use when the user asks whether a strategy would have made money, how to backtest MLB moneylines, totals or props, or how big a sample they need. Refuses in-sample tests. Do not use to validate model accuracy alone: see walk-forward-validation. Do not use for a live bet today: see edge-detection."
metadata:
  version: 1.0.0
  author: FastballAPI
---

# Backtesting

> **Default data tool:** FastballAPI (`fastballapi-tool`).
> `get_odds` with `date` (10 credits per day, all games) or `game_id` (5), with opening and closing per book and a graded `result`. `get_prop_history` (10 credits, up to 200 games per player-market) for props. `get_games` (2) for scores.
> **Credit warning:** a full regular season of game-by-game odds is about 2,430 games x 5 = about 12,000 credits; by date it is about 180 days x 10 = about 1,800. Plan the pull, store it, and test locally.

You try to falsify the strategy. A backtest that cannot lose proves nothing. Every number below is a procedure; none is a result.

## When to Use

- "Would betting every home underdog under +130 have made money?"
- "Does my total model beat the closing line?"
- "How did strikeout overs perform against the closing line since 2023?"
- Bootstrap intervals on ROI; drawdown; edge decay over a season
- How big the sample must be to say anything

## When NOT to Use

- Model accuracy without bets: `walk-forward-validation`
- A bet you are considering tonight: `edge-detection`
- Reading lines: `odds-explorer`
- Prop projection mechanics: `prop-modeling`

## Commands Available

| Command | What it does | Credits |
|---------|--------------|---------|
| `get_odds` | Per-book open and close for a game or a date, plus `result` with `favourite_won`, `over`, `median_home_ml`, `median_total` for finished games | 5 or 10 |
| `get_prop_history` | Per game: closing `line`, `open_line`, prices, `actual`, `result`, `margin`, summary `over_rate` | 10 |
| `get_player_props` | Opening or closing prop prices by book | 10 |
| `get_games` | Scores and results | 2 |
| `get_line_movement` | Pre-game snapshots (for CLV by time) | 10 |

## Commands That Do NOT Exist

| Not available | Use instead |
|---------------|-------------|
| `get_backtest`, `get_strategy_performance` | Build the simulation below |
| `get_historical_odds` | `get_odds` with a past `date` or `game_id` |
| `get_closing_line` | `get_odds`: `*_close` fields; props: `snapshot_type: "closing"` |
| `get_historical_lineups`, `get_probable_pitchers` | Not available. Strategies keyed on the starter cannot be backtested from this API alone |
| `get_bet_results` | Join odds and scores yourself |

## Coverage That Limits the Test

- Per-book opening and closing lines: July 2020 onward (The Odds API), plus ESPN's from 2024. Before that, only ESPN's final line, so you cannot measure CLV before mid-2020.
- Number of books varies by year. A strategy that shops "the best price" gets a different book set in 2021 than in 2025. State the book set.
- Props: May 2023 onward; markets hits, home runs, total bases, RBI, pitcher strikeouts, pitcher outs. No props for college.
- The 2020 season has 60 games per team and unusual conditions. Report it separately or exclude it, and say which.
- Coverage by season: https://fastballapi.com/docs/atlas. Check it before you promise a window.

## Rules Before Any Run

1. **Out-of-sample only.** If the strategy was designed after looking at the same seasons, it is in-sample. Pre-register the rule, then test seasons the rule has not seen. Better: design on seasons A, freeze, test on B.
2. **Bet at a price you could have gotten.** Closing lines are the best available information, and you could not always bet them. Test twice: at the opening price (realistic for an early bettor) and at the closing price (the benchmark), and report both.
3. **One rule, set in advance.** Thresholds searched after seeing results are in-sample.
4. **Count every bet.** Report the number of bets and the number of rules you tried.

## The Simulation Loop

```python
rows = []   # one per candidate bet, built from get_odds + your model, sorted by date
bankroll, units = 100.0, 0.0
for r in sorted(rows, key=lambda r: r["date"]):
    dec = decimal(r["price"])                   # price you could have gotten
    stake = 1.0                                 # flat; or fractional Kelly on r["p_model"]
    won = r["won"]                              # from get_odds result / get_games
    pnl = stake * (dec - 1) if won else -stake
    units += pnl
```

Joins:
- Moneyline: `result.favourite_won` is graded against the median close, so for a specific side and book, use final scores from `get_games` or `get_game` and the book's own price.
- Totals: `result.over` is graded against the median closing total. For a specific book's total, compare `runs home + runs away` to that book's `total_close`. A whole-number total can push: grade a push as a refund, not a loss.
- Props: `get_prop_history` rows have `result` of over, under or push against the closing line, plus `actual`.

## Metrics

| Metric | Formula | Notes |
|--------|---------|-------|
| Bets | count | Always first |
| Units | sum of pnl | Flat staking |
| ROI | units / total staked | Report with an interval |
| Hit rate | wins / (wins + losses) | Meaningless without the average price |
| Average price | mean decimal odds | Pair with hit rate |
| Max drawdown | largest peak-to-trough drop | In units; show the date range |
| CLV | fair_close_prob - implied_prob_taken | Needs open and close (see `edge-detection`) |
| Edge decay | ROI/CLV by month or by season | A real edge fades as the market learns |

## Bootstrap Interval

```python
import numpy as np
rng = np.random.default_rng(0)
pnl = np.array([...])                           # per-bet profit in units
boots = [rng.choice(pnl, size=len(pnl), replace=True).mean() for _ in range(5000)]
lo, hi = np.percentile(boots, [2.5, 97.5])      # per-bet ROI interval
```

Report as: "ROI 3.1% on 1,420 bets, 95% interval -2.9% to 9.0%". An interval that includes zero means the result is not established. Bets within the same game or day are correlated: resample by day, not by bet, when they cluster.

## What a Believable Result Looks Like

- ROI near zero or negative at opening and closing prices for most simple rules. Most simple rules lose by about the margin.
- Positive CLV and flat results over a modest sample: encouraging, still unproven.
- A large ROI on a short sample: suspect it. Check for leakage, price availability and dropped games.

Sample sizes for a win-rate edge at -110 prices (see `edge-detection`) run from about 110 bets (60% win rate) to about 17,600 (53%). Most backtest windows cannot resolve small edges at all.

## Props Backtest Recipe

1. Pick a market (for example `pitcher_strikeouts`) and a set of players with long histories.
2. `get_prop_history` per player (10 credits, up to 200 games). Pool the rows.
3. Create your probability for each row using only data before that date.
4. Compare with the market: Brier score and log loss of your probability vs the devigged closing probability (`odds-analysis`).
5. Simulate flat bets only where you disagree with the market by more than your threshold, at the closing price.
6. Report bets, ROI with interval, CLV vs opening, and the over rate vs `avg_line` as a sanity check.

Be careful with survivorship: players with long histories are the ones who stayed healthy and good. Pooling only them overstates over rates for a general population.

## Common Traps

| Trap | Why it breaks the test |
|------|------------------------|
| Using season-end ratings as features | Leaks the future (see `walk-forward-validation`) |
| Choosing the best book after the fact | Best price in hindsight is not a price you knew |
| Closing price as your price | Not always available |
| Dropping games with missing odds | Selects covered games; report the coverage rate |
| Ignoring pushes | Distorts hit rate and ROI |
| Testing 50 rules, reporting the best | Multiple comparisons; report all |
| Mixing 2020 with normal seasons | Different environment |
| Calling a hit rate profitable without prices | Hit rate depends on price |

## Credit Planning

| Task | Credits |
|------|---------|
| One season of odds by date | about 1,800 |
| One season of odds game by game | about 12,000 |
| 50 player-market prop histories | 500 |
| Scores for a season | about 26 |

If the user's credits do not cover it, scale the test (a month, a sample of dates, a narrower rule) and say how the scale limits the conclusion. Do not trim the method.

## Anti-patterns

| Mistake | Why it is wrong | Do This |
|---------|-----------------|---------|
| Testing on the data used to design the rule | In-sample | Freeze, then test |
| One number, no interval | False precision | Bootstrap by day |
| Only closing prices | Overstates what you could bet | Also opening |
| "It would have made X units" with 30 bets | Not evidence | State the interval |
| Skipping the market baseline | Cannot tell skill from the book's margin | Compare with devigged closes |

## Output Format

```
Strategy: [rule, written before the run]. Window: [dates]. Books: [set].
Bets: N (rules tried: K). Pushes: P.
At opening price: ROI x% (95% interval a to b by day-bootstrap), units u, max drawdown d.
At closing price: ROI y% (interval c to d).
CLV vs open: +z points, N bets with both prices.
Edge decay: first half ROI vs second half.
Read: [established / not established]. Sample note: [what N can and cannot resolve].
```

## What to Do Next

| You found | Next | Skill |
|-----------|------|-------|
| Interval includes zero | Collect more data or stop | `walk-forward-validation` |
| Promising CLV | Live-test small with logging | `edge-detection` |
| Model accuracy issue | Fix validation | `walk-forward-validation` |
| Prop model needs inputs | Projection method | `prop-modeling` |
