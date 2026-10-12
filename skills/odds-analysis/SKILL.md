---
name: odds-analysis
description: "Converts baseball betting odds between formats and removes the bookmaker margin to get true implied probabilities for moneylines, run lines, totals and player props. Use when the user asks about devigging, vig, implied probability, no-vig price, multiplicative, power or Shin methods, American vs decimal odds, or what a price really says. Prerequisite for edge detection. Do not use for browsing current lines: see odds-explorer. Do not use for finding edges against a model: see edge-detection. Do not use for calibrating model output: see walk-forward-validation."
metadata:
  version: 1.0.0
  author: FastballAPI
---

# Odds Analysis

> **Default data tool:** FastballAPI (`fastballapi-tool`).
> Mostly pure math. Use `get_odds` (5 credits per game, 10 per date) for closing prices and `get_player_props` or `get_prop_history` (10 credits) for two-way prop prices. User-supplied prices cost nothing.

You turn prices into probabilities honestly. Every price carries a margin; a fair probability needs it removed, and the method you choose matters most on lopsided markets, which baseball has plenty of (pitching mismatches, run lines, props with one juiced side).

## When to Use

- "What is -174 / +142 really saying?"
- Removing the margin from a two-way market (moneyline, over/under, run line)
- Comparing prices across books on an equal footing
- Turning a prop price pair (over -146, under +115) into a fair probability
- Explaining American vs decimal odds

## When NOT to Use

- Browsing current lines: `odds-explorer`
- Comparing a model probability to the market: `edge-detection`
- Judging whether a model's probabilities are well calibrated: `walk-forward-validation`
- Backtesting a staking plan: `backtesting`

## Commands Available

| Command | What it does | Credits |
|---------|--------------|---------|
| `get_odds` | Prices by book for a game (5) or a date (10); finished games include `result` | 5 or 10 |
| `get_player_props` | Over and under prices by book for a game or a player | 10 |
| `get_prop_history` | Closing line and prices for a player-market over time | 10 |

## Commands That Do NOT Exist

| Not available | Use instead |
|---------------|-------------|
| `get_no_vig_line`, `get_fair_odds` | Compute from `get_odds` with the methods below |
| `get_true_probability` | Compute it; the API's `*_close_prob` fields still contain the margin |
| `get_three_way_odds` | Not applicable: baseball has no draw in the moneyline |

## Conversions

```python
def implied(american):
    return -american / (-american + 100) if american < 0 else 100 / (american + 100)

def decimal(american):
    return 1 + (american / 100 if american > 0 else 100 / -american)
```

| American | Decimal | Implied |
|----------|---------|---------|
| -174 | 1.575 | 63.5% |
| +142 | 2.420 | 41.3% |
| -146 | 1.685 | 59.3% |
| +115 | 2.150 | 46.5% |
| -110 | 1.909 | 52.4% |

Payout on a winning stake S is S times (decimal minus 1). A push returns the stake.

## The Margin

For a two-way market, the sum of the implied probabilities exceeds 1. The excess is the margin (vig, overround).

Real example: DraftKings closing moneyline on NYY vs TOR (2025-10-07), NYY -174, TOR +142 from `get_odds`:

```
implied NYY = 174/274 = 0.6350
implied TOR = 100/242 = 0.4132
sum         = 1.0483     margin = 4.8%
```

The `home_close_prob` and `away_close_prob` fields in the API response (0.635, 0.413) are exactly these raw numbers. They are not fair probabilities.

## Devig Methods

All three return probabilities that sum to 1. They differ on how the margin is spread.

**1. Multiplicative (proportional).** Divide each implied probability by the sum.

```
NYY: 0.6350 / 1.0483 = 0.6058     TOR: 0.4132 / 1.0483 = 0.3942
```

Simple, and assumes the margin is spread in proportion to probability. Tends to under-correct favourites.

**2. Power.** Find k such that p_home^k + p_away^k = 1, then use the powered values.

```
k = 1.0758:  NYY 0.6136, TOR 0.3864
```

Takes more margin off the longshot than multiplicative does. Use when you believe the favourite-longshot bias is present.

**3. Shin.** Solves for the share of money from informed bettors, z, and removes margin accordingly.

```
z = 0.048:  NYY 0.6109, TOR 0.3891
```

Between the other two on this example. Preferred in the literature for horse racing and soccer markets; for baseball moneylines the three differ by under 1.5 points near 60/40.

**When the methods disagree.** The gap grows as the market gets lopsided or the margin grows. On a -300/+240 market the favourite is 71.8% (multiplicative), 73.3% (power) or 72.8% (Shin): a 1.5-point spread, which is larger than many claimed edges. Pick one method, state it, and use it everywhere. The default for this pack: **Shin or power for single bets, multiplicative only for quick checks.** Never switch methods to make an edge appear.

```python
from math import sqrt

def devig_multiplicative(p):
    s = sum(p)
    return [x / s for x in p]

def devig_power(p, tol=1e-10):
    lo, hi = 1.0, 3.0
    for _ in range(100):
        k = (lo + hi) / 2
        if sum(x ** k for x in p) > 1:
            lo = k
        else:
            hi = k
    return [x ** k for x in p]

def devig_shin(p):
    s, lo, hi = sum(p), 0.0, 0.4
    for _ in range(100):
        z = (lo + hi) / 2
        q = [(sqrt(z * z + 4 * (1 - z) * x * x / s) - z) / (2 * (1 - z)) for x in p]
        if sum(q) > 1:
            lo = z
        else:
            hi = z
    return q
```

## Devigging a Prop

Real closing line for a pitcher strikeout prop: Tarik Skubal, 2025-09-23, over 7.5 strikeouts at DraftKings, over -146, under +115 (`get_player_props`).

```
implied over  = 146/246 = 0.5935
implied under = 100/215 = 0.4651     sum = 1.0586   margin = 5.9%
fair over: multiplicative 0.5606, power 0.5661, Shin 0.5642
```

The over at -146 breaks even at a true 59.3%; the fair estimate is about 56%. That 3-point gap is the margin you pay. Prop margins usually run higher than moneyline margins, and many apparent prop edges are just margin.

Use the same line at the same book: the over at 7.5 and the under at 7.5. Do not pair an over at 7.5 from one book with an under at 8.5 from another.

## Run Lines and Totals

- Run line at -1.5: pair the two sides at the same book and devig as above. The -1.5 favourite price and the +1.5 underdog price are one two-way market.
- Totals: pair over and under at the same number. If the books post 8 and 8.5, they are different markets. A total of 8 has a push probability; if over and under are both near -110 at a whole number, some of the 52.4% implied on each is compensation for pushes. Do not renormalize it away without saying so.
- Measure the push rate from your own history of final scores against the closing total rather than assuming one. Check how `result.over` treats a push before relying on it.

## Combining Books: The Consensus Line

To get a market probability across books, devig each book first, then take the median of the fair probabilities (or weight sharper books higher). Do not average raw implied probabilities across books: books with larger margins pull the average up. For closing-line work, the median of devigged closes across the books present is a sturdy reference, but the book count changes by era (see `odds-explorer` coverage).

## Credit Usage

| Operation | Credits |
|-----------|---------|
| Convert and devig user-supplied prices | 0 |
| Pull one game's closing prices | 5 |
| Pull a day's closing prices | 10 |
| Pull a prop price pair | 10 |

## Anti-patterns

| Mistake | Why it is wrong | Do This |
|---------|-----------------|---------|
| Treating `*_close_prob` as fair | It includes the margin (sum above 1) | Devig first |
| Devigging across two different books | Not one market | Pair sides at one book |
| Averaging raw implied probabilities | Margin leaks in | Devig, then median |
| Switching devig method until an edge shows | Method shopping creates false edges | Fix the method up front |
| Ignoring pushes on a whole-number total | Understates both sides' risk | State the push share |
| Hunting a 2-point edge while methods differ by 1.5 | The method choice is most of the signal | Report the range across methods |

## Output Format

```
Market: NYY -174 / TOR +142 (DraftKings, close)
Implied: 63.5% / 41.3%  (sum 104.8%, margin 4.8%)
Fair NYY: multiplicative 60.6%, power 61.4%, Shin 61.1%
Range across methods: 0.8 points. Method used: Shin.
```

## What to Do Next

| You found | Next | Skill |
|-----------|------|-------|
| Fair probability for a side | Compare to your model | `edge-detection` |
| Fair probabilities across years of closes | Test a strategy | `backtesting` |
| Prop fair probability | Build the projection to beat it | `prop-modeling` |
| Prices not yet pulled | Fetch and compare books | `odds-explorer` |
