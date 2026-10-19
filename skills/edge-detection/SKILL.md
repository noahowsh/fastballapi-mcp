---
name: edge-detection
description: "Compares a calibrated model probability with a baseball market price to estimate expected value, then sizes stakes with fractional Kelly and measures closing line value. Use when the user asks if a price is worth betting, what the EV is, how much to stake, how to line shop across books, what closing line value (CLV) is, or how many bets it takes to trust an edge. Needs a model probability. Do not use to browse lines: see odds-explorer. Do not use to devig prices: see odds-analysis. Do not use to test a model over history: see backtesting."
metadata:
  version: 1.0.0
  author: FastballAPI
---

# Edge Detection

> **Default data tool:** FastballAPI (`fastballapi-tool`).
> `get_odds` (5 per game, 10 per date) for game prices, `get_player_props` (10) for prop prices, `get_line_movement` (10) and `snapshot_type: "opening"` for the path to the close. Your own model output and prices cost nothing.

You turn a probability and a price into an estimate of expected value, and you are blunt about how uncertain that estimate is. An edge here is an estimate, not a promise. Baseball markets are efficient, margins are 4% to 6%, and variance is large: a 55% bettor can lose money over hundreds of bets.

## When to Use

- "My model says 60%. Is -146 a bet?"
- Expected value of a price, and the break-even probability
- Line shopping: which book gives the best EV on the same bet
- Kelly sizing, fractional Kelly, and a daily exposure cap
- Closing line value: did you beat the close
- How many bets before an edge is distinguishable from luck

## When NOT to Use

- No model probability yet: `walk-forward-validation`, `prop-modeling`
- Removing the margin: `odds-analysis`
- Simulating a strategy on history: `backtesting`
- Viewing the lines: `odds-explorer`

## Commands Available

| Command | What it does | Credits |
|---------|--------------|---------|
| `get_odds` | Every book's moneyline, run line, total for a game or a date | 5 or 10 |
| `get_player_props` | Prop prices by book (`closing` or `opening`) | 10 |
| `get_line_movement` | Pre-game snapshots per book (for CLV paths) | 10 |
| `get_prop_history` | Past closing lines vs results for a player and market | 10 |
| `get_games` | Final scores, to grade bets | 2 |

## Commands That Do NOT Exist

| Not available | Use instead |
|---------------|-------------|
| `get_ev`, `get_best_bet`, `get_picks` | Compute EV from a probability and a price |
| `get_clv` | Compare your taken price with the devigged close from `get_odds` / `get_player_props` |
| `get_live_odds` | Not available. Snapshots only |
| `get_public_betting` | Not available |
| `get_kelly` | Compute below |

## The Math

```python
def decimal(american):
    return 1 + (american / 100 if american > 0 else 100 / -american)

def ev(p, american):
    b = decimal(american) - 1       # profit per unit staked
    return p * b - (1 - p)          # per unit staked

def breakeven(american):
    return 1 / decimal(american)

def kelly(p, american):
    b = decimal(american) - 1
    return max(0.0, (b * p - (1 - p)) / b)
```

**Break-even.** The probability at which EV is zero. At -146 it is 59.3%; at -110 it is 52.4%; at +115 it is 46.5%. Your probability must clear this, and then clear your own error on top.

**Worked example with real prices.** Tarik Skubal, over 7.5 strikeouts, 2025-09-23 closing, from `get_player_props`:

| Book | Over | Under |
|------|------|-------|
| DraftKings | -146 | +115 |
| BetMGM | -150 | +115 |
| FanDuel | -132 | +100 |

Suppose your model says the over is 60%. (A hypothetical, for arithmetic.)

```
DraftKings -146: b = 0.685   EV = 0.60 x 0.685 - 0.40 = +1.1% per unit
FanDuel    -132: b = 0.758   EV = 0.60 x 0.758 - 0.40 = +5.5% per unit
```

Same bet, same model, five times the EV: that is line shopping. The market's fair over was about 56% (see `odds-analysis`), so your 60% is a 4-point disagreement. That 4-point gap shows up as only +1.1% EV at the worst price because the margin eats most of it. The honest conclusion: on a 4-point disagreement the answer depends on the price you can get and on whether your 60% is accurate to within a few points. It is usually not.

## Does the Model Deserve the Bet?

Before computing EV, check what the probability is worth:

1. Was it calibrated on out-of-sample data (see `walk-forward-validation`)? If not, stop.
2. How far is it from the devigged market? A model more than 5 points from a liquid market on a major-league moneyline is more likely wrong than right. Check inputs: the starting pitcher, a lineup change, an injury, a data lag.
3. How big is the estimate's own error? A model evaluated on a few hundred games has an error of several points on any one prediction.
4. Subtract a haircut. A common conservative practice: shrink the model probability toward the market by 25% to 50% before computing EV, then compare. If the bet only works with an unshrunk model probability, pass.

Minimum edge: require EV of at least 3% to 5% after shrinkage for a game bet, and say plainly that small edges are indistinguishable from model error.

## Kelly Sizing

Full Kelly maximizes long-run growth if your probabilities are exactly right. They never are.

```
f* = (b p - q) / b
```

Worked: model 58%, price -110 (b = 0.909): f* = 11.8% of bankroll. Full Kelly at 11.8% would be reckless. Use a fraction.

| Fraction | Stake | Use |
|----------|-------|-----|
| Full Kelly | 11.8% | Do not |
| Half Kelly | 5.9% | Aggressive |
| Quarter Kelly | 2.95% | Default |
| Fifth Kelly or flat 0.5% to 1% | | If your model is new |

Rules:

1. Size from the shrunk probability, not the raw one.
2. Cap total daily exposure (for example 5% of bankroll across all bets).
3. Correlated bets are not independent: two props from the same game, a side and a total, or a pitcher's strikeouts and outs. Size them as one position.
4. Never raise stakes after a loss. Stake depends on edge and bankroll, not on mood.
5. A drawdown of 25% of bankroll is a review trigger: audit calibration and inputs before continuing.

## Closing Line Value

CLV asks whether the market moved toward your price. It converges faster than profit.

```
clv_points = fair_close_prob(your side) - implied_prob(price you took)
```

with the close devigged (see `odds-analysis`). If you took the over at -140 (implied 58.3%) and the closing market was fair at 60.5%, your CLV is +2.2 points: you got a better price than the final information justified.

Data you can get from FastballAPI: `get_odds` returns per-book `*_open` and `*_close`; `get_player_props` takes `snapshot_type` of `opening` or `closing`; `get_line_movement` gives snapshots on the way (once a day, hourly for the next two days). The early price you actually bet at is your own log (see the staking record you keep); a stored opening line is only a proxy.

Interpret it honestly:
- Positive CLV over 200+ bets is a good sign your process sees something early.
- Positive CLV with losing results is variance more often than not.
- Negative CLV over a large sample means the market disagrees with your model after you bet. Pause and investigate.
- CLV against a single book's close can mislead; use the median devigged close across books.

## Is the Edge Real? Sample Size

Win-rate evidence against the break-even rate for -110 bets (52.4%), one-sided, 5% level. These are computed with `n = z^2 x w(1-w) / (w - 0.524)^2` using z = 1.645:

| True win rate | Bets needed |
|---------------|-------------|
| 53% | about 17,600 |
| 55% | about 980 |
| 57% | about 310 |
| 60% | about 110 |

A 53% bettor needs more bets than a person can place in a lifetime to prove it from results. That is why CLV and calibration on large model samples (thousands of games) matter more than a P&L over 60 bets. If someone shows an edge from 40 bets, the confidence interval swallows it: at 40 bets and 60% observed, the 95% interval for the true rate runs roughly 45% to 75% (normal approximation).

## Workflow for a Slate

1. Pull prices for the day (`get_odds` with `date`, 10 credits; props per game 10).
2. Devig each book; take a median fair probability as the market (see `odds-analysis`).
3. Join your model probabilities (shrunk).
4. Compute EV at the best available price per side; keep only EV above the threshold.
5. Check correlation and daily exposure; size with quarter Kelly.
6. Log: bet, model probability, price taken, book, time, closing fair probability later.

## Credit Usage

| Operation | Credits |
|-----------|---------|
| A day's game prices | 10 |
| Props for one game | 10 |
| Opening vs closing for a prop | 20 (two snapshots) |
| EV, Kelly, CLV math | 0 |

## Anti-patterns

| Mistake | Why it is wrong | Do This |
|---------|-----------------|---------|
| "Model says 70%, line implies 55%: huge edge" | Almost always a model or data error | Check inputs; shrink |
| Full Kelly | One miscalibration wrecks bankroll | Quarter Kelly |
| Judging by win rate | Ignores prices | Report ROI, average price, CLV |
| Taking the best of several models | Selection bias | Fix the model before the slate |
| Betting a side because the line moved | Movement is information the price already has | Compare to the close, not to the move |
| Ignoring the margin | Margin is most of a small edge | Devig, then compute EV |
| Doubling after a loss | Chasing | Fixed fractional rule |
| 40 bets, "it works" | Not enough data | Interval and CLV |

## Output Format

```
Skubal over 7.5 K (2025-09-23 close), model 60% (shrunk 58%)
Best price: FanDuel -132 (break-even 56.9%), DK -146 (59.3%)
EV at FanDuel with shrunk 58%: +1.9%; at DraftKings: -2.3%
Quarter Kelly at FanDuel: 0.6% of bankroll, below the 3% EV threshold: pass
Market fair over ~56%; disagreement 2 points after shrinkage: inside model error.
Verdict: no actionable edge. Log the price for CLV tracking.
```

## What to Do Next

| You found | Next | Skill |
|-----------|------|-------|
| An edge that survives shrinkage | Test it over history | `backtesting` |
| Doubt about the probability | Calibration and leakage | `walk-forward-validation` |
| Prop inputs needed | Projection | `prop-modeling` |
| Prices not yet devigged | Remove the margin | `odds-analysis` |
