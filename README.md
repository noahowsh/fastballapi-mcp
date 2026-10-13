# FastballAPI MCP server

[![Smithery](https://img.shields.io/badge/Smithery-listed-ff5601?style=flat-square)](https://smithery.ai/servers/noahowsh/FastballAPI) [![MCP Registry](https://img.shields.io/badge/MCP%20Registry-listed-0b7285?style=flat-square)](https://registry.modelcontextprotocol.io/v0/servers?search=io.github.noahowsh/fastballapi)

**The baseball data API.** Pitch-by-pitch data with pitch type, velocity and location, every plate appearance with base-out state and the batted ball, box scores, standings, our own ratings and run values, sportsbook lines by book and MLB player prop lines. MLB since 2015 plus the NCAA Division I games ESPN carries. REST API and MCP server. 500 free credits every month, no card.

Website: https://fastballapi.com · Docs: https://fastballapi.com/docs · Get a key: https://fastballapi.com/signup

```
You:    "What is Gerrit Cole's whiff rate by pitch type this season?"
Claude: [calls get_pitch_mix]

You:    "How often did Aaron Judge homer on a 3-2 count in 2025?"
Claude: [calls get_plate_appearances]

You:    "How often has Shohei Ohtani gone over his total bases line since 2023?"
Claude: [calls get_prop_history]
```

## Skills

This repo also ships 16 free Claude skills in [`skills/`](skills/) that turn Claude into a baseball analyst: pitch mix and whiff rate, run value, spray charts, Pythagorean record, game previews, odds analysis, prop modeling (pitcher strikeouts, hits, total bases), edge detection and backtesting. Each skill names the FastballAPI tools it calls and what they cost.

```bash
git clone https://github.com/noahowsh/fastballapi-mcp.git
```

Or install them as a Claude Code plugin:

```
/plugin marketplace add noahowsh/fastballapi-mcp
/plugin install fastballapi-skills@fastballapi
```

Or with the skills CLI: `npx skills add noahowsh/fastballapi-mcp`.

Point Claude at the `skills/` folder, connect the MCP server below, and ask. The `dispatch` skill routes a request to the right two or three skills. Full list: [`skills/README.md`](skills/README.md).

## Quick start

This is a hosted (remote) MCP server over Streamable HTTP. There is nothing to install.

**Claude Code**

```bash
claude mcp add --transport http fastballapi "https://mcp.fastballapi.com/mcp?key=YOUR_API_KEY"
```

**Claude Desktop, Cursor and other clients**

```json
{
  "mcpServers": {
    "fastballapi": {
      "url": "https://mcp.fastballapi.com/mcp?key=YOUR_API_KEY"
    }
  }
}
```

The key can also be sent as an `x-api-key` header or `Authorization: Bearer`. Connecting and listing tools works without a key; calling a tool needs one.

**REST**

```bash
curl -X POST https://mcp.fastballapi.com/v1/list_teams -H "x-api-key: YOUR_API_KEY"
```

Every tool is `POST /v1/{tool}` with a JSON body.

## Examples

Runnable Python (standard library only) and Node 18+ (no dependencies) examples live in [`examples/`](examples/):

- [`examples/python/quickstart.py`](examples/python/quickstart.py) and [`examples/node/quickstart.mjs`](examples/node/quickstart.mjs): schedule plus a headline call.
- [`examples/python/mlb_pitch_mix_and_props.py`](examples/python/mlb_pitch_mix_and_props.py): A pitcher's arsenal (usage, velocity, whiff rate and ball rate per pitch type) followed by his strikeout prop lines against what he actually threw, game by game.

```bash
export FASTBALLAPI_API_KEY=your_key
python3 examples/python/quickstart.py
node examples/node/quickstart.mjs
```

See [`examples/README.md`](examples/README.md) for details. Get a free key (500 credits a month, no card) at https://fastballapi.com/signup.

## Tools (20)

| Tool | What it returns |
|------|-----------------|
| `list_teams` | Team ids, abbreviations and colours for a season |
| `search_players` | Find players by name |
| `get_games` | Games with runs, hits and errors by season, date, range or team |
| `get_schedule` | Upcoming games with the median line across sportsbooks |
| `get_standings` | Standings from every final game, with run differential and Pythagorean record |
| `get_injuries` | The latest injury report |
| `get_ratings` | Our team Elo ratings, ranked |
| `get_game` | One game: every batting and pitching line, each book's line, win probability |
| `get_player` | Season batting (AVG, OBP, SLG, OPS, RE24) and pitching (ERA, WHIP, K/9) |
| `get_player_games` | A player's full batting and pitching game log |
| `get_leaders` | Season leaders among qualified batters and pitchers |
| `get_team_stats` | Runs for and against, team batting and opponents' batting |
| `get_pitch_mix` | A pitcher's arsenal: usage, velocity, whiff rate per pitch type |
| `get_odds` | Every sportsbook's moneyline, run line and total for a game (5) or a day (10) |
| `get_plate_appearances` | Plate-appearance play-by-play with base-out state, batted ball, win probability, RE24 |
| `get_pitches` | Pitch-by-pitch: count, type, velocity, location, result |
| `get_spray_chart` | Where a batter or team hits the ball, by trajectory and field |
| `get_line_movement` | Snapshots of each sportsbook's line before first pitch |
| `get_player_props` | Player prop lines by sportsbook, opening and closing |
| `get_prop_history` | A player's prop lines against the result, game by game |

Leagues: mlb (default), ncaabase (NCAA Division I games ESPN carries; pitch tools, spray charts and injuries are not offered for college).

## Data

- MLB games since 2015 with pitch-by-pitch data (every pitch from 2018; 2015 to 2017 have about 98 to 99% of each season's pitches)
- Every plate appearance with base-out state, batted ball, win probability and RE24
- Per-sportsbook moneylines, run lines and totals: 4 to 13 books per game from 2015 to 2023 (about 4 in 2015, 10 in 2016 and 2017, 7 to 8 in 2018 to 2020, 12 in 2021 to 2023), usually one book since 2024 in ESPN's own feed, plus opening and closing lines from The Odds API since July 2020 (a median of 7 books in 2021 to 2023 and 8 since 2024); pre-game line snapshots from launch: ESPN's once a day, The Odds API's every hour for games in the next two days
- MLB player prop lines by sportsbook (hits, home runs, total bases, RBI, pitcher strikeouts, pitcher outs) from May 2023, with the result against each line (`get_player_props`, `get_prop_history`); none for college
- NCAA Division I college baseball for the games ESPN carries (not every Division I game)

Coverage by season, read live from the database: https://fastballapi.com/docs

## Useful pages

- [Docs](https://fastballapi.com/docs): every endpoint with parameters and a live example response
- [Data atlas](https://fastballapi.com/docs/atlas): what exists, which tool exposes it, coverage by season
- [MLB odds](https://fastballapi.com/odds): upcoming moneylines, run lines and totals by sportsbook
- [MLB player props today](https://fastballapi.com/props): hits, home runs, total bases, RBIs and pitcher strikeouts, best price per player across books
- [Guides](https://fastballapi.com/guides): pitch data for a model, pitch mix and whiff rate, Pythagorean standings, run value with runners in scoring position, spray charts
- [Data](https://fastballapi.com/data): [pitch-by-pitch](https://fastballapi.com/data/mlb-pitch-by-pitch), [spray charts](https://fastballapi.com/data/mlb-spray-chart-data), [odds history](https://fastballapi.com/data/mlb-odds-history), [player props](https://fastballapi.com/data/player-props)
- [College baseball](https://fastballapi.com/college-baseball): the NCAA Division I games ESPN carries
- [Pricing](https://fastballapi.com/pricing): free tier and paid plans
- Comparisons: [vs pybaseball](https://fastballapi.com/compare/pybaseball), [vs BallDontLie](https://fastballapi.com/compare/balldontlie-mlb), [vs Sportradar](https://fastballapi.com/compare/sportradar-mlb), [vs the MLB Stats API](https://fastballapi.com/compare/mlb-stats-api)
- [Glossary](https://fastballapi.com/glossary)

## Pricing

500 free credits every month, no card. Plans: Starter $19/mo (10,000 credits), Pro $49/mo (30,000), Scale $149/mo (125,000). Wallet top-ups from $5, never expire. https://fastballapi.com/pricing

## Attribution

Baseball data from public ESPN data; sportsbook lines and player props from ESPN and The Odds API. Ratings and run values are ours. Not affiliated with MLB, the NCAA or any team.

## License

MIT for the contents of this repository. Data terms as above.
