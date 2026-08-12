# Vendor capture — how to refresh GameSensor and Gamalytic

Neither vendor can be fetched by a script.

* **GameSensor** sits behind a Cloudflare bot challenge. Every request from a plain HTTP
  client, including `robots.txt`, returns 403 with a JS interstitial.
* **Gamalytic's API is paywalled** — `api.gamalytic.com` returns
  `{"message":"This endpoint requires an API key..."}`.

Both *are* readable in a normal browser, which is what the challenge asks for. So the
capture is a two-step, half-manual workflow, and this directory holds the half that must
not be reinvented each time:

```
scripts/capture/gamesensor.js   paste into the browser console on gamesensor.info/app/<appid>
scripts/capture/gamalytic.js    paste into the browser console on gamalytic.com/game/<appid>
scripts/import_vendor_capture.py   validates the collected JSON and writes the CSVs
```

## Refreshing

1. For each appid in `GAMES` (see `fetch_steam.py`), open the vendor page and run the
   matching snippet. Each returns one line of JSON. Collect them into a JSON array.
2. Save the array as e.g. `gamesensor-2026-08-12.json`.
3. Import it:

```bash
python scripts/import_vendor_capture.py gamesensor gamesensor-2026-08-12.json
python scripts/import_vendor_capture.py gamalytic  gamalytic-2026-08-12.json
python scripts/build_data.py
```

The importer refuses to write anything if validation fails, so a half-captured or
mis-parsed run cannot quietly land in the dataset.

### Walking the whole list without 28 manual page loads

Both sites can be driven from a single open tab, which is how the 2026-08-12 verification
was done. Neither trick bypasses anything: the same session, the same rendered pages.

* **Gamalytic** is a Next.js app, so `window.next.router.push('/game/' + id)` swaps the
  game in place. Give it ~4s to render before scraping, and pace it — see the rate limit
  below.
* **GameSensor** is server-rendered, so a same-origin `<iframe>` pointed at `/app/<id>`
  loads each game without leaving the tab. The iframe must be *visibly sized* (park it at
  1200×900 with `opacity:0.02`), because the language table renders on scroll-into-view
  and never fires inside a hidden frame.

## What the snippets know that you don't want to rediscover

* **Gamalytic labels revenue two ways.** Games with DLC show `Gross revenue (base game):`;
  games without show plain `Gross revenue:`. A regex requiring the parenthetical silently
  dropped revenue for 5 of 28 games (Forager, The Gunk, SurrounDead, ASKA, Cave Digger 2)
  and the CSV showed 0 with no error. The snippet matches both.
* **GameSensor renders its language table client-side**, so fetching the HTML same-origin
  returns a page with no `.one_lang` rows. The page has to be navigated and given ~2s.
* **Country names are only in the flag `alt` attribute**, not in the text.
* **Both sites round hard.** GameSensor shows ~1 significant figure (`$6M`); Gamalytic
  shows 3 (`1.7m`). Both snippets return the displayed string alongside the parsed number
  so the rounding stays auditable.
* **Gamalytic truncates, it does not round.** Verified against its own page data on
  2026-08-12: a modelled 1,174,095 renders as `1.1m`, 4,199,777 as `4.1m`, 35,952,669 as
  `35.9m`. Every stored copies figure is therefore biased LOW — measured across all 28
  games, mean −1.3%, median −0.4%, worst −6.3% (Hydroneer). The CSVs deliberately keep the
  displayed value, so treat a Gamalytic unit count as a floor, not a midpoint.
* **Gamalytic rate-limits.** Roughly 15–20 page loads in quick succession earns a `403
  Forbidden` on the whole origin (the page itself renders "Something went wrong"), which
  clears after a couple of minutes. Space the walk out; a failed read returns no `Copies
  sold:` match rather than an error, so check every row landed.
* Do **not** try to defeat the bot challenge. Use a real browser.

## Verification, 2026-08-12

Every one of the 28 games was re-read on both vendors' pages and diffed against the CSVs.

* **GameSensor** — 28/28 matched on gross, net and copies, and every language row matched
  on revenue %, copies % and the *Supported* flag, except: Abiotic Factor gross `$38M` →
  `$39M`; five 1pp language shifts (Cave Digger 2, Moonlighter ×2, Grounded, Voidtrain,
  Abiotic Factor); and Voidtrain's Brazilian Portuguese row has since dropped off its list.
* **Gamalytic** — 35 fields across 18 games moved, all but four by under 1% (last-digit
  drift in the low/high band). The four worth knowing: Moonlighter's mid stepped
  1.5m → 1.4m, Forager's high 2.2m → 2.3m, Enshrouded's high 6.5m → 6.6m, Forever Skies
  moved ~1% across the board.
* Cave Digger 2 genuinely has **no country breakdown** on Gamalytic — the empty rows in
  `gamalytic_countries.csv` are correct, not a failed capture.

Both captures were left as-is: the drift is at or below each site's own display precision.
