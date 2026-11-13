---
name: game-lookup
description: "Finds MLB and college baseball games by date, date range, team or season, and pulls one game in full: line score, box score, starters, bullpen usage, each book's line and the win-probability range. Use when the user asks for scores, last night's games, a team's schedule or results, the box score for a game, who pitched, or what the line was. Do not use for team trends over a season: see team-analysis. Do not use for odds comparison across books: see odds-explorer. Do not use for pre-game analysis: see game-preview."
metadata:
  version: 1.0.0
  author: FastballAPI
---

# Game Lookup

> **Default data tool:** FastballAPI (`fastballapi-tool`).
> `get_games` (2 credits) for lists, `get_schedule` (2) for the coming days, `get_game` (5) for one game in full.

You find the right game fast and report it plainly. Most mistakes here are wrong dates (time zones), wrong ids and forgetting the postseason.

## When to Use

- Scores for a date, a week or a team's recent games
- A team's upcoming schedule with the median line
- A box score: batting lines, pitching lines, line score
- "Who started?", "How many pitches did the starter throw?", "Who closed?"
- Whether the favourite won or the total went over for a finished game
- Finding a `game_id` for another skill

## When NOT to Use

- Season-long team form or rankings: `team-analysis`
- Comparing every book's price or line movement: `odds-explorer`
- A pre-game report with context: `game-preview`
- Play-by-play detail or run value: `run-value-analysis`

## Commands Available

| Command | What it does | Credits |
|---------|--------------|---------|
| `get_games` | Games by `season`, `season_type`, `team`, `date`, `from`/`to`, `status`; `limit` up to 200, `offset` to page | 2 |
| `get_schedule` | Next `days` (1 to 30, default 7), optional `team`, with median moneyline, run line, total | 2 |
| `get_game` | One game: line score, batting, pitching, each book's open and close, win-probability range | 5 |
| `list_teams` | Team ids and abbreviations | 1 |

All four accept `league` (`mlb` default, `ncaabase`). College postseason games carry a `round` field.

## Commands That Do NOT Exist

| Not available | Use instead |
|---------------|-------------|
| `get_boxscore`, `get_scores` | `get_game`, `get_games` |
| `get_live_scores` | Not available. Data is final scores plus daily schedule snapshots |
| `get_probable_pitchers` | Not available. Ask the user or read the team's own announcement |
| `get_head_to_head` | `get_games` with `team`, then filter opponents in code |
| `get_team_schedule` | `get_schedule` with `team` for future, `get_games` with `team` for past |

## Date and Season Rules

- Dates are US Eastern, `YYYY-MM-DD`. A night game that ends after midnight Eastern still belongs to the starting date.
- `starts_at` is UTC. Convert before telling a user a first pitch time.
- Omit `season` for the latest. In January the latest season is last year's.
- `season_type` is `regular` or `postseason`; omit it and you get both. A World Series game and an April game come back from the same call.
- `get_games` returns newest first. For a team's last 10, use `team` plus `limit: 10`.

## How It Works

**Step 1: Resolve the team.** Use the abbreviation (`NYY`). If unsure, `list_teams` (1 credit). Do not pass "Yankees".

**Step 2: Pick the list call.**

- Past games: `get_games` with `date`, or `from` and `to`, or `team` and `season`.
- Future games: `get_schedule` with `days` and optional `team`.
- Only finals: `status: "final"`. Only unplayed: `status: "scheduled"`.

```json
POST /v1/get_games
{"team": "NYY", "season": 2025, "limit": 2}
```

Real response shape (trimmed):

```json
{"data": {"games": [{
  "game_id": "401809266", "season": 2025, "season_type": "postseason",
  "date": "2025-10-08", "status": "final",
  "home": {"abbrev": "NYY", "runs": 2, "hits": 6, "errors": 1},
  "away": {"abbrev": "TOR", "runs": 5, "hits": 12, "errors": 0},
  "innings": 9, "extra_innings": false,
  "venue": "Yankee Stadium", "attendance": 47823
}], "count": 2, "next_offset": 2}}
```

**Step 3: Page when needed.** `next_offset` is the value for the next call's `offset`. A full 162-game team season needs `limit: 200` once.

**Step 4: Go deep on one game.** `get_game` with `game_id` returns `batting`, `pitching`, `odds` and `win_probability`. In `pitching`, a `starter` value of true marks the starter; `outs` and `ip` give the length; `pitches` and `strikes` give the workload. The `odds` array has each book's open and close.

**Step 5: Report the result in baseball terms.** Lead with the score and the swing factor (starter line, big inning, bullpen). Then the table.

## Reading a Finished Game

| Question | Where to look |
|----------|---------------|
| Starter line and bullpen use | `pitching` rows: `starter`, `ip`, `er`, `so` |
| Did the bullpen hold | non-starter `pitching` rows, `r` and `er` |
| Big inning | `get_plate_appearances` with `game_id` (10 credits), `inning` filter |
| Did the favourite win | `get_odds` with `game_id`: `result.favourite_won`, `result.over` against the median close |
| How lopsided was the win probability | `win_probability.home_min` and `home_max` (2019 on) |

## Edge Cases

- **Doubleheaders:** two games the same date for a team. Use `game_id`, never team plus date as a key.
- **Extra innings:** `innings` above 9 and `extra_innings` true. Pitcher workloads run long.
- **Postponed or suspended games:** may show `scheduled` with no runs. Do not report a score.
- **Shortened seasons:** 2020 has 60 games per team. Do not compare counting stats to 162-game seasons.
- **College:** `league: "ncaabase"`. Not every Division I game exists. Some games have scores but no box score or play-by-play. Say so rather than inventing a pitching line.

## Credit Usage

| Operation | Credits |
|-----------|---------|
| A date's scores | 2 |
| A team's season of games (`limit` 200) | 2 |
| This week's schedule with lines | 2 |
| One full game | 5 |
| Look up ids once | 1 |

## Anti-patterns

| Mistake | Why it is wrong | Do this |
|---------|-----------------|---------|
| Searching games by team name | Tool expects abbreviation or id | `list_teams` once |
| Calling `get_game` for every game in a series | 5 credits each | `get_games` first, `get_game` for the one that matters |
| Reading `get_schedule` lines as live | Daily snapshots | State the snapshot is stored |
| Using local time for the date | Late games shift a day | Use US Eastern dates |
| Treating a missing box score as a zero line | College coverage is partial | Report "no box score in the data" |

## Output Format

```
NYY 2, TOR 5 (final, Oct 8 2025, postseason)
Yankee Stadium. 9 innings.
Hits: TOR 12, NYY 6. Errors: NYY 1.
Starters and key relievers: [from get_game pitching rows]
Closing median line: NYY -172, total 8 (from get_odds result block)
Result vs market: favourite lost, total stayed under (7 runs)
```

## What to Do Next

| You found | Next | Skill |
|-----------|------|-------|
| A game worth understanding | Pre-game or recap context | `game-preview` |
| A team on a streak | Season picture and luck check | `team-analysis`, `pythagorean-record` |
| A big swing inning | Run value per plate appearance | `run-value-analysis` |
| Line moved before first pitch | Book-by-book movement | `odds-explorer` |
