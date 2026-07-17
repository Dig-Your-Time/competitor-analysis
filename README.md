# Competitor Analysis

Market research for an unreleased indie game. The point of this repo isn't the
game, it's the homework: what similar games on Steam actually sold, how fast
they sold it, what the studios behind them are worth, and where our own plans
would land if we dropped them into that field.

It comes in two halves that stay deliberately separate:

- **A small data pipeline** (Python) that pulls facts from Steam, blends in a
  couple of third-party sales estimates, and joins everything with a pile of
  hand-curated CSVs into one file the dashboard can read.
- **A dashboard** (Vite + React) that reads that one file and nothing else. No
  backend, no database, no API. It's a static site, so it can be hosted for free.

A word on the numbers before you trust any of them: Steam review counts, release
dates, prices, and filed company accounts are real, observable facts. Unit and
revenue figures are **estimates** and are labelled as such everywhere they appear.
Valve doesn't publish sales, so nobody has the real number, only models that
disagree with each other. The dashboard tries hard never to blur the two.

## Layout

```
.
├── data/            the CSVs. Hand-curated files + script-generated ones.
├── scripts/         the Python pipeline (fetch, estimate, build).
└── dashboard/       the static site (React). Reads dashboard/public/data.json.
```

The CSVs are the source of truth and they're committed to git on purpose, so
every change to every number shows up in a diff. There are two kinds: files a
human edits by hand, and files a script generates. A script never writes to a
hand-edited file, which is the whole reason the data model is split the way it is.

## Setting up the project

You only need two things installed: **[Node.js](https://nodejs.org) 18 or newer**
(for the dashboard) and **[Python](https://www.python.org/downloads/) 3.9 or
newer** (for the data pipeline and local edit mode). No database, no global tools.

```bash
# clone the repo
git clone https://github.com/Dig-Your-Time/competitor-analysis.git
cd competitor-analysis

# run the dashboard — this is all you need just to view/edit it locally
cd dashboard
npm install                          # first time only
npm run dev                          # prints a local URL, usually http://localhost:5173

# (optional) refresh the data — only when pulling fresh numbers or adding a game
cd ..
pip install -r requirements.txt      # just httpx, used only by the Steam fetch
python scripts/fetch_steam.py        # Steam facts + review curves -> games_steam.csv, timeseries.csv
python scripts/build_estimates.py    # blends the estimate sources -> estimates.csv
python scripts/build_data.py         # joins everything            -> dashboard/public/data.json
```

The dashboard reads `dashboard/public/data.json`, which is committed, so it runs
without touching Python at all. For a production build use `npm run build`
(outputs to `dashboard/dist`, which is gitignored) and `npm run preview` to check
it.

The three Python scripts must run in the order above. `fetch_steam.py` uses
Steam's public API (no key), rate-limits itself, and caches raw responses under
`data/raw/` (gitignored). `build_estimates.py` and `build_data.py` are
standard-library only, so if you only changed a hand-edited CSV you can skip the
fetch and run just those two. Commit the changed CSVs and the regenerated
`data.json` afterward — the diff shows exactly which numbers moved.

## Editing the data from the dashboard (local only)

When you run `npm run dev`, the dashboard gains an edit mode: pencil and "＋"
controls on studios, games, financials, funding, sources, and estimates, plus
**Add studio / Add source / Add game** on the Browse page. This is **only** for
local development — it's a dev-server feature that is stripped from the production
build, so the deployed site is always read-only.

Under the hood, an edit calls a small local endpoint that runs a Python writer
(`scripts/apply_edit.py`). It writes only the hand-edited CSVs — never the
script-generated ones — then rebuilds `data.json` so your change shows up
immediately. Because it edits the CSVs directly, every change is a normal `git
diff`; review it and commit like any other edit. For this to work you need Python
available (see *Setting up the project*); adding a game also fetches Steam, so it
needs `httpx` installed.

There's no separate command to start — the edit API rides along with `npm run
dev`. It does nothing in `npm run build` / `npm run preview`.

## A couple of conventions worth knowing

- Dates are `YYYY-MM-DD`. Numbers are plain numbers, no currency symbols or
  thousands separators. Percentages are stored as fractions (0.9, not 90).
- Money is stored in its native currency and converted to euros in the dashboard,
  never in the data, so refreshing an exchange rate never rewrites a CSV. The one
  thing kept in dollars is a game's listed Steam price, because that's the US store
  price and Steam's regional euro price isn't a straight conversion.
- Every game is keyed by its Steam appid. Every studio by a short lowercase slug.
