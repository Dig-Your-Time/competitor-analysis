# Dashboard guide

What every view shows, what every number means, and where it came from.

This is market research for an unreleased first-person mining game, built to answer
practical questions: what should we charge, which languages should we localise into, how
fast do games like ours sell, and how fast do they stop.

The dashboard tracks **28 competitors** and the studios behind them.

---

## Read this first: how certain is a number?

Everything in the dashboard is one of three kinds, and the difference matters more than
any individual figure.

| Label | Meaning | Examples |
|---|---|---|
| **HARD** | Filed, published, or directly observable. If two people looked, they'd see the same number. | Steam prices, release dates, review counts, review language mix, Nordic company accounts |
| **EST** | A model's guess. **Valve publishes no sales data**, so nobody outside a studio knows how many copies it sold. | Copies sold, revenue, players by country |
| **ANEC** | Someone said it out loud — an interview, a tweet, a postmortem. Often the only anchor available, but self-selecting: studios announce good news. | Publisher deal terms, dev-announced sales |

The single most important consequence: **there is no such thing as "how many copies Dome
Keeper sold."** There are only estimates, and they disagree — sometimes by 4×. Wherever the
dashboard shows an estimate it shows a *range*, and the width of that range is real
information. A tight range means the models agree. A wide one means nobody knows.

---

## The tiers

Every game carries a tier. It controls which games belong in "typical case" reasoning.

| Tier | Count | What it is |
|---|---|---|
| **1-Direct** | 8 | Small-scope mining/dig loop — the core comparable set. Dome Keeper, SteamWorld Dig 1 & 2, Hydroneer, Core Keeper, Noita, Techtonica, Cave Digger 2. **Typical-case numbers should come from here.** |
| **2-Adjacent** | 4 | Related loop or tone — Moonlighter, ASTRONEER, Forager, The Gunk. |
| **3-Reference** | 6 | Big or multiplayer — Deep Rock Galactic, Terraria, Valheim, Teardown, Outer Wilds, Enshrouded. These mark the ceiling. Never average them into a typical case. |
| **X-Drop?** | 10 | Survival-craft cluster from the original shortlist. Different genre and scope; most sold through co-op virality this game won't have. Useful as a labelled cluster, not as individual peers. |
| **0-Ours** | 1 | Our own game, entered as a row so "us vs them" is the same code path as any other comparison. |

Tiering is data, not deletion. A game that turned out to be a poor comparison stays in,
tagged, rather than vanishing.

---

## The views

### Browse

Every studio and game tracked. Click a game to open its own page (see
[the game page reference](./game-pages-and-gamesensor.md)); click a studio for its detail
panel. The search box matches title, studio, country and status.

### Launch curves

**The highest-value view.** Cumulative Steam reviews over time, with every game's release
week lined up at week 0 — so a 2013 game and a 2025 game can be read on the same chart.

Reviews are a proxy for sales, not sales. What's worth reading is the **shape**: how steep
the launch spike is, how fast it decays, and whether anything brings it back.

- **Cumulative / Per week** — cumulative shows overall scale and how quickly a game
  stopped growing. Per week is where events show up: launch, sales, updates, a streamer.
- **Early access: Exclude / Include** — off by default. Steam's release date for an Early
  Access game is its *1.0* date, so several games have years of sales before "launch".
  With EA excluded every curve starts from zero at 1.0 and launches stay comparable;
  include it to see the run-up. Games with EA history are marked **EA**.
- **Window** — 1yr / 2yr / 5yr / All.
- **Line styles** — only eight colours stay reliably distinct, including for colour-blind
  readers. Past eight games the colours repeat with a dashed, then dotted, then dash-dot
  stroke. **The style means nothing about the game** — it's just how the ninth line onward
  stays tellable apart.

### Compare

Every metric side by side, including our own game. The estimate row shows a band
(low–high) with the mid marked, so you can see agreement and disagreement at a glance.

### Market map

Every game plotted by **price** (x) against **outcome** (y — estimated units or revenue).
Bubble size is review count, colour is tier, and the dashed line is our target price.

- The **vertical whisker** on each dot is the estimate's low–high range. A tall whisker
  means the estimators disagree.
- Price is the **list price**, never a sale price. A game caught mid-discount still plots
  at what it normally costs.
- The default log scale means each gridline is ten times the one below, so equal spacing
  is equal multiples.

### Regions

One bubble per game, grouped by the studio's home region. **9 of the 28 studios are
Nordic**, which is the dataset's unfair advantage — Finnish, Swedish and Danish companies
must file public annual accounts, so their real revenue and profit are retrievable.

### Financials

**HARD, not estimates.** Filed annual accounts from Nordic and EU company registries —
real revenue, operating profit, headcount. Shown in euros at fixed approximate rates, with
the native currency on every bar. Filings span different years at different real rates, so
read euro figures as roughly comparable, not exact.

### Publishers

Publisher track records. You will never get a publisher's deal terms — rev share and
advances are confidential and are not in this dataset. What you *can* get is the median
estimated revenue of everything they've published, which is the decision-relevant number
anyway.

### Funding & ownership

Who paid in, and who owns them now. **The sparsest and least certain corner of the
dataset.** Crowdfunding is HARD; acquisition prices and investment rounds are reported in
press and often approximate. An acquisition price is what a buyer paid — not money the
studio raised, so don't read it as runway.

### Guide

The in-app version of this document, with the same caveats attached to the views they
apply to.

---

## Where the data comes from

| Source | Covers | Kind |
|---|---|---|
| **Steam Store API** (`appdetails`) | Price in USD and EUR, release date, supported languages, genres, platforms | HARD |
| **Steam Reviews API** (`appreviews`) | Review counts, the weekly launch curve, per-language mix and sentiment | HARD |
| **Steam Hardware & Software Survey** | Platform-wide language share — the denominator for the language index | HARD |
| **Nordic/EU company registries** | Filed annual accounts | HARD |
| **Gamalytic** | Copies sold and gross revenue with a low/high range; players by country | EST |
| **GameSensor** | Gross and net revenue, copies sold, revenue and copies share by language | EST |
| **Boxleiter method** | Review count × 30, a rough independent sanity check on units | EST |

Every figure in the dashboard traces back to a numbered source row. On a game page the
**Sources** button opens a panel with the exact endpoint or page for that game, plus the
retrieval date.

All Steam data is re-fetched rather than cached, because prices and review counts move.
The one exception is the weekly review counts: a week that has already ended can't change,
so those are cached and only new weeks are fetched.

---

## What this dashboard cannot tell you

Stated plainly, because a dashboard that quietly presents guesses as facts is worse than
no dashboard — it gets trusted.

- **Actual sales for any competitor.** Units and revenue are models. Two vendors on the
  same game routinely differ by 2–4× on small games.
- **Net revenue for anyone.** Valve takes 30%, and regional pricing, discounts and refunds
  take much more. Real take-home is well under half of gross. Never compare a competitor's
  gross to a net figure for our own game.
- **Player counts by country.** Steam publishes no country data for games you don't own.
  The country figures on a game page are one vendor's *model*, capped at the top three
  countries, and should be read as a rough ranking only.
- **Share of players by language.** The language mix counts reviews, not players. Review
  habits differ by language community, and there's no ground truth to correct with.
  Comparing games to each other is sound; reading an absolute "share of our players" is not.
- **Console and mobile.** Essentially invisible. Steam is most of what's knowable.
- **Publisher deal terms.** Confidential, and will never be in this dataset.

Two era effects worth knowing when reading old games:

- **Steam reviews launched November 2013.** Games older than that still have week-0 data,
  because Steam kept the earlier Community recommendations with their original dates. What
  they carry instead is a one-off spike the week the feature launched — Terraria's is 9×
  its surrounding baseline. That bump is Steam shipping a feature, not a sale.
- **Review propensity differs by era**, so a 2011 game's absolute counts aren't directly
  comparable to a 2024 game's. Compare shape, not height, across that boundary.

---

## Keeping it current

```bash
python scripts/refresh.py            # prices + rebuild, under a minute
python scripts/refresh.py --full     # + review curves and language mix (~10 min)
python scripts/refresh.py --vendors  # + import vendor captures
```

`refresh.py` runs every automatable step, stops if one fails so nothing half-updated
reaches the dashboard, and reports how old each vendor capture is. Vendor data can't be
fetched automatically — see
[the game page reference](./game-pages-and-gamesensor.md#refreshing-the-vendor-data).

Then serve it:

```bash
cd dashboard && npm run dev
```

Editing is available only when running locally. The deployed site is read-only.
