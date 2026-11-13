# FastballAPI skills

Sixteen Claude skills that turn Claude into a baseball analyst for MLB and college baseball. Each skill is a folder with a `SKILL.md`: when to use it, which FastballAPI tools it calls (with credit costs), the method, a worked example with real output shapes, and the mistakes to avoid.

## Use them

```bash
git clone https://github.com/noahowsh/fastballapi-mcp.git
```

Point Claude Code (or another client that reads `SKILL.md` files) at this `skills/` folder, and connect the MCP server so the skills can call the data tools:

```bash
claude mcp add --transport http fastballapi "https://mcp.fastballapi.com/mcp?key=YOUR_API_KEY"
```

Get a free key (500 credits every month, no card) at https://fastballapi.com/signup. Start with `dispatch`: it routes a request to the two or three skills that matter. `fastballapi-tool` lists every tool, its credit cost and the data limits.

## Catalog

| Skill | Category | What it does |
|-------|----------|--------------|
| [`game-lookup`](game-lookup/SKILL.md) | Data Exploration | Scores, schedules and full box scores for MLB and college baseball |
| [`team-analysis`](team-analysis/SKILL.md) | Data Exploration | Standings, team batting and run prevention, and Elo power ratings |
| [`player-scouting`](player-scouting/SKILL.md) | Data Exploration | Player lines, game logs, season leaders and injuries, compared fairly |
| [`odds-explorer`](odds-explorer/SKILL.md) | Data Exploration | Best price, opening vs closing and line movement across sportsbooks |
| [`game-preview`](game-preview/SKILL.md) | Data Exploration | One-matchup pre-game report: form, ratings, injuries and the market |
| [`pitch-mix-analysis`](pitch-mix-analysis/SKILL.md) | Baseball Analytics | Pitch usage, velocity and whiff rate per swing for any MLB pitcher |
| [`run-value-analysis`](run-value-analysis/SKILL.md) | Baseball Analytics | RE24, base-out state, RISP splits and win probability by plate appearance |
| [`spray-chart-analysis`](spray-chart-analysis/SKILL.md) | Baseball Analytics | Where a batter hits the ball: trajectory, field, HR per fly ball, x/y plots |
| [`pythagorean-record`](pythagorean-record/SKILL.md) | Baseball Analytics | Expected record from runs scored and allowed, and how much is luck |
| [`walk-forward-validation`](walk-forward-validation/SKILL.md) | Methodology | Leakage-safe features, time-ordered splits, baselines and calibration |
| [`odds-analysis`](odds-analysis/SKILL.md) | Methodology | Convert odds and remove the margin with multiplicative, power and Shin methods |
| [`edge-detection`](edge-detection/SKILL.md) | Betting | Expected value, fractional Kelly, line shopping and closing line value |
| [`backtesting`](backtesting/SKILL.md) | Betting | Test a strategy on closing lines and prop history with honest intervals |
| [`prop-modeling`](prop-modeling/SKILL.md) | Betting | Pitcher strikeout, hits and total bases projections vs the devigged market |
| [`dispatch`](dispatch/SKILL.md) | Workflow | Routes a baseball request to the right two or three skills |
| [`fastballapi-tool`](fastballapi-tool/SKILL.md) | Infrastructure | All 20 tools, credit costs, coverage limits and the data response envelope |

## Notes

- Every tool call returns `{"data": ...}`. The skills say so wherever it matters.
- Pitch tools, spray charts, injuries and player props are MLB only. College baseball (`league: "ncaabase"`) has box scores, play-by-play for part of each season, standings, ratings and sportsbook lines.
- The betting skills describe estimates, not predictions. Edges are small, variance is large, and sample size decides what you can know. Nothing here is betting advice.
- Coverage by season, read live from the database: https://fastballapi.com/docs/atlas
