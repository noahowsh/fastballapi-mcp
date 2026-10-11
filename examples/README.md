# FastballAPI examples

Runnable examples for the [FastballAPI](https://fastballapi.com). Python uses only the standard library (`urllib` and `json`). Node uses the built-in `fetch` (Node 18 or newer). No packages to install.

MLB and college baseball data API. Every tool is a REST call: `POST https://mcp.fastballapi.com/v1/<tool_name>` with a JSON body and an `x-api-key` header. The same tools are available over MCP at `https://mcp.fastballapi.com/mcp`.

## Get a key

1. Sign up at https://fastballapi.com/signup. The free plan gives 500 credits every month, no card.
2. Copy a key from https://fastballapi.com/dashboard/keys.
3. Export it. The scripts read it from the environment and never print it.

```bash
export FASTBALLAPI_API_KEY=your_key
```

## What is here

| File | What it does | Tools | Credits |
| --- | --- | --- | --- |
| `python/quickstart.py` | Upcoming schedule plus one headline call, printed as small tables | `get_schedule`, `get_leaders` | about 7 |
| `python/mlb_pitch_mix_and_props.py` | A pitcher's arsenal (usage, velocity, whiff rate and ball rate per pitch type) followed by his strikeout prop lines against what he actually threw, game by game. Defaults to Taijuan Walker, 2025. | `search_players`, `get_pitch_mix`, `get_prop_history` | about 16 |
| `node/quickstart.mjs` | Same as the Python quickstart, for Node | `get_schedule`, `get_leaders` | about 7 |

## Run

```bash
python3 python/quickstart.py
python3 python/mlb_pitch_mix_and_props.py
node node/quickstart.mjs
```

The use-case script takes optional arguments. For example:

```bash
python3 mlb_pitch_mix_and_props.py "Paul Skenes" --season 2025
```

Run any script with `--help` (Python) to see its options.

## Credits and errors

- Every call costs credits, priced per tool. The cost is shown next to each call in the script output, and the response header `X-Credits-Remaining` is printed at the end.
- To see what a call would cost without running it, send `"estimate_only": true` on the tools that accept it (see the tool schema).
- When you are out of credits the API returns HTTP 402 with `{"error": "insufficient_credits", "message": "...", "upgrade_url": "..."}`. The scripts print that message and the upgrade link.
- HTTP 401 means the key is missing or wrong. The scripts print a hint to check `FASTBALLAPI_API_KEY`.
- MLB is the default. Pass `"league"` in the request body for college baseball (see the tool schema).
- The tool list with input schemas is public: `curl https://mcp.fastballapi.com/v1/tools`.

## More

- Docs and example responses for every tool: https://fastballapi.com/docs
- Full reference in one file: https://fastballapi.com/llms-full.txt
- Free key: https://fastballapi.com/signup
