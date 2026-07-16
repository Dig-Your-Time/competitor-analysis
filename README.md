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

## Running the dashboard

You need Node 18 or newer.

```
cd dashboard
npm install
npm run dev
```

That starts the dev server and prints a local URL (usually http://localhost:5173).
The dashboard reads `dashboard/public/data.json`, which is already committed, so
you can run the site without touching the Python side at all.

To make a production build:

```
npm run build      # outputs to dashboard/dist
npm run preview     # serve that build locally to check it
```

`dashboard/dist` is gitignored on purpose. It's generated output, so the host
rebuilds it on every push rather than us committing it.

## Refreshing the data

You only need this if you're pulling fresh numbers or adding a competitor.
It's plain Python 3.9+ and uses **only the standard library**, so there's
nothing to `pip install`.

Run the three scripts in order from the repo root:

```
python scripts/fetch_steam.py        # Steam facts + review curves -> data/games_steam.csv, data/timeseries.csv
python scripts/build_estimates.py    # blends the estimate sources -> data/estimates.csv
python scripts/build_data.py         # joins everything           -> dashboard/public/data.json
```

`fetch_steam.py` talks to Steam's public API (no key needed). It rate-limits
itself and caches every raw response under `data/raw/` so a re-run doesn't hammer
Steam again. That folder is gitignored because it's large and reproducible.

After a refresh, commit the changed CSVs and the regenerated `data.json`, and the
diff will show you exactly which numbers moved.

## Deploying

It's a static site, so any static host works. The build lives in a subfolder, so
whatever you use, point it at `dashboard/` as the project root, with `npm run build`
as the build command and `dist` as the output. The site loads from the domain
root, so nothing in the code needs a base-path tweak.

## A couple of conventions worth knowing

- Dates are `YYYY-MM-DD`. Numbers are plain numbers, no currency symbols or
  thousands separators. Percentages are stored as fractions (0.9, not 90).
- Money is stored in its native currency and converted to euros in the dashboard,
  never in the data, so refreshing an exchange rate never rewrites a CSV. The one
  thing kept in dollars is a game's listed Steam price, because that's the US store
  price and Steam's regional euro price isn't a straight conversion.
- Every game is keyed by its Steam appid. Every studio by a short lowercase slug.
