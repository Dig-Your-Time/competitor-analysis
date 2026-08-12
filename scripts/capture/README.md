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
   `scripts/capture/collect.js` will do a whole list in one go if you paste it once and
   let it drive the tab.
2. Save the array as e.g. `gamesensor-2026-08-12.json`.
3. Import it:

```bash
python scripts/import_vendor_capture.py gamesensor gamesensor-2026-08-12.json
python scripts/import_vendor_capture.py gamalytic  gamalytic-2026-08-12.json
python scripts/build_data.py
```

The importer refuses to write anything if validation fails, so a half-captured or
mis-parsed run cannot quietly land in the dataset.

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
* Do **not** try to defeat the bot challenge. Use a real browser.
