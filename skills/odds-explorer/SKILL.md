---
name: odds-explorer
description: "Compares MLB and college baseball sportsbook lines across books: moneyline, run line and total, best price, opening vs closing, vig, and pre-game line movement. Use when the user asks what the odds are, which book has the best price, how a line moved, what the closing line was, or whether the favourite won and the total went over. Do not use for devigging or implied probability math: see odds-analysis. Do not use for comparing a model to the market: see edge-detection. Do not use for player prop lines: see prop-modeling."
metadata:
  version: 1.0.0
  author: FastballAPI
---

# Odds Explorer

> **Default data tool:** FastballAPI (`fastballapi-tool`).
> `get_odds` with `game_id` (5 credits) or `date` (10 credits for the whole slate). `get_line_movement` (10 credits per game). `get_schedule` (2) for the median line of upcoming games.

You report what the books posted, find the best price, and read movement without over-reading it. FastballAPI stores snapshots of lines, not a live betting feed. Always say when the snapshot was taken.

## When to Use

- "What are the lines on Dodgers at Brewers?"
- Best moneyline, run line or total across books
- Opening vs closing line, per book
- How a line moved before first pitch
- Did the favourite win and did the total go over (finished games)
- Which book is consistently the outlier on a market

## When NOT to Use

- Removing the margin or converting odds to probabilities: `odds-analysis`
- Is this price worth betting: `edge-detection`
- Player props (hits, strikeouts, total bases): `prop-modeling`
- Anything needing a live in-game price: not available

## Commands Available

| Command | What it does | Credits |
|---------|--------------|---------|
| `get_odds` | Each book's moneyline, run line, total for a game (`game_id`, 5) or a date (`date`, 10); opening and closing per book | 5 or 10 |
| `get_line_movement` | Snapshots of each book's line before first pitch for one `game_id`; optional `provider` | 10 |
| `get_schedule` | Upcoming games with the median line across books | 2 |
| `get_game` | One game with each book's open and close inside the box score | 5 |

## Commands That Do NOT Exist

| Not available | Use instead |
|---------------|-------------|
| `get_live_odds` | `get_schedule` or `get_odds` (stored snapshots) |
| `get_best_line`, `compare_books` | Compute from the `get_odds` `books` array |
| `get_public_betting` | Not available. Infer nothing about bet splits |
| `get_closing_line` | `get_odds` for a finished game: `home_ml_close`, `total_close` |
| `get_alt_lines`, `get_first_five` | Not available. Only full-game moneyline, run line, total |
| `get_odds_history` | `get_odds` for a past `game_id` or `date` |

## Coverage

- Per-book opening and closing lines from July 2020. Before July 2020, only a final line.
- Books per game: 4 to 13 from 2015 to 2023; 6 to 8 with opening and closing since July 2020. The book list in a response is the truth: do not assume Pinnacle or FanDuel is present for an old game. Live per-season counts: https://fastballapi.com/docs/atlas.
- Pre-game snapshots (`get_line_movement`) are once a day, and hourly for games in the next two days. That is coarse: a steam move between two snapshots is invisible.
- College lines start in 2023, a median of 5 or 6 books per game, some with one.

## How It Works

**Step 1: Get the game id.** `get_schedule` (upcoming) or `get_games` (past). Do not call `get_odds` with a team name.

**Step 2: Pull the lines.**

```json
POST /v1/get_odds
{"game_id": "401809265"}
```

Real response (NYY 9, TOR 6, 2025-10-07, 8 books, one book shown, trimmed):

```json
{"data": {"games": [{"game_id": "401809265", "date": "2025-10-07",
  "home": {"abbrev": "NYY", "runs": 9}, "away": {"abbrev": "TOR", "runs": 6},
  "books": [{"provider": "DraftKings",
    "home_ml_open": -139, "home_ml_close": -174,
    "away_ml_open": 114,  "away_ml_close": 142,
    "home_close_prob": 0.635, "away_close_prob": 0.413,
    "home_run_line_close": -1.5, "run_line_home_odds": 123, "run_line_away_odds": -149,
    "total_close": 8, "over_odds": -119, "under_odds": -102}],
  "result": {"median_home_ml": -172, "median_total": 8, "favourite_won": true, "over": true}}]}}
```

Notes on the fields: `*_prob` values are raw implied probabilities (0.635 plus 0.413 is 1.048, so the margin is still in them). `result` appears for finished games and is graded against the median close.

**Step 3: Find the best price per side.** For each of home ML, away ML, over, under, run line sides, take the best number across books. Best for a favourite is the least negative; for an underdog the most positive; for a total side, the better price at the same number. A different total (7.5 at one book, 8 at another) is not a price difference; it is a different bet.

**Step 4: Show the margin.** For a two-way market, margin = implied_home + implied_away minus 1. DraftKings above: 0.635 + 0.413 = 1.048, a 4.8% margin. Fine to show; the correct removal method is in `odds-analysis`.

**Step 5: Movement.** Opening to closing per book from `get_odds` is free of extra cost. For the path in between, `get_line_movement`:

```json
POST /v1/get_line_movement
{"game_id": "401809265", "provider": "DraftKings"}
```

The response has a `movement` object keyed by book, each a list of `{captured_at, home_ml, away_ml, home_run_line, total}`. Read it as follows:

| Pattern | Reading |
|---------|---------|
| All books move the same direction | Market-wide news or money; likely real |
| One book moves, others do not | That book's own risk; wait for the others |
| Moneyline moves but total does not | Starter or lineup change is more likely than a weather change |
| Total moves 0.5 and prices shift | Weather, wind or lineup news |
| Home ML -139 to -174 across all books | In the NYY example, the whole market moved toward the home side |

Never claim "sharp money". Without bet splits or timestamps finer than hourly, you cannot know. Say "the market moved toward X".

## The Run Line and Totals

- Run line is almost always the favourite -1.5 or the dog +1.5. The price, not the number, carries the information.
- Totals in baseball are priced off the starters, park and weather. A half-run move is large. Prices on a total can differ by 20 cents between books at the same number: that is where a best-price search pays most.
- Extra innings count in totals, which makes "under" tickets live longer than they look.

## Credit Usage

| Operation | Credits |
|-----------|---------|
| One game's lines | 5 |
| A day's whole slate | 10 |
| One game's line movement | 10 |
| Median lines for the week | 2 |

Prefer the date form: a 15-game slate costs 10 credits as one `get_odds` call vs 75 as 15 calls.

## Anti-patterns

| Mistake | Why it is wrong | Do This |
|---------|-----------------|---------|
| Quoting a snapshot as live | Stored, refreshed on a schedule | Give the timestamp (`captured_at`) |
| Averaging prices across books | Mixes numbers and margins | Report each book, then best and median |
| Mixing totals | 7.5 at -110 is not 8 at -110 | Group by the number first |
| Reading hourly snapshots as tick data | Misses fast moves | State the resolution |
| Calling the open "the sharp number" | Opens are early and wide | Compare close to close for model work |
| Quoting an old game's book list from memory | Book availability changed | Read the response |

## Output Format

```
NYY vs TOR, 2025-10-07 (final: NYY 9, TOR 6). 8 books.
Moneyline close: NYY best -161 (Pinnacle), TOR best +148 (Pinnacle).
DraftKings: NYY -139 open, -174 close. Raw margin 4.8%.
Total: closed 8 at most books (ESPN BET 7.5). Over -119 / under -102 at DraftKings.
Result vs market: favourite won; over (15 runs vs 8).
Movement: every book moved toward NYY by 20 to 35 cents.
Snapshot resolution: hourly at best.
```

## What to Do Next

| You found | Next | Skill |
|-----------|------|-------|
| Prices with the margin in them | Remove it for true probabilities | `odds-analysis` |
| A model number to compare | EV and sizing | `edge-detection` |
| A closing-line sample you want to test | Historical simulation | `backtesting` |
| Game context behind a move | Matchup summary | `game-preview` |
