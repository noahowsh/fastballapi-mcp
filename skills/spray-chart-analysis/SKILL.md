---
name: spray-chart-analysis
description: "Reads where an MLB batter or team hits the ball: balls in play by trajectory (ground ball, line drive, fly ball, pop-up) and by field (left, center, right), hit rates, home runs per fly ball, pull and opposite-field tendencies, and ball-by-ball x/y points for drawing a spray chart. Use when the user asks where a hitter hits the ball, whether he pulls, how many of his fly balls leave the park, or wants a spray chart. Do not use for season rate stats: see player-scouting. Do not use for run value: see run-value-analysis. Do not use for pitch data: see pitch-mix-analysis."
metadata:
  version: 1.0.0
  author: FastballAPI
---

# Spray Chart Analysis

> **Default data tool:** FastballAPI (`fastballapi-tool`).
> `get_spray_chart` (10 credits). Add `include_balls: true` for each ball's x/y (up to 3,000 balls). `search_players` (1) first. MLB only.

You describe a hitter's batted-ball profile from the data FastballAPI holds: trajectory, field and location. There is no exit velocity or launch angle, so you describe where and what kind, not how hard.

## When to Use

- "Where does Aaron Judge hit the ball?"
- Pull, center and opposite-field shares
- Home runs per fly ball; line-drive rate
- Draw a spray chart (scatter of x/y)
- Compare a team's batted-ball tendencies with another team's
- Context for a hitter's BABIP or home run total

## When NOT to Use

- Season slash lines and plate discipline: `player-scouting`
- Run value of outcomes: `run-value-analysis`
- Pitcher arsenals: `pitch-mix-analysis`
- Exit velocity, barrels, launch angle: not available in this data

## Commands Available

| Command | What it does | Credits |
|---------|--------------|---------|
| `get_spray_chart` | Balls in play by trajectory and by field with hit rates. `batter_id` or `team`, `season`, `include_balls` | 10 |
| `get_plate_appearances` | Each batted ball with `trajectory`, `x`, `y`, result and run value, if you need per-event detail (filter by `batter_id`, `result`) | 10 |
| `search_players` | Find `batter_id` | 1 |

## Commands That Do NOT Exist

| Not available | Use instead |
|---------------|-------------|
| `get_exit_velocity`, `get_launch_angle`, `get_barrels`, `get_xwoba` | Not available |
| `get_hit_distance` | The `description` text on a `get_plate_appearances` home run includes distance in feet (for example "383 feet"); parse it, and do not assume other hits have it |
| `get_shift_data` | Not available |
| `get_hard_hit_rate` | Not available. Line-drive rate is the nearest proxy |
| `get_spray_chart` for college | Not available |

## Trajectory and Field Codes

| Code | Meaning |
|------|---------|
| `G` | Ground ball |
| `L` | Line drive |
| `F` | Fly ball |
| `P` | Pop-up |
| `unknown` | Not classified (a handful per season) |

Fields are `left`, `center`, `right`, `unknown`. For a right-handed hitter, left field is the pull side; for a left-handed hitter, right field is. Get the handedness from `search_players` (`bats`: R, L, or null for some players) before labeling pull or opposite.

## How It Works

**Step 1: Pull the chart.**

```json
POST /v1/get_spray_chart
{"batter_id": "33192", "season": 2025}
```

Real response (Aaron Judge, 2025):

```json
{"data": {"season": 2025, "balls_in_play": 410,
 "by_trajectory": [
  {"trajectory": "F", "balls": 154, "hits": 70, "hr": 52, "hit_rate": 0.455},
  {"trajectory": "G", "balls": 138, "hits": 50, "hr": 0,  "hit_rate": 0.362},
  {"trajectory": "L", "balls": 95,  "hits": 72, "hr": 2,  "hit_rate": 0.758},
  {"trajectory": "P", "balls": 22,  "hits": 0,  "hr": 0,  "hit_rate": 0}],
 "by_field": [
  {"field": "left",   "balls": 168, "hits": 99, "hr": 24, "hit_rate": 0.589},
  {"field": "center", "balls": 122, "hits": 34, "hr": 6,  "hit_rate": 0.279},
  {"field": "right",  "balls": 119, "hits": 59, "hr": 24, "hit_rate": 0.496}]}}
```

Two things to notice. First, `balls_in_play` here includes home runs (52 of the 154 fly balls are home runs), so it is a count of batted balls, not the usual "in play excluding HR". Second, `hits` includes home runs, and `hit_rate` is hits divided by balls.

**Step 2: Derive the numbers that matter.**

| Metric | Formula | Judge 2025 (from the response) |
|--------|---------|--------------------------------|
| Pull share (RHH) | left balls / total balls | 168 / 410 = 41.0% |
| Center share | center / total | 122 / 410 = 29.8% |
| Opposite share | right / total | 119 / 410 = 29.0% |
| Fly-ball share | F / total | 154 / 410 = 37.6% |
| HR per fly ball | F.hr / F.balls | 52 / 154 = 33.8% |
| Line-drive share | L / total | 95 / 410 = 23.2% |
| Ground-ball share | G / total | 138 / 410 = 33.7% |
| BABIP-like (excluding HR) | (hits - hr) / (balls - hr) | (192 - 54) / (410 - 54) = 38.8% |

The BABIP-like number excludes strikeouts and sacrifices differently than official BABIP (strikeouts are not batted balls, and sacrifice flies are in or out depending on the source), so call it "batted-ball hit rate without home runs". Do not compare it to a published BABIP to the third decimal.

**Step 3: Reconcile with the season line.** In this live call the chart showed 54 home runs and 192 hits, while `get_player` showed 53 home runs and 179 hits for the 2025 regular season. The chart's season appears to include postseason balls in play. Before publishing a count, reconcile the two sources, or label the chart "all games in the season, regular and postseason". Do not mix numerators from one source with denominators from another.

**Step 4: Read it.**

- A high `HR per fly ball` is a mix of skill and sample. Compare across two or more seasons, and against the league with a `team` call, before calling it repeatable.
- Trajectory comes from the feed's scoring, so line-drive and fly-ball labels may not match another source's. Compare within this data, across several seasons, before concluding.
- Pull share with high fly-ball share is the profile of a pull-side power hitter. Pop-ups are almost always outs (0 hits in 22 for Judge).
- A hitter's hit rate by field tells you where his hits come from, not where he should be defended. There is no shift data in this API.

**Step 5: Draw it.** With `include_balls: true`, each ball has an `x`, `y`, trajectory and result. Plot as a scatter.

```python
import matplotlib.pyplot as plt
balls = get_spray_chart(batter_id="33192", season=2025, include_balls=True)["data"]["balls"]
colors = {"F": "tab:blue", "G": "tab:green", "L": "tab:orange", "P": "tab:gray"}
plt.scatter([b["x"] for b in balls], [b["y"] for b in balls],
            c=[colors.get(b["trajectory"], "k") for b in balls], s=14)
plt.gca().invert_yaxis()
```

Each entry in `balls` has `x`, `y`, `trajectory` and `result` (real examples: `{"x": 103, "y": 80, "trajectory": "L", "result": "line-out"}`, `{"x": 15, "y": 43, "trajectory": "F", "result": "home-run"}`). In the live call, 409 of 410 balls had coordinates. The response's `balls_note` gives the frame: ESPN's spray image is 250 x 250 pixels, home plate near (125, 205), with y decreasing toward center field. That is an image frame, so inverting the y axis in the plot (as above) puts home plate at the bottom. These are pixels, not feet: do not convert to distances. The only distances in the data are in the `description` text of home runs in `get_plate_appearances`.

**Step 6: Team spray.** `team` instead of `batter_id` returns the same aggregates for a lineup. Use it to compare how two clubs hit: fly-ball share and pull share explain a lot of the home run difference between clubs, along with parks (not in the data).

## Sample Size

| Statement | Needs |
|-----------|-------|
| Pull / center / opposite shares | 150+ batted balls for a rough read (about a third of a season) |
| Ground-ball and fly-ball shares | 100+ batted balls |
| HR per fly ball | 300+ fly balls to be stable; a season is not enough, so combine seasons |
| Line-drive hit rate | Noisy; treat as descriptive |

## Credit Usage

| Operation | Credits |
|-----------|---------|
| One batter-season chart | 10 |
| Chart with each ball (`include_balls`) | 10 |
| Find batter id | 1 |
| Two hitters compared | 22 |

## Anti-patterns

| Mistake | Why it is wrong | Do This |
|---------|-----------------|---------|
| Calling a ball "hard hit" | No exit velocity | Say line drive or fly ball |
| Treating `balls_in_play` as excluding HR | It includes them | Subtract `hr` |
| Treating `x`, `y` as feet | ESPN's frame | Plot relatively |
| Labeling pull for a switch-hitter without splitting | Side varies by pitcher | Split by batter side first (play-by-play) |
| Quoting HR/FB as a talent level after one season | High variance | Combine seasons |
| Applying this to a college hitter | No batted-ball locations for college | Say it is not available |
| Mixing chart totals with `get_player` totals | The chart can include postseason | Reconcile or label |

## Output Format

```
Aaron Judge (RHH), 2025: 410 batted balls (includes HR)
Trajectory: fly 37.6%, ground 33.7%, line 23.2%, pop 5.4%
Field: left (pull) 41.0%, center 29.8%, right 29.0%
HR/FB 33.8% (52 of 154). Batted-ball hit rate without HR 38.8%.
Note: chart total of 54 HR includes postseason; regular-season line shows 53.
```

## What to Do Next

| You found | Next | Skill |
|-----------|------|-------|
| A power profile | Season line and run value | `player-scouting`, `run-value-analysis` |
| A hitter's weak spots | Pitcher arsenals that attack them | `pitch-mix-analysis` |
| A hit-total prop | Projection | `prop-modeling` |
| Two clubs' contrasts | Team view | `team-analysis` |
