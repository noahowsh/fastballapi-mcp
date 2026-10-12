---
name: fastballapi-tool
description: "Default data source for the FastballAPI skills. Routes every MLB and college baseball data request to the right one of the 20 FastballAPI tools, with credit costs, parameters, coverage limits and the response envelope. Use when any other skill needs games, box scores, standings, player stats, pitches, plate appearances, spray charts, odds or player props. Do not use for analysis, modeling or bet decisions: see pitch-mix-analysis, run-value-analysis, prop-modeling or edge-detection."
metadata:
  version: 1.0.0
  author: FastballAPI
  user-invocable: false
---

# FastballAPI Tool

Every other skill in this pack gets its data here. This skill owns the 20 tools, picks the cheapest call that answers the question, and states what the data cannot do.

**Connect:** MCP URL `https://mcp.fastballapi.com/mcp` (add `?key=YOUR_API_KEY`, or send the key as an `x-api-key` header). College baseball has its own MCP URL, `https://mcp.fastballapi.com/mcp/ncaabase`.
**REST:** `POST https://mcp.fastballapi.com/v1/<tool>` with a JSON body and the header `x-api-key: YOUR_API_KEY`. College: pass `"league": "ncaabase"` in the body.
**Free tier:** 500 credits every month, no card. Key at https://fastballapi.com/signup. Plans: https://fastballapi.com/pricing.

## Response Envelope

Every REST response is wrapped as `{"data": ...}`. Read `body["data"]` first. Errors come back as `{"error": "..."}` with an HTTP error status. Headers `X-Credits-Used` and `X-Credits-Remaining` report the spend.

```json
{"data": {"players": [{"player_id": "32081", "name": "Gerrit Cole", "position": "SP", "bats": "R", "team": "NYY"}], "count": 1}}
```

Code examples in these skills write `get_x(**args)` for a thin helper that POSTs the tool name and arguments to the REST endpoint and returns the parsed JSON (so `get_x(...)["data"]` is the payload).

## The 20 Tools

| Tool | What it returns | Credits | Skills that use it |
|------|-----------------|---------|--------------------|
| `list_teams` | Team ids, abbreviations, colours for a season | 1 | all (id lookup) |
| `search_players` | Player ids by (partial) name | 1 | player-scouting, prop-modeling |
| `get_games` | Games with runs, hits, errors by season, date, range, team | 2 | game-lookup, backtesting |
| `get_schedule` | Next 1 to 30 days of games with the median line | 2 | game-lookup, game-preview |
| `get_standings` | Record, splits, run differential, Pythagorean win pct | 2 | pythagorean-record, team-analysis |
| `get_injuries` | Latest injury report (MLB only) | 2 | game-preview, player-scouting |
| `get_ratings` | Our team Elo ratings, ranked | 2 | team-analysis, walk-forward-validation |
| `get_game` | One game: line score, every batting and pitching line, books, win probability | 5 | game-lookup, game-preview |
| `get_player` | Season-by-season batting and pitching, with RE24 | 5 | player-scouting |
| `get_player_games` | A player's game log (batting and pitching) | 5 | prop-modeling, player-scouting |
| `get_leaders` | Qualified season leaders for 13 stats | 5 | player-scouting |
| `get_team_stats` | Runs for and against, team batting and opponents' batting | 5 | team-analysis, pythagorean-record |
| `get_pitch_mix` | A pitcher's arsenal: usage, velocity, whiff rate, ball rate (MLB only) | 5 | pitch-mix-analysis, prop-modeling |
| `get_odds` | Every book's moneyline, run line, total: one game (5) or one date (10) | 5 or 10 | odds-explorer, odds-analysis, backtesting |
| `get_plate_appearances` | Play-by-play with base-out state, batted ball, win probability, RE24 | 10 | run-value-analysis |
| `get_pitches` | Pitch-by-pitch: count, type, velocity, location, result (MLB only) | 10 | pitch-mix-analysis |
| `get_spray_chart` | Balls in play by trajectory and field, optional x/y points (MLB only) | 10 | spray-chart-analysis |
| `get_line_movement` | Pre-game snapshots of each book's line | 10 | odds-explorer, edge-detection |
| `get_player_props` | Prop lines by book, opening or closing (MLB only) | 10 | prop-modeling |
| `get_prop_history` | A player's prop line vs the result, game by game (MLB only) | 10 | prop-modeling, backtesting |

## Tool Selection

| You need | Use | Not this |
|----------|-----|----------|
| Last night's scores | `get_games` with `date` | `get_schedule` (future only) |
| This week's games and the median line | `get_schedule` | `get_odds` per game |
| One game's box score plus every book's line | `get_game` | `get_games` then `get_odds` |
| A pitcher's arsenal and whiff rates | `get_pitch_mix` (5) | `get_pitches` (10, only for pitch-level detail) |
| Where Judge hits the ball | `get_spray_chart` | `get_plate_appearances` |
| Win probability and run value per plate appearance | `get_plate_appearances` | `get_game` (range only) |
| Closing hits line and the result | `get_prop_history` | `get_player_props` in a loop |
| Standings with Pythagorean record | `get_standings` | computing from `get_games` |

## Commands That Do NOT Exist

| Not available | Use instead |
|---------------|-------------|
| `get_live_odds`, `get_live_scores` | `get_schedule` (stored snapshots, refreshed daily; not a live feed) |
| `get_boxscore` | `get_game` |
| `get_team` or `get_roster` | `list_teams` for ids; there is no roster endpoint |
| `get_probable_pitchers`, `get_lineups` | Not available. `get_game` shows starters after the game only |
| `get_statcast`, `get_exit_velocity`, `get_spin_rate` | Not available. No exit velocity, launch angle or spin |
| `get_park_factors`, `get_weather` | Not available |
| `get_war` | Not available. `get_player` has RE24; WAR is not computed |
| `get_pitcher_stats` | `get_player` (season line) or `get_leaders` |
| `search_games` | `get_games` with filters |

## Coverage Limits to State Out Loud

- **MLB games and box scores:** 2015 to the current season. Pitch-by-pitch: every pitch since 2018, and about 98 to 99% of each season's pitches for 2015 to 2017. Pitch type and velocity are on 96% or more of pitches (99.8% or more from 2020).
- **Win probability** on plate appearances starts in 2019. Earlier seasons return null.
- **Sportsbook lines:** 4 to 13 books per game from 2015 to 2023; opening and closing lines per book from July 2020 (The Odds API), and from 2024 from ESPN too. Before July 2020, only ESPN's final line. Check https://fastballapi.com/docs/atlas for the live per-season counts before you promise a backtest window.
- **Player props:** from May 2023. Markets: `batter_hits`, `batter_home_runs`, `batter_total_bases`, `batter_rbis`, `pitcher_strikeouts`, `pitcher_outs`. No props for college.
- **College baseball** (`league: "ncaabase"`): the Division I games ESPN carries, not every game. No pitch rows, no spray charts, no injuries, no props. Box scores and play-by-play exist for part of each season (about 800 to 1,550 games a season since 2021). Sportsbook lines from 2023.
- `get_pitches`, `get_pitch_mix`, `get_spray_chart`, `get_injuries`, `get_player_props` and `get_prop_history` take no `league` argument. They are MLB only.

## Identifiers

- **Teams:** abbreviation (`NYY`, `LAD`) or team id. Call `list_teams` once to confirm; the Athletics abbreviate as `ATH` in recent seasons.
- **Players:** the ESPN athlete id as a string. Always get it from `search_players`. Do not guess ids. Judge is `33192`, Skubal `42409`, found that way.
- **Games:** the ESPN game id as a string (`401809265`), from `get_games` or `get_schedule`.
- **Seasons:** a four-digit year. Omit `season` for the latest. MLB regular season runs late March to September, postseason in October, so "this season" in November is the year just finished.

## Cost Planning

| Task | Calls | Credits |
|------|-------|---------|
| Find a player and pull his season line | `search_players` + `get_player` | 6 |
| Pitcher arsenal | `search_players` + `get_pitch_mix` | 6 |
| Pitcher strikeout prop history for a season | `search_players` + `get_prop_history` | 11 |
| One game preview | `get_game` + `get_standings` + `get_ratings` | 9 |
| A day of odds | `get_odds` with `date` | 10 |
| A season of odds, game by game | about 2,430 regular-season games x 5 | about 12,000 |

State the cost before any loop. `get_odds` with `date` (10 credits for the whole slate) beats five or more single-game calls. Props accept `estimate_only: true` to return the price without being charged.

## Anti-patterns

| Mistake | Why it hurts | Do this |
|---------|--------------|---------|
| Guessing a player id from memory | Silent wrong player | `search_players` first (1 credit) |
| Calling `get_pitches` for an arsenal summary | 10 credits and thousands of rows | `get_pitch_mix` (5 credits) |
| Passing `league: "ncaabase"` to a pitch tool | Not offered for college | Say the data does not exist |
| Looping `get_player_props` over many dates | 10 credits per game returned | `get_prop_history` returns up to 200 games for 10 |
| Treating `get_schedule` lines as live | Snapshots refreshed daily | Say when the snapshot was taken |
| Skipping the `{"data": ...}` envelope | Code reads `None` | Unwrap `data` first |

## What to Do Next

| You retrieved | Next | Skill |
|---------------|------|-------|
| Scores or schedule | Look deeper at one game | `game-lookup`, `game-preview` |
| Standings | Check luck vs run differential | `pythagorean-record` |
| Pitcher arsenal | Whiff and usage reading | `pitch-mix-analysis` |
| Plate appearances | Run value, leverage | `run-value-analysis` |
| Odds | Compare books, remove the margin | `odds-explorer`, `odds-analysis` |
| Props | Model and price them | `prop-modeling`, `edge-detection` |
