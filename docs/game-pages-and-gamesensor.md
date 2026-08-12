# The game page, and the vendor data on it

Every game has its own page at `/<steam_appid>` — Dome Keeper is `/1637320`, Valheim is
`/892970`. Click any game in **Browse**, or share the URL directly.

This document explains each section of that page: what the numbers mean, how confident you
should be in them, and where they came from. For the dashboard as a whole see
[the dashboard guide](./dashboard-guide.md).

---

## The header facts

| Field | What it is |
|---|---|
| **Price (list)** | What the game costs when nothing is on sale, in both USD and EUR. Not the sale price — a game caught mid-discount is not a cheap game. |
| **Released** | Steam's release date. For an Early Access game this is its **1.0** date, not when it first went on sale. |
| **Reviews** | Total review count and the percentage positive. |
| **Studio / Publisher** | From Steam, with the studio linked to its registry record where we have one. |
| **Ships in** | How many languages the game is *sold* in, from Steam's own store listing. Not how many people play in them. |

**Why two prices?** Steam sets regional prices per region rather than converting them, so
the euro figure is its own decision by the publisher — Hydroneer is $14.99 / €15.49
(more expensive in euros), Outer Wilds $24.99 / €22.99 (cheaper). Converting one into the
other would invent a number no store ever charged, so both are fetched.

---

## Copies sold — three estimates

This is the section most likely to mislead if read carelessly, so it's built to resist that.

**Valve publishes no sales data.** Nobody outside a studio knows how many copies its game
sold. What exists is models, and this page shows three of them as separate bars rather
than averaging them:

| Bar | What it is |
|---|---|
| **Boxleiter** | Review count × 30. A crude industry rule of thumb, included as an independent sanity check — it uses only observable data. |
| **GameSensor** | A commercial vendor's model. |
| **Gamalytic** | A second commercial vendor's model. |

**Boxleiter won't divide evenly by the review count shown at the top of the page**, and for
one game the gap is visible. Steam reports two review totals: the store-page figure, which
*excludes* reviews Valve has ruled an off-topic review bomb, and the bombs-included figure.
The page header shows the store figure, because that's what a visitor to the store sees.
Boxleiter multiplies the bombs-included one, because a review-bombing player still bought
the game. For 27 of the 28 tracked games the two are identical. **7 Days to Die** is the
exception — 397,896 on the store against 407,115 including 9,219 bombed reviews — so its
Boxleiter bar is built on the larger number. That is deliberate, not an arithmetic slip.

The bars are scaled to the largest, so a disagreement *looks* like one. Beneath them the
page states the spread in words.

**"Vendor model" means exactly that:** a commercial analytics company's private estimate.
Neither vendor publishes its formula. Both are built primarily on Steam review counts and
velocity — the same public signal Boxleiter uses — refined with their own calibration.
Neither has access to Valve's actual figures.

**Why they're never averaged.** Across the 28 tracked games, the two vendors land within
~20% of each other on million-review games and diverge **2–4× on small ones**. Dome Keeper
is GameSensor 400k against Gamalytic 1.7M. Averaging those would produce a confident-looking
number that neither vendor stands behind, and would hide the most decision-relevant fact
here: **estimates are least reliable in exactly the size bracket this game will ship into.**

When the spread is 2× or more the page says so directly, in amber.

---

## Revenue

A row per vendor.

- **Gross** is before Valve's 30% cut, before regional pricing, before discounts and
  refunds. It is the only figure both vendors publish, so it's the only one that can be
  compared between them.
- **Net** is GameSensor's own modelled take-home — roughly two-thirds of its gross.
  Gamalytic doesn't publish one, so its cell reads *"not published"* rather than being
  filled in or left ambiguous.
- **As shown** is the raw string from the vendor's site. GameSensor displays roughly one
  significant figure — `$6M` is anywhere between 5.5M and 6.5M — so the parsed number is
  never more precise than what was actually published.

Never compare a competitor's gross to a net figure for our own game.

---

## Launch curve

Cumulative or per-week Steam reviews, with week 0 as this game's release week.

- **Cumulative** reads overall scale and how quickly the game stopped growing.
- **Per week** is where events live: the launch spike, sale bumps, an update, a streamer.
- **Exclude / Include EA** — with Early Access excluded the curve starts from zero at the
  1.0 date. Include it to see the run-up; a marked line shows where release falls.

Review timestamps are directly observed, so the *shape* of this curve is HARD data. Only
the conversion to sales is guessed.

---

## Language mix

The most complete data on the page, and the most useful for a concrete decision:
which languages to localise into, in what order.

| Column | What it is |
|---|---|
| **Measured** | This game's actual share of Steam reviews by language. Directly counted; sums to 100%. |
| **Steam** | Valve's platform-wide share of that language, from the Hardware & Software Survey. |
| **Index** | Measured ÷ Steam. Above 1.0× means this game over-performs the platform in that language; below means it under-performs. |
| **Positive** | Share of that language's reviews that are positive — a signal for where a bad translation costs you. |
| **GS copies / GS revenue** | GameSensor's share figures, for comparison. |
| **Ships?** | Whether the game is sold in that language, from Steam's store listing. |

**Why the index matters.** Raw share is misleading on its own: 9% Simplified Chinese looks
healthy until you see Chinese is 22.5% of all Steam users, which makes it 0.41× — badly
under-served. English is only 39.6% of Steam despite dominating most review lists.

**What this is not.** It counts the language people chose to **write a review in**, not the
language they play in. Review habits differ by community, and there's no ground truth to
correct with. Comparing one game to another is sound because the bias applies to both;
reading an absolute "share of our players" off it is not. It's also **not country** —
Spanish spans Spain and Latin America, English spans nearly everywhere.

Two footnotes appear under the table when they apply:

- **† on the Chinese row.** GameSensor files both Chinese scripts under one row it labels
  "Traditional Chinese". Its figure is shown where it puts it, marked, with Steam's real
  Simplified/Traditional split alongside — for Dome Keeper, GameSensor says 10% while
  Steam's actual split is 9.1% Simplified + 0.7% Traditional. Nearly all of that 10% is
  Simplified, which is exactly why the label can't be taken at face value.
- **"Others"** — GameSensor lists only its top languages and buckets the rest. Our table
  has no such bucket; it's the complete list, so the two "others" aren't comparable.

---

## Players by country

**The softest number on the page**, and worth treating with more suspicion than anything
else in the dashboard.

Steam publishes no per-country data for any game you don't own — there is no country field
anywhere in its APIs. Gamalytic *infers* this, most plausibly from language and regional
pricing, and marks every figure with "~" itself.

Two limits are on the face of the section:

- Only the **top 3 countries** are available, plus an "others" bucket. For Dome Keeper that
  bucket is 54.1% of players — the majority is genuinely unavailable, not omitted here.
- It won't agree with the language table, and shouldn't be expected to. Gamalytic puts
  China at 16% of Dome Keeper's players; Steam's review-language share for Simplified
  Chinese is 9.1%. Those measure different things, and the gap is the model.

Read it as a rough ranking of where a game found its audience. Not as measured geography.

---

## The Sources button

Opens a sidebar listing every source behind that specific page — what it covers, how
reliable it is, when it was retrieved, and a link that goes to **that game's** page or
endpoint rather than a vendor's landing page.

Typical entries: the three Steam endpoints (store API, reviews API, hardware survey), both
vendors, the studio's registry filing, and the game's Steam store page.

---

## Refreshing the vendor data

Steam data refreshes automatically with `python scripts/refresh.py`. **Vendor data cannot**,
for two separate reasons:

- **GameSensor** returns `403` to anything that isn't a browser, including for
  `robots.txt`. It's a Cloudflare bot challenge — there's no page to read.
- **Gamalytic** serves an empty page shell; every figure arrives afterwards from an
  authenticated request to their API, which is a separately paid product.

So both are read in a normal browser and imported:

1. For each game, open the vendor page — `gamesensor.info/app/<appid>` or
   `gamalytic.com/game/<appid>` — and run the matching snippet from `scripts/capture/` in
   the browser console. Each returns one line of JSON.
2. Collect those lines into a JSON array and save it.
3. Import:

```bash
python scripts/import_vendor_capture.py gamesensor <capture.json>
python scripts/import_vendor_capture.py gamalytic  <capture.json>
python scripts/build_data.py
```

The importer **refuses to write** if the capture looks broken — an unknown appid, a
language name it can't map, percentages that don't sum to ~100, or a range with low above
high. Gaps in the vendor's own data are different: those are written blank with a printed
warning, because GameSensor genuinely publishes no copies figure for Cave Digger 2 (34
reviews, below their threshold).

`refresh.py` reports how old each capture is and flags anything past 30 days, so this step
is never silently skipped. Vendor estimates drift slowly — over four weeks Moonlighter's
gross moved 13%, most games moved under 3% — so monthly is a reasonable cadence.

---

## Deployment note

Game pages are client-side routes with no file behind them, so the host has to serve the
app for unknown paths. GitHub Pages does this via a `404.html` copy of `index.html`, which
the build generates automatically. The site is served from a subdirectory
(`/competitor-analysis/`), so the build uses an absolute base path; override it with
`VITE_BASE=/` if the site ever moves to a domain root.
