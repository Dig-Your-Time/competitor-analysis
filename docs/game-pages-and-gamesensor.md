# Game pages, the language dataset, and the GameSensor capture

Written 2026-08-12. Covers the work on branch `language-and-estimator-data`: what was
added, what was broken and fixed, and — more usefully — *why* each call went the way it
did. Read the "Decisions" sections if you are changing any of this later; several of
them look arbitrary until you know what went wrong without them.

---

## 1. What now exists

| Thing | Where | Owner |
|---|---|---|
| Per-game review language mix | `data/languages.csv` (868 rows) | SCRIPT — `fetch_languages.py` |
| Steam-wide language baseline | `data/steam_language_baseline.csv` (31 rows) | SCRIPT — same |
| GameSensor revenue / copies | `data/gamesensor_stats.csv` (28 rows) | HAND — browser capture |
| GameSensor language split | `data/gamesensor_languages.csv` (291 rows) | HAND — browser capture |
| Gamalytic band (copies + revenue low/mid/high) | `data/gamalytic_detail.csv` (28 rows) | HAND — browser capture |
| Gamalytic players by country | `data/gamalytic_countries.csv` (108 rows) | HAND — browser capture |
| Per-game web page | route `/<steam_appid>` | `GamePage.jsx` |
| Router | `router.jsx` | — |

Both GameSensor files are registered in `scripts/_hand_csv.py`, so edits go through the
guarded writer like every other HAND table.

### Where every number comes from

Until this branch, **the entire HARD layer was unsourced** — prices, reviews, dates and
language mix had no row in `sources.csv` at all, despite CLAUDE.md's premise that every
number is sourced. Four source rows now cover it, and the game page exposes them behind a
**Sources** button rather than making you read the CSVs:

| id | Covers | Endpoint |
|---|---|---|
| **S052** | Price, release date, **which languages a game ships in**, genres, platforms | `store.steampowered.com/api/appdetails?appids=<id>&cc=us` (and `cc=fi` for EUR) |
| **S053** | Review counts, the weekly launch curve, the per-language mix | `store.steampowered.com/appreviews/<id>?json=1&num_per_page=0` |
| **S054** | The **Steam-wide language baseline** — the "Steam" column, e.g. English 39.61% | `store.steampowered.com/hwsurvey/?platform=combined` |
| S050 | Gamalytic units + gross revenue | vendor export |
| S051 | GameSensor gross/net/copies + language split | browser capture |
| **S055** | Gamalytic **players by country** + the low/high band | `gamalytic.com/game/<id>`, browser capture |

**Source links resolve per game.** A source's `url` in `sources.csv` is a generic landing
page, and clicking "Gamalytic" only to arrive at `gamalytic.com`'s front page tells you
nothing. `build_data.py` holds a `SRC_GAME_URL` template map and attaches a resolved
`sources_used` array to every game, so each link opens *that game's* page or endpoint —
`gamalytic.com/game/1637320`, `gamesensor.info/app/1637320`,
`appdetails?appids=1637320&cc=us`. The templating lives in Python next to the data rather
than in the frontend. Two links legitimately carry no appid: the hardware survey (S054) is
platform-wide, and the registry filing is company-level.

Two of these answer questions that came up directly:

**"Where does 39.61% English come from?"** Valve's own **Hardware & Software Survey**, a
monthly census of all Steam users. The Language section is category `cat7`, rendered
inline in the page HTML; `fetch_languages.py` parses it into
`steam_language_baseline.csv` (31 languages, summing to 100.02% with rounding). It is
first-party Valve data, not a third-party estimate. The caveat that matters: it measures
a user's **Steam client language**, while reviews measure the language someone chose to
**write in**. So the index column is sound for comparing games against each other and
must not be read as an absolute share of players.

**"Where does 'ships in which languages' come from?"** `appdetails.supported_languages`,
which is Steam's own store listing — the same list shown on the store page. It arrives as
an HTML blob (`English<strong>*</strong>, French, ...`), so `fetch_steam.py` strips the
markup and normalises each name to a review-language code via `STORE_LANG_CODE`, because
the store and the reviews API use different vocabularies (the store says "Korean", the
reviews API says `koreana`). Without that mapping `languages.csv` and `games_steam.csv`
cannot be joined, which is what makes "did shipping a language move its share?"
answerable at all. Catalan and Basque are sold on Steam but have no review-language code,
so they are recorded in `NO_REVIEW_CODE` and can never appear in `languages.csv`.

---

## 2. The route

`localhost:5173/<appid>` — e.g. `/892970` is Valheim. The top bar renders on every
route, so the tabs still move you around; clicking one from a game page sets the tab
*and* navigates back to `/`.

### Decision: a hand-rolled router, not react-router

CLAUDE.md is explicit: *"Do not introduce a framework... Every dependency is a thing the
developer has to maintain while also shipping a game."* This app has exactly two URL
shapes — the tabbed dashboard and a game page. `router.jsx` is ~60 lines of History API
and covers both. react-router would be roughly twenty times the code it replaces, plus a
version to track.

### Decision: game cards are `<a href>`, not buttons

The entire point of giving each game a URL is that the URL can be shared, middle-clicked,
opened in a new tab, or bookmarked. A `<button>` with an onClick handler does none of
that. `Link` renders a real anchor and only calls `preventDefault` on a plain left click,
so modifier-clicks fall through to the browser.

### Decision: the drawer stays

Browse cards now open the full page, but Compare and the Market map still open the
side drawer. Those are chart views where a peek shouldn't cost you your scroll position
and selection. The drawer gained an "Open full page →" link so it is a stepping stone
rather than a dead end.

### Gotcha: route state must be in one context

The first draft had `Link` call the route hook itself. Every link got its own private
copy of the state, so clicking one updated that link and nothing else. Route state lives
in a single `RouterProvider` context; don't re-introduce per-component state.

### Gotcha: deep links need a server-side fallback

`/892970` is a client-side route with no file behind it. The Vite dev server falls back
to `index.html` automatically. Static hosts do not:

- **Cloudflare Pages** — reads `dashboard/public/_redirects`, which is committed.
- **GitHub Pages** — this is what `.github/workflows/deploy.yml` actually uses, publishing
  to `dig-your-time.github.io/competitor-analysis/` on every push to `main`. It ignores
  `_redirects` entirely, so `vite.config.js` now emits a copy of `index.html` as
  **`404.html`** at build time; Pages serves that for any unknown path, and the router
  reads the URL from there.

  **A bug caught just before merging:** `base: './'` was fine for assets but broke routing
  on a subpath. With a relative base the router could not tell `/competitor-analysis/`
  (the app root) from `/1637320` (a game), so `/competitor-analysis/1637320` rendered the
  dashboard home and a refresh 404'd. Two fixes: the build now uses an absolute
  `base: '/competitor-analysis/'` (override with `VITE_BASE=/` for a domain root), and
  `parsePath` matches the **last path segment** rather than stripping a prefix — so a
  misconfigured base can no longer silently break every game link in production while
  looking fine locally.

---

## 3. What the game page shows, and why it is arranged this way

### Copies sold — three estimates, never averaged

Boxleiter (reviews × 30), GameSensor, and Gamalytic appear as three separate bars scaled
to the largest, so a disagreement *looks* like a disagreement.

**This is the most important design decision on the page.** Measured across all 28
tracked games, the two vendors land within ~20% of each other on million-review games and
diverge **2–4× on small ones**:

| Game | GameSensor | Gamalytic | Ratio |
|---|---|---|---|
| Dome Keeper | 400K | 1,644,955 | 0.24× |
| Core Keeper | 1.2M | 3,806,964 | 0.32× |
| Moonlighter | 500K | 1,325,100 | 0.38× |
| Terraria | 43.9M | 35,755,362 | 1.23× |
| Valheim | 19.4M | 16,611,970 | 1.17× |

Their implied copies-per-review run in *opposite directions* with game size — GameSensor
about 18 rising to 36, Gamalytic about 75 falling to 23. Averaging two models that
disagree by 4× would manufacture a confidence neither has, and would hide the single most
decision-relevant fact here: **the estimators are least reliable exactly in the size
bracket this studio will ship into.** CLAUDE.md predicted this; it is now measured.

The page states the spread in words when it exceeds 2×.

### Revenue — both vendors, compared on gross only

A table with one row per vendor. **Gross is the only comparable column**, because it is
the only figure both publish: Dome Keeper is Gamalytic $14M against GameSensor $6.0M, a
2.4× disagreement that would be invisible if either were shown alone.

**Net appears for GameSensor only, and says "not published" for Gamalytic** rather than
being left blank or, worse, filled in. Net is GameSensor's own modelled take-home after
Valve's cut, regional pricing and refunds — a model on top of a model. Putting a number
in that cell for Gamalytic would invent one.

The raw displayed string sits alongside the parsed number, because GameSensor renders
roughly one significant figure: `$6M` is anywhere in 5.5–6.5M.

### Launch curve — cumulative *and* per week

Two metrics, toggled. **Cumulative** reads overall scale and how quickly a game stopped
growing. **Per week** is where events live — the launch spike, sale bumps, an update, a
streamer picking it up. Cumulative hides all of that in its slope; per week is noisier but
it is the view that answers "what brought it back?", which CLAUDE.md names as the core
question. The Early Access toggle applies to both.

### Language mix — measured first, vendor second

The table leads with **our measured** review share, then Valve's platform-wide baseline,
then an index of one against the other. GameSensor's columns sit to the right for
comparison, deliberately dimmed.

**Why measured-first:** GameSensor's copies-share matches our measured review share to a
**0.26 percentage-point median across 228 game-language pairs** (99% within 2pp). It is
not a second opinion — it is the same signal, rounded to integers. Their own methodology
text says so: *"modelled from Steam review throughput, inferred player languages."*

### Sources open in a sidebar

A **Sources** button slides over a right-hand panel matching the existing detail drawer,
listing every source the page rests on — id, what it covers, reliability, a link resolved
to this game, the archive link where one exists, retrieval date, and the full methodology
note. A scrim closes it. It is a sidebar rather than an inline block so that reading
provenance never costs you your place on the page.

The design intent: CLAUDE.md warns that *"a dashboard that quietly presents guesses as
facts is worse than no dashboard, because it will be trusted."* Making provenance a button
rather than a document is what stops that.

### Players by country — present, and the softest number on the page

Gamalytic models a country split, and the page now shows it: **Dome Keeper reads US 24%,
China 16%, Germany 5.9%, all others 54.1%.**

This does not contradict the earlier finding that country data is not *obtainable*. It
confirms it. Steam has no country field anywhere in its APIs — I dumped every key on the
review and author objects — so Gamalytic is **inferring** this, most plausibly from
language and regional pricing. It prefixes every figure with "~" itself. The page says so
in the popover, and two structural limits are stated on the face of it:

- The free tier gives only the **top 3 countries** plus an "others" bucket. For Dome Keeper
  that bucket is **54.1% of players** — the majority is genuinely unavailable.
- The numbers do not agree with the measured language data, and shouldn't be expected to.
  Gamalytic puts China at 16% of Dome Keeper's players; Steam's own review-language share
  for Simplified Chinese is 9.1%. Those measure different things, and the gap is the model.

Treat it as a rough ranking, never as measured geography.

### GameSensor's "Others" bucket

GameSensor lists only its top languages and rolls the tail into "Others" (4% of Dome
Keeper's copies). That row is now shown, with the measured columns blank, and a note that
the two "others" are not comparable — **our language table has no such bucket**, because
it is the complete list reconciled to 100% of the game's reviews.

---

## 4. The language dataset

`fetch_languages.py` asks Steam for a review count per language per game
(`&language=<code>&num_per_page=0`), plus positive/negative for free in the same response.
It also scrapes Valve's Hardware & Software Survey for the platform-wide baseline
(category `cat7`, inline in the page HTML).

### Decision: long format, one row per game per language

Not one row per game with 30 language columns. Five reasons, in order of weight:

1. **Diffable.** One number changing is one changed line in `git diff`. Wide format
   rewrites the whole row and you hunt for which column moved. The CSVs are committed
   precisely so every change is visible.
2. **Adding a language is data, not a migration.** Steam added Malay recently.
3. **Two metrics kill wide format** — counts *and* sentiment would mean 60+ columns.
4. It matches the existing grain model (`timeseries` is one row per game per week).
5. Nobody reads this file by hand; it is SCRIPT-owned. Wide format's only real advantage
   is eyeballing it in Excel, which is not the workflow.

### Gotcha: reconciliation must bracket, not equate

The first version demanded the per-language counts equal the all-languages total exactly.
12 of 28 games failed by 1–3 reviews — and some failed *negative*, which no missing
language can explain. Cause: 32 requests take ~20 seconds and reviews are posted and
deleted throughout. It now reads the all-languages total **before and after** each game's
loop and requires the sum to land inside that bracket (±5). Drift is bounded by two real
measurements instead of a tolerance someone invented, and a genuinely missing language is
still caught because it would be off by hundreds. All 28 pass.

### What this data can and cannot answer

**Can:** which languages to localise into and in what order; whether shipping a language
moves its share (`supported_languages` is now captured, normalised to review-language
codes — the store says "Korean", the reviews API says "koreana"); where a bad translation
will cost you, via the positive-rate gap.

**Cannot:** player counts by language (review propensity differs by community and there is
no ground truth to correct with), country, or copies sold by language as a headline figure.

Headline finding for this studio: across the Tier 1 comps, **Korean over-indexes 2.31×**
against the Steam baseline with a 93.7% positive rate, and shows the largest measured lift
between games that ship it and games that don't (2.9×, on a real comparison group of
19 vs 9). Chinese and Japanese are both under-indexed *and* the harshest reviewers.
Caveat: lift is correlation, not causation — better-funded games localise more.

---

## 5. The GameSensor capture

### The capture IS scripted now — just not fetchable

An early version of this work left the parsing in throwaway files outside the repo, so
the data was committed but the *method* wasn't. That is fixed:

```
scripts/capture/gamesensor.js       paste into the console on gamesensor.info/app/<appid>
scripts/capture/gamalytic.js        paste into the console on gamalytic.com/game/<appid>
scripts/capture/README.md           the workflow, and the traps
scripts/import_vendor_capture.py    validates the collected JSON, then writes the CSVs
```

The browser step stays manual — that is forced by the vendors, not a shortcut. But the
parsing, the language-code mapping, the unit conversion and every validation rule now live
in version control.

**The importer refuses to write on anything that means the capture is broken**: an unknown
appid, an unmapped language name, percentages that don't sum to ~100, a band with
low > mid > high, a game missing from the capture, or a missing Gamalytic revenue band.
It distinguishes those from *gaps in the vendor's own data*, which are written as blanks
with a printed warning — GameSensor genuinely publishes no copies figure for Cave Digger 2
(34 reviews, below their threshold), and that should not block an import.

### How the data was read, and why there is no fetcher

`gamesensor.info` sits behind a Cloudflare bot challenge; every request from a plain HTTP
client, including `robots.txt`, returns 403 with a JS interstitial. It was captured by
driving a **real browser** — which passes the challenge the way any visitor's browser
does, by running the JS. No CAPTCHA was presented, and none would have been solved.
The site's footer explicitly permits copying with attribution, which S051 provides.

There is therefore **no re-runnable fetch script**, and these are HAND files, exactly like
the pasted Gamalytic export. To refresh, repeat the browser capture.

The per-game language table is client-rendered, so fetching the HTML same-origin does not
work — the page has to be navigated and given time to render.

### Three caveats recorded in the data

1. **~1 significant figure.** `displayed_gross`, `displayed_net`, `displayed_copies` keep
   the raw strings so nobody mistakes `6000000` for a measured value.
2. **All Chinese is labelled "Traditional Chinese."** For Dome Keeper it reports 10% of
   copies, while Steam's actual split is 9.1% Simplified + 1.2% Traditional — so the row
   is really both scripts and the label is wrong.

   In the CSV it is stored as `chinese_all`, never `tchinese`, so a join can't silently
   attach it to the wrong language. On the page it is **displayed on the Traditional
   Chinese row, marked with a †**, because that is where GameSensor puts it and hiding it
   would be its own kind of misleading. The dagger note under the table gives their figure
   and Steam's real split side by side. An earlier draft blanked both Chinese cells, which
   was technically correct and practically useless — the number was simply invisible.
3. **Cave Digger 2 has no copies figure** (34 reviews, below their threshold) and shows
   gross equal to net, which is not credible.

Also worth knowing: the site's prose is auto-generated and contains errors — it described
Valheim, released 2021, as "available for 6 months." Trust the numbers more than the text
around them, and neither very far.

---

## 5b. Why scraping with BeautifulSoup does not work

Reasonable question, and the answer is no for **two different reasons** — neither of which
better parsing would fix.

**GameSensor** returns `403` to any non-browser client, including for `robots.txt`. It is
a Cloudflare bot challenge: there is no HTML to parse because the page is never served.

**Gamalytic** returns `200`, but the body is an empty Next.js shell with no game data.
`__NEXT_DATA__.props.pageProps` is literally `{}` — two bytes. Every figure arrives later
via an authenticated XHR to their API, which is a separately **paid product** that answers
`{"message":"This endpoint requires an API key..."}`. Replaying those calls with a copied
session cookie would be circumventing the paywall, so the browser is the honest route.

That is why the workflow is a browser snippet plus a validating importer rather than a
fetcher. Not a shortcut — the only path that doesn't involve defeating a bot challenge or
a paid tier.

## 5c. Audit, 2026-08-12

Run after everything above was in place. All checks pass:

| Check | Result |
|---|---|
| Row counts | games_steam 28, gamesensor_stats 28, gamalytic_detail 28, languages 868 |
| Orphan `game_id`s across all five new tables | none |
| `src_est` values resolve to `sources.csv` | S051, S055 ✓ |
| S050–S055 present in `data.json` | ✓ |
| Per-game source links carry the appid | S050, S051, S052, S053, S055 ✓ |
| `curve_capture_pct` | exactly 1.000 for all 28 |
| Language shares sum to 1.0 | all 28 |
| Country percentages sum to ~100 | all 27 with data |
| Copies band `low ≤ mid ≤ high` | holds |

**One bug found and fixed by the audit.** Gamalytic labels revenue two ways: games with
DLC show `Gross revenue (base game):`, games without show plain `Gross revenue:`. The
original capture regex required the parenthetical, so **five games silently imported with
revenue 0** — Forager, The Gunk, SurrounDead, ASKA and Cave Digger 2 — and nothing
complained. All five are now recovered (Forager $21m, The Gunk $1.2m, SurrounDead $10.5m,
ASKA $10m, Cave Digger 2 $10.6k), and a missing revenue band is now a hard failure in the
importer rather than a zero.

**Was `gamalytic_stats.csv` stale? Yes — I said otherwise and was wrong.** A first pass
compared it loosely and reported "27 of 28 within 8%". Checked properly, twelve
game-fields had moved more than 5% in the four weeks since the export was pasted:

| Game | Field | 2026-07-15 | 2026-08-12 | |
|---|---|---|---|---|
| Moonlighter | gross | $8,681,327 | $9,800,000 | **+13%** |
| SteamWorld Dig 2 | gross | $1,268,470 | $1,100,000 | −13% |
| SteamWorld Dig | gross | $2,598,402 | $2,300,000 | −11% |
| ICARUS | copies | 2,689,033 | 2,900,000 | +8% |
| The Gunk | copies | 204,706 | 220,700 | +8% |
| Forever Skies | copies | 408,073 | 431,300 | +6% |

`copies_sold` and `revenue_gross` are now refreshed for all 28 from the live pages, via
the guarded writer. The trade is real and worth naming: the July export carried full
precision (8,681,327) while the site shows three significant figures (9.8m). **For an
estimate, currency beats false precision** — six significant figures on a modelled number
were never meaningful.

**Still on July data** and not refreshed: `wishlists_available`, `avg_playtime_hours`,
`reviews`, `review_score`, `followers`, `avg_daily_ccu`. Nothing in the dashboard reads
them, and two of them — `reviews` and `review_score` — should be taken from
`games_steam.csv` instead, where they are HARD and current.

### The estimate band was degenerate for half the set

Refreshing the values exposed a worse problem. `build_estimates.py` brackets Gamalytic's
point with a Boxleiter range, and takes `high = max(gamalytic, reviews × 40)`. Whenever
Gamalytic's figure exceeded that, **`high` collapsed onto `mid`** — a band with no upside
at all. That was true for **14 of 28 games**, including Dome Keeper, Core Keeper, Noita,
Moonlighter and Enshrouded.

That directly breaks CLAUDE.md's central rule: *"est_units is stored as three columns —
low / mid / high, never one. The spread is the information."* A band reading
1,700,000 / 1,700,000 asserts certainty nobody has.

Gamalytic publishes a real range on every game page, so `units_low/mid/high` are now
filled from it — which is precisely the workflow CLAUDE.md describes. Dome Keeper went
from `441,020 / 1,700,000 / 1,700,000` to **`1,000,000 / 1,700,000 / 2,300,000`**. All 28
rows now read `est_units_source = manual`, and **no degenerate bands remain**.

**Where the two vendors disagree on revenue** (both now present for all 28): most agree
within 2×; the outliers are SteamWorld Dig 2 (GS $3.0M vs Gamalytic $1.1M, 2.7×) and
Voidtrain (GS $4.0M vs Gamalytic $13.4M, 3.4×). The game page shows both and states the
ratio rather than picking one.

## 6. Bugs fixed along the way

These were live in the data before this branch:

- **Stale cache on volatile endpoints.** The review summary and SteamSpy were served from
  a 25-day-old `data/raw` copy — the same bug already fixed for prices, in a place I
  hadn't checked. `review_count_total` was understated by **26,737** across the set and
  fed stale Boxleiter estimates. Only weekly review counts stay cached now: a *closed*
  week is immutable, nothing else about a live game is. The tell was that every capture
  ratio came in above 1.0 and none below — a one-directional error is never noise.
- **Two review totals.** Steam's default hides reviews inside flagged off-topic
  review-bomb windows. Split into `review_count_total` (store page) and
  `review_count_all` (bombs included — 9,214 for 7 Days to Die, the only affected game).
  The curve counts bombs because a review-bomber still bought the game.
  `curve_capture_pct` now compares like with like and reads exactly **1.000** for all 28.
- **Wrong pinned appid.** ASKA was pinned to `1731210`, which is "Eclypse Lobby", an
  unreleased game by another studio. It was harmless only because it was written
  `("ASKA", 1731210 and None)` — an expression that evaluates to `None`, discarding the
  id and falling back to name search. All 28 appids are now pinned and verified against
  live Steam by title *and* developer. **Never write `("Name", 1234 and None)`.**

---

## 7. Verifying it

```bash
# data layer
python scripts/fetch_languages.py     # ~7 min, fails loudly if a game doesn't reconcile
python scripts/fetch_steam.py --prices # <1 min, re-prices both regions
python scripts/build_estimates.py && python scripts/build_data.py

# vendor refresh (browser capture -> validated import); see scripts/capture/README.md
python scripts/import_vendor_capture.py gamesensor <capture.json>
python scripts/import_vendor_capture.py gamalytic  <capture.json>

# app
cd dashboard && npm run dev
```

Then check: `/` shows the dashboard; `/1637320` loads Dome Keeper **directly on refresh**
(that is the SPA-fallback test); the top bar works from a game page; browser back returns
to the dashboard; a Browse card is a real link (middle-click opens a new tab).

`curve_capture_pct` should read 1.0 for all 28 games — it is the integrity check that the
weekly counts sum to Steam's own lifetime total.
