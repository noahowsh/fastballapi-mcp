---
name: pitch-mix-analysis
description: "Analyzes an MLB pitcher's arsenal: pitch types, usage, average and top velocity, whiff rate per swing, ball rate, usage by count, velocity by inning and platoon splits, from FastballAPI pitch-by-pitch data. Use when the user asks what a pitcher throws, which pitch gets whiffs, how his velocity changes through a game or season, or what his pitch mix means for strikeouts. Do not use for season ERA or WHIP lines: see player-scouting. Do not use for pricing a strikeout prop: see prop-modeling. Do not use for college baseball: no pitch data exists there."
metadata:
  version: 1.0.0
  author: FastballAPI
---

# Pitch Mix Analysis

> **Default data tool:** FastballAPI (`fastballapi-tool`).
> `get_pitch_mix` (5 credits) gives the arsenal summary. `get_pitches` (10 credits, up to 2,000 rows a call) gives every pitch for custom cuts. `search_players` (1) first.

You read a pitcher's arsenal the way a scout reads a scouting report: what he throws, how hard, how often, and what batters do against it. MLB only. College baseball has no pitch rows.

## When to Use

- "What does Tarik Skubal throw?"
- "Which of his pitches gets the most whiffs?"
- Usage vs whiff: does he throw his best pitch enough?
- Velocity trend within a start or across a season
- Changes in pitch mix between seasons
- Inputs for a strikeout model (see `prop-modeling`)

## When NOT to Use

- Season ERA, WHIP, K/9: `player-scouting`
- Hitter-side batted-ball profile: `spray-chart-analysis`
- Run value of outcomes: `run-value-analysis`
- College pitchers: not available

## Commands Available

| Command | What it does | Credits |
|---------|--------------|---------|
| `get_pitch_mix` | Per pitch type: `pitches`, `usage`, `avg_velocity`, `max_velocity`, `whiff_rate`, `ball_rate`, `in_play`; takes `pitcher_id`, `season` | 5 |
| `get_pitches` | Every pitch: `at_bat_id`, `pitch_number`, `inning`, `half`, `balls`, `strikes`, `pitch_type`, `pitch_type_name`, `velocity`, `px`, `py`, `result`, `in_play`; filters `game_id`, `pitcher_id`, `batter_id`, `season`, `pitch_type`, `limit` up to 2,000, `offset` | 10 |
| `search_players` | Find `pitcher_id` | 1 |
| `get_player` | Season line to set the context | 5 |

## Commands That Do NOT Exist

| Not available | Use instead |
|---------------|-------------|
| `get_spin_rate`, `get_movement`, `get_extension` | Not available. No spin, break or release data |
| `get_stuff_plus`, `get_pitch_value` | Not available. Build run value from `get_plate_appearances` outcomes |
| `get_pitch_mix` for a game | Not available. Use `get_pitches` with `game_id` and aggregate |
| `get_pitch_arsenal_by_batter_hand` | Use `get_pitches` with `batter_id` filters or batch by handedness in code |
| `get_bullpen_mix` | Same tools, run per reliever |

## Coverage

- Every pitch since 2018. For 2015 to 2017, about 98 to 99% of each season's pitches.
- Pitch type and velocity are on 96% or more of each season's pitches, and 99.8% or more from 2020.
- Automatic balls and strikes (intentional walks, pitch-timer violations) are not pitches.
- `px` and `py` are the pitch-location frame in pixels, as sent. They are not feet and the strike zone boundaries are not given. Use them for relative location (up/down, in/out) within one pitcher, not for zone-rate claims against an official zone.
- Pitch type labels are the feed's classifications (FF, SI, FC, SL, CH, CU, KC). Some pitchers' four-seam and sinker labels blur.

## How It Works

**Step 1: Resolve the pitcher.** `search_players` with `name`. Check `position` is SP or RP. Real: Tarik Skubal, `player_id` 42409.

**Step 2: Arsenal summary.**

```json
POST /v1/get_pitch_mix
{"pitcher_id": "42409", "season": 2025}
```

Real response (2025, trimmed to the four main pitches):

```json
{"data": {"pitcher": {"id": "42409", "name": "Tarik Skubal"}, "season": 2025, "pitches": 3152,
 "mix": [
  {"pitch_type": "CH", "name": "Changeup",     "pitches": 974, "usage": 0.309, "avg_velocity": 87.6, "max_velocity": 92,  "whiff_rate": 0.488, "ball_rate": 0.30,  "in_play": 161},
  {"pitch_type": "FF", "name": "Four-seam FB", "pitches": 953, "usage": 0.302, "avg_velocity": 97.2, "max_velocity": 102, "whiff_rate": 0.291, "ball_rate": 0.293, "in_play": 141},
  {"pitch_type": "SI", "name": "Sinker",       "pitches": 734, "usage": 0.233, "avg_velocity": 96.9, "max_velocity": 101, "whiff_rate": 0.189, "ball_rate": 0.272, "in_play": 131},
  {"pitch_type": "SL", "name": "Slider",       "pitches": 407, "usage": 0.129, "avg_velocity": 89.8, "max_velocity": 94,  "whiff_rate": 0.262, "ball_rate": 0.324, "in_play": 65}]}}
```

**Step 3: Read it correctly.**

- `whiff_rate` is per swing (swinging strikes divided by swings), not per pitch. A 48.8% whiff rate on the changeup means about half the swings against it missed.
- `usage` is share of all pitches in the season, not by count or batter hand.
- `in_play` is balls in play on that pitch, a sample-size check: 161 changeups in play against 65 sliders.
- `ball_rate` is balls per pitch. High whiff with high ball rate is chase-driven, not zone-driven.

Observations from the real numbers: the changeup is his most-used and highest-whiff pitch (31% usage, .488); the two fastballs together are 53% of his pitches but whiff much less (.291 four-seam, .189 sinker); the sinker, at the same velocity as the four-seam, gets far fewer whiffs, so it is not where his strikeouts come from (what it does to contact needs the plate-appearance data).

**Step 4: Strikeout shape.** A pitcher's strikeout rate is roughly the sum over pitches of usage times swing rate times whiff rate (plus called strikes). `get_pitch_mix` does not give swing rate. If you need the full decomposition, count swings in `get_pitches` using the `result` field. List the distinct `result` values from the first page before filtering; a sample row shows `strike-looking` and `ball`, and swinging strikes appear under their own value. Never guess the label.

**Step 5: Custom cuts with `get_pitches`.** 10 credits per call, so plan:

```json
POST /v1/get_pitches
{"pitcher_id": "42409", "season": 2025, "limit": 2000, "offset": 0}
```

A season of about 3,150 pitches needs two pages (offset 0 and 2000). Real row shape:

```json
{"game_id": "401809272", "at_bat_id": "4018092720101", "pitch_number": 1, "inning": 1, "half": "bottom",
 "pitcher_id": "42409", "batter_id": "36488", "balls": 0, "strikes": 0,
 "pitch_type": "FF", "pitch_type_name": "Four-seam FB", "velocity": 97, "px": 108, "py": 178,
 "result": "strike-looking", "in_play": false}
```

Cuts worth making:

| Cut | How | What it tells you |
|-----|-----|-------------------|
| Usage by count | group by `balls`, `strikes`, `pitch_type` | Does he go to the changeup when ahead? |
| First-pitch mix | `balls == 0 and strikes == 0` | Predictability |
| Velocity by inning | mean `velocity` by `inning`, one game or many | Fatigue; early-inning vs late |
| Velocity by season month | group pitches by game date from `game_id` joins | Season-long drop or injury sign |
| vs batter hand | join `batter_id` to `bats` from `search_players` | Platoon usage |
| Pitch to pitch | order by `at_bat_id`, `pitch_number` | Sequencing |

**Step 6: Velocity trend rules.**

1. Compare the same pitch type only; a mix change moves the pitcher-level average.
2. Use at least 30 pitches of a type per cell.
3. A 1 mph drop in a four-seam over 3 consecutive starts is worth flagging; a single start is not. Weather, mound and radar calibration vary by ballpark; say that and do not diagnose injuries.

## Sample Size

| Metric | Rule of thumb before trusting |
|--------|-------------------------------|
| Usage by pitch | 200+ pitches of the pitcher |
| Whiff rate per pitch type | 100+ swings (about 300 pitches for a changeup) |
| Platoon split usage | 500+ pitches per side |
| Velocity change | 3 starts, 30+ pitches per type per start |

These are practical floors, not API outputs.

## Credit Usage

| Operation | Credits |
|-----------|---------|
| Find pitcher + arsenal | 6 |
| One game of pitches | 10 |
| One season of pitches (two pages) | 20 |
| Pitcher comparison (two arsenals) | 12 |

## Anti-patterns

| Mistake | Why it is wrong | Do This |
|---------|-----------------|---------|
| Calling whiff rate "per pitch" | It is per swing | Say per swing |
| Averaging whiff rates weighted by pitch count | Needs swing counts | Recompute from `get_pitches` or avoid |
| Using `px`/`py` as feet | Pixel frame as sent | Relative location only |
| Comparing 2017 velocity to 2020 without caution | Coverage is fuller from 2018, near-complete from 2020 | State coverage |
| Reading a sinker's low whiff as poor stuff | It targets ground balls | Judge by contact outcome |
| Naming spin or movement | Not in the data | Say it is not available |
| Doing this for a college pitcher | No pitch rows | Say so |

## Output Format

```
Tarik Skubal, 2025: 3,152 pitches
Changeup 30.9% | 87.6 avg (92 max) | whiff 48.8% per swing | ball 30.0%
Four-seam 30.2% | 97.2 avg (102 max) | whiff 29.1% | ball 29.3%
Sinker 23.3% | 96.9 avg | whiff 18.9% | ball 27.2%
Slider 12.9% | 89.8 avg | whiff 26.2% | ball 32.4%
Read: changeup carries the strikeouts; fastballs set it up. Sample is a full season.
```

## What to Do Next

| You found | Next | Skill |
|-----------|------|-------|
| High-whiff pitch | Build a strikeout projection | `prop-modeling` |
| Pitcher context needed | Season line and workload | `player-scouting` |
| Which pitches get hit hard | Batted-ball profile of opponents | `spray-chart-analysis` |
| Outcome value by pitch | Run value | `run-value-analysis` |
