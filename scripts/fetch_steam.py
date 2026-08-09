#!/usr/bin/env python3
"""
fetch_steam.py  --  fills the two SCRIPT-owned data files.

Run this in an environment with open network (your machine / Claude Code).
It never touches the HAND-owned files (games_manual.csv, companies.csv, ...).

What it writes:
  data/games_steam.csv   one row per game: Steam-side facts (HARD) + a SteamSpy
                         owners estimate (EST, clearly labelled). Prices are kept
                         as the LIST price (base_price_*) and the live price
                         (current_price_*), in TWO regions: usd = US store,
                         eur = Finland. They are not interchangeable; see the
                         note in build_one().
  data/timeseries.csv    one row per game per week: review accumulation curve
                         (HARD) normalised to week_index 0 = launch week.
                         week_index can be NEGATIVE for a game whose Steam
                         release_date is its 1.0 date and which has Early Access
                         review history before it.
  data/fetch_log.csv     the provenance receipt: what appid, which endpoint,
                         when, how many records. This is why timeseries needs
                         no per-row source column.
  data/raw/*.json        cached raw API responses (gitignore this dir)

Input: GAMES below -- a list of (title, appid). ALL 28 are pinned and verified
against Steam, each id confirmed to return the intended title. Keep it that way:
a None here falls back to name search, which makes the run non-deterministic and
picks whatever Steam's search ranks first that day. That is how "Moonlighter"
once resolved to the 2025 sequel instead of the 2018 original.

Never write `("Name", 1234 and None)`. That idiom evaluates to None, silently
discarding the id -- and it hid a genuinely wrong one: ASKA was pinned to
1731210, which is "Eclypse Lobby", an unreleased game by another studio. The
real ASKA is 1898300. Only the name-search fallback stopped it being fetched.

No API key required. Be polite: this rate-limits and caches so a re-run does
not re-hammer Steam.

Modes:
  python scripts/fetch_steam.py            full run (~90 min cold, minutes warm)
  python scripts/fetch_steam.py --prices   re-price every game only (<1 min)
  python scripts/fetch_steam.py --add <appid> [title]   one new competitor
"""

import csv, json, os, time, sys, hashlib, datetime as dt
from pathlib import Path

try:
    import httpx
except ImportError:
    sys.exit("pip install httpx   (or swap the two get() calls for requests)")

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
RAW  = DATA / "raw"
RAW.mkdir(parents=True, exist_ok=True)

CC, LANG = "us", "english"          # canonical region: the USD store price
CC_ALT = "fi"                        # second region: Finland, i.e. the EUR price the
                                     # developer actually sees. Steam's regional prices
                                     # are set per-region, NOT converted -- €29.99 next
                                     # to $29.99 is two decisions, not one exchange rate.
PAUSE = 0.25                         # seconds between calls; be a good citizen
TODAY = dt.date.today().isoformat()

# --- launch-curve capture policy ------------------------------------------
# We no longer page individual reviews. filter=recent walks newest->oldest at 100
# reviews per request, so reaching week 0 of a million-review game meant ~15,000
# requests -- which is why the giants used to be written off as "recent-tail" and
# dropped from the curves, and why three mid-size games (Forager, Abiotic Factor,
# The Gunk) were silently truncated while still being labelled complete.
#
# Instead we ask Steam for a COUNT per week window:
#   ...&num_per_page=0&start_date=<t>&end_date=<t+7d>&date_range_type=include
# returns that window's review count in query_summary. One small response per
# game-week, the same size whether the window holds 3 reviews or 30,000. So cost
# scales with a game's AGE, not its popularity, and every game is reachable.
#
# Verified against the old paged data for Dome Keeper:
#   week 0/1/2/50 -> paged 1417/598/364/58, windowed 1417/598/363/58.
#
# appreviewhistogram returns a game's whole review span in ONE request, so we only
# walk weeks that can actually hold reviews, and record the rest as a real zero
# without burning a call on each.
WEEK = 7 * 86400
RETRIES = 4              # window queries are cheap; a transient 429/5xx is worth retrying

# ---------------------------------------------------------------------------
# INPUT LIST.  hint_appid None -> resolve by name. Pin ids after first run.
# ---------------------------------------------------------------------------
GAMES = [
    # Tier 1 -- direct
    ("Dome Keeper",            1637320),
    ("SteamWorld Dig",          252410),
    ("SteamWorld Dig 2",        571310),
    ("Hydroneer",              1106840),
    ("Core Keeper",            1621690),
    ("Noita",                   881100),
    ("Techtonica",             1457320),
    ("Cave Digger 2",          2392740),
    # Tier 2 -- adjacent
    ("Moonlighter",             606150),   # the 2018 original, NOT the 2025 sequel
    ("ASTRONEER",               361420),
    ("Forager",                 751780),
    ("The Gunk",               1087760),
    # Tier 3 -- reference / ceiling
    ("Deep Rock Galactic",      548430),
    ("Terraria",                105600),
    ("Valheim",                 892970),
    ("Teardown",               1167630),
    ("Outer Wilds",             753640),
    ("Enshrouded",             1203620),
    # From your original shortlist -- survival-craft cluster
    ("Grounded",                962130),
    ("Forever Skies",          1641960),
    ("Voidtrain",              1159690),
    ("7 Days to Die",           251570),
    ("Abiotic Factor",          427410),
    ("RuneScape: Dragonwilds", 1374490),
    ("SurrounDead",            1645820),
    ("DayZ",                    221100),
    ("ICARUS",                 1149460),
    ("ASKA",                   1898300),   # Sand Sailor Studio, Jun 2024
    # ("Dune: Awakening", ...)  <- discarded per your call
]

client = httpx.Client(
    timeout=30,
    headers={"User-Agent": "indie-market-research/1.0 (contact: you@example.com)"},
    follow_redirects=True,
)

log_rows = []
def log(appid, endpoint, url, n_records, status):
    log_rows.append({
        "retrieved_date": TODAY, "appid": appid, "endpoint": endpoint,
        "url": url, "n_records": n_records, "status": status,
    })

def cache_path(tag): return RAW / f"{tag}.json"

def get_json(url, tag, endpoint, appid, force=False):
    """GET with on-disk cache. The cached file IS the provenance receipt."""
    cp = cache_path(tag)
    if cp.exists() and not force:
        data = json.loads(cp.read_text())
        log(appid, endpoint, url, data.get("_n", "cached"), "cache")
        return data
    time.sleep(PAUSE)
    r = client.get(url)
    status = r.status_code
    try:
        data = r.json()
    except Exception:
        data = {"_raw": r.text}
    cp.write_text(json.dumps(data))
    log(appid, endpoint, url, "-", status)
    return data

# ---------------------------------------------------------------------------
def resolve_appid(title):
    url = f"https://store.steampowered.com/api/storesearch/?term={httpx.QueryParams({'t': title})['t']}&l={LANG}&cc={CC}"
    # simpler: build manually
    url = f"https://store.steampowered.com/api/storesearch/?term={title.replace(' ', '%20')}&l={LANG}&cc={CC}"
    slug = "search_" + hashlib.md5(title.encode()).hexdigest()[:8]
    data = get_json(url, slug, "storesearch", "?")
    items = data.get("items", [])
    if not items:
        print(f"  !! could not resolve appid for {title!r} -- pin it by hand")
        return None
    # take the top hit; print it so you can sanity-check the match
    top = items[0]
    print(f"  resolved {title!r} -> {top['id']}  ({top.get('name')})")
    return top["id"]

def fetch_details(appid, cc=CC):
    """Store facts for one appid in one region.

    ALWAYS force-refreshed. Price is the most volatile field in this dataset -- a
    game can be repriced or put on sale any day -- and serving it from a disk cache
    silently files a stale number as fact. (Valheim's list price went $19.99 ->
    $29.99 between two runs; the cached copy would have kept reporting $19.99.)
    The cache file is still written, because it is the provenance receipt."""
    url = (f"https://store.steampowered.com/api/appdetails"
           f"?appids={appid}&cc={cc}&l={LANG}")
    data = get_json(url, f"details_{cc}_{appid}", "appdetails", appid, force=True)
    node = data.get(str(appid), {})
    if not node.get("success"):
        return None
    return node["data"]

def price_fields(node, suffix):
    """price_overview -> the list price, the live price, and the discount between.
    `initial` is the list price; `final` is what you'd pay right now. Some rows carry
    only `final` (nothing on sale), so fall back to it for the base."""
    p = (node or {}).get("price_overview") or {}
    ini, fin = p.get("initial"), p.get("final")
    base = ini or fin
    return {
        f"base_price_{suffix}": round(base / 100, 2) if base else "",
        f"current_price_{suffix}": round(fin / 100, 2) if fin else "",
        f"discount_pct_{suffix}": p.get("discount_percent", 0) if p else "",
    }

# Everything except the weekly windows is force-refreshed. A cached copy of any of
# these silently files a month-old number as today's fact -- and it did: the first
# version of this script cached the review summary, so review_count_total sat 25 days
# behind the launch curves. Dome Keeper read 21,727 against an actual 22,052, and the
# whole set was understated by 26,737 reviews, which then fed the Boxleiter unit
# estimates. Only the per-week counts are cacheable, because a CLOSED week is
# genuinely immutable; nothing else about a live game is.

def fetch_steamspy(appid):
    """Free owners estimate -- rough, label EST. Also gives user tags."""
    url = f"https://steamspy.com/api.php?request=appdetails&appid={appid}"
    return get_json(url, f"steamspy_{appid}", "steamspy", appid, force=True)

def fetch_review_summary(appid):
    """Returns (default_summary, total_including_offtopic).

    Steam keeps TWO totals and the gap is not noise. The default excludes reviews
    inside a flagged off-topic review-bomb window; passing filter_offtopic_activity=0
    puts them back. For 7 Days to Die that is 9,214 reviews -- 2.3% of the game.
    The weekly curve counts them, because we are using reviews as a SALES proxy and
    someone review-bombing a game still bought it. The store-page figure excludes
    them. Both get stored, under names that say which is which."""
    base = (f"https://store.steampowered.com/appreviews/{appid}"
            f"?json=1&language=all&purchase_type=all&num_per_page=0")
    data = get_json(base, f"revsum_{appid}", "appreviews_summary", appid, force=True)
    allr = get_json(base + "&filter_offtopic_activity=0", f"revsum_all_{appid}",
                    "appreviews_summary_all", appid, force=True)
    return data.get("query_summary", {}), (allr.get("query_summary", {}) or {}).get("total_reviews")

def fetch_histogram(appid):
    """ONE request -> the game's entire review history as monthly rollups.
    We use it only to learn the true span (first and last month that hold any
    review) so the weekly walk never spends a call on a week that cannot contain
    data, and as an independent cross-check on the weekly totals."""
    url = f"https://store.steampowered.com/appreviewhistogram/{appid}?l={LANG}"
    # force: this decides how far forward the weekly walk goes. A cached histogram
    # would cap the walk at an old end date and silently stop collecting new weeks.
    d = get_json(url, f"histogram_{appid}", "appreviewhistogram", appid, force=True)
    return (d or {}).get("results", {}) or {}

def week_window_count(appid, start_ts):
    """HARD review count for ONE week window -> (total, positive, negative).

    num_per_page=0 means Steam sends the summary and no review bodies, so the
    response stays tiny no matter how busy the week was. filter_offtopic_activity=0
    keeps review-bombs in: a bomb is still a purchase, and we are counting reviews
    as a sales proxy, not scoring sentiment."""
    url = (f"https://store.steampowered.com/appreviews/{appid}"
           f"?json=1&filter=all&language=all&purchase_type=all"
           f"&filter_offtopic_activity=0&num_per_page=0"
           f"&start_date={start_ts}&end_date={start_ts + WEEK}&date_range_type=include")
    for attempt in range(RETRIES):
        time.sleep(PAUSE * (1 + attempt * 3))          # back off on retry
        try:
            r = client.get(url)
            if r.status_code == 200:
                q = r.json().get("query_summary", {})
                return (int(q.get("total_reviews", 0) or 0),
                        int(q.get("total_positive", 0) or 0),
                        int(q.get("total_negative", 0) or 0))
        except Exception:
            pass
    raise RuntimeError(f"week window {start_ts} for {appid} failed after {RETRIES} tries")

def weekly_counts(appid, launch_ts):
    """Weekly review counts for a game's whole life -> {week_index: (tot, pos, neg)}.

    week_index 0 is the launch week. NEGATIVE indices are real and deliberate: a
    game whose Steam release_date is its 1.0 date (Core Keeper, Abiotic Factor)
    has genuine review history from Early Access before week 0. The old code
    clamped all of it into week 0, manufacturing a launch spike out of two years
    of Early Access. We keep it, at its real position, and let build_data decide
    what to do with it.

    Cached per game in data/raw/weeks_<appid>.json, so a re-run only pays for
    weeks that are new or that were still in progress when we last looked."""
    cp = RAW / f"weeks_{appid}.json"
    cache = json.loads(cp.read_text()) if cp.exists() else {}
    now = int(time.time())

    hist = fetch_histogram(appid)
    rollups = hist.get("rollups") or []
    if rollups:
        first_ts = min(int(x["date"]) for x in rollups)
        last_ts = max(int(x["date"]) for x in rollups)
        hist_total = sum(int(x.get("recommendations_up", 0)) + int(x.get("recommendations_down", 0))
                         for x in rollups)
    else:                                   # no histogram -> walk from launch to now
        first_ts, last_ts, hist_total = launch_ts, now, None

    first_wk = min(0, (first_ts - launch_ts) // WEEK)
    last_wk = (min(last_ts + 31 * 86400, now) - launch_ts) // WEEK

    fetched = 0
    for wk in range(first_wk, last_wk + 1):
        start = launch_ts + wk * WEEK
        if start > now:
            break
        key = str(wk)
        hit = cache.get(key)
        # a week sampled while it was still open under-counts -> re-ask for it
        if hit and hit.get("f", 0) >= start + WEEK:
            continue
        # weeks entirely before the first review that exists cannot hold one
        if start + WEEK < first_ts:
            cache[key] = {"t": 0, "p": 0, "n": 0, "f": now}
            continue
        tot, pos, neg = week_window_count(appid, start)
        cache[key] = {"t": tot, "p": pos, "n": neg, "f": now}
        fetched += 1
        if fetched % 25 == 0:
            cp.write_text(json.dumps(cache))          # checkpoint; long walks survive a crash
            print(f"    ...week {wk}/{last_wk}  ({fetched} fetched)")

    cp.write_text(json.dumps(cache))
    out = {int(k): (v["t"], v["p"], v["n"]) for k, v in cache.items()}
    log(appid, "appreviews_window", f"weeks {first_wk}..{last_wk}", len(out), f"fetched {fetched}")
    return out, hist_total

# ---------------------------------------------------------------------------
def to_week_index(ts, launch_ts):
    return (ts - launch_ts) // WEEK

def build_one(title, hint):
    """Fetch a single game -> (games_row_or_None, ts_rows). Reusable by full run + --add."""
    appid = hint or resolve_appid(title)
    if not appid:
        return None, []
    print(f"[{appid}] {title}")
    d = fetch_details(appid)
    if not d:
        print("  !! appdetails failed -- skipping"); return None, []

    rd = d.get("release_date", {}).get("date", "")     # e.g. '27 Sep, 2022'
    launch_ts = None
    for fmt in ("%d %b, %Y", "%b %d, %Y", "%d %B %Y", "%B %d, %Y"):
        try:
            launch_ts = int(time.mktime(time.strptime(rd, fmt))); break
        except Exception:
            pass

    d_alt = fetch_details(appid, cc=CC_ALT)          # Finland -> the EUR price
    spy = fetch_steamspy(appid)
    summ, total_all = fetch_review_summary(appid)

    owners = spy.get("owners", "")                      # e.g. '500,000 .. 1,000,000'
    tags = ", ".join(list(spy.get("tags", {}).keys())[:8]) if isinstance(spy.get("tags"), dict) else ""

    total_reviews = summ.get("total_reviews") or 0

    # PRICE. Steam hands back two numbers per region and they are not
    # interchangeable: `initial` is the list price, `final` is what you'd pay right
    # now after any live discount. The dashboard plots the LIST price, because a game
    # that happened to be 75% off the day we fetched is not a $7 game.
    # Two regions, because Steam sets regional prices per region rather than
    # converting: the EUR figure is its own decision, not $ x an exchange rate.
    # Honest limit: this is TODAY's list price, not the launch price. A studio that
    # permanently repriced shows the new number; Steam exposes no price history.
    prices = {**price_fields(d, "usd"), **price_fields(d_alt, "eur")}
    game_row = {
        "game_id": appid,
        "steam_appid": appid,
        "title": d.get("name", title),
        "developer": "; ".join(d.get("developers", []) or []),
        "publisher": "; ".join(d.get("publishers", []) or []),
        "release_date_raw": rd,
        "release_date": (dt.date.fromtimestamp(launch_ts).isoformat() if launch_ts else ""),
        "is_free": d.get("is_free", False),
        **prices,                                   # base/current/discount x usd + eur
        "price_region_eur": CC_ALT,                 # which store the EUR price is from
        "price_retrieved": TODAY,                   # prices go stale fast -- date them
        "genres": ", ".join(g["description"] for g in d.get("genres", [])),
        "steam_top_tags": tags,
        "platforms": ", ".join(k for k, v in d.get("platforms", {}).items() if v),
        "review_count_total": summ.get("total_reviews", ""),   # store-page figure
        "review_count_all": total_all if total_all is not None else "",  # + off-topic bombs
        "review_bombed": ((total_all - summ["total_reviews"])
                          if (total_all is not None and summ.get("total_reviews") is not None) else ""),
        "review_positive_pct": (round(summ.get("total_positive", 0) / summ["total_reviews"], 3)
                                if summ.get("total_reviews") else ""),
        "review_desc": summ.get("review_score_desc", ""),
        "review_curve_coverage": "",          # MEASURED below, never asserted up front
        "curve_capture_pct": "",
        "curve_first_week": "",
        "reviews_start_week": "",
        "pre_launch_reviews": "",
        "steamspy_owners_est": owners,        # EST -- rough, wide band
        "retrieved_date": TODAY,
    }

    ts_rows = []
    if launch_ts:
        buckets, hist_total = weekly_counts(appid, launch_ts)
        weeks = sorted(buckets)
        pre = sum(buckets[w][0] for w in weeks if w < 0)
        # The histogram's first rollup is the START of launch month, so it can hand
        # back a week -2 that holds nothing. Keep negative weeks only where real
        # Early Access reviews live; otherwise the series starts at week 0.
        nonzero = [w for w in weeks if buckets[w][0] > 0]
        first_wk = min(0, nonzero[0]) if nonzero else 0
        cum = 0
        for wk in range(first_wk, weeks[-1] + 1):
            tot, pos, neg = buckets.get(wk, (0, 0, 0))
            cum += tot
            ts_rows.append({
                "game_id": appid,
                "week_index": wk,
                "week_start": (dt.date.fromtimestamp(launch_ts + wk * WEEK).isoformat()),
                "reviews_new": tot,
                "reviews_new_positive": pos,
                "reviews_new_negative": neg,
                "reviews_cumulative": cum,
                "peak_ccu": "", "price_that_week": "", "on_sale": "",
                "discount_pct": "", "est_units_week": "", "est_revenue_week": "",
                "event_note": "",
            })
        # Coverage is now something we CHECK, not something we claim. The old code
        # decided "full" from the review count before fetching anything, so three
        # games whose cursor dead-ended early were shipped as complete curves.
        # Check against the bombs-INCLUDED total, because that is what the weekly
        # windows count. Comparing to the store-page figure made 7 Days to Die look
        # like a 102.3% capture when both numbers were in fact correct.
        captured = cum
        ref = total_all or total_reviews
        pct = round(captured / ref, 3) if ref else ""
        game_row["curve_capture_pct"] = pct
        game_row["review_curve_coverage"] = ("full" if (pct != "" and pct >= 0.9) else "partial")
        game_row["curve_first_week"] = first_wk
        # The first week that actually holds a review. Usually 0, but a game can
        # ship with its reviews starting later; when it does, the curve has no
        # recoverable launch and the dashboard has to say so rather than draw a
        # flat line along the axis, which reads as a flop.
        # (Note: pre-2013 games are NOT this case. Steam's review system launched
        # Nov 2013 and absorbed the older Community recommendations keeping their
        # original dates, so Terraria does have real week-0 data from 2011. What it
        # has instead is a ~9x artificial spike the week the feature went live.)
        game_row["reviews_start_week"] = nonzero[0] if nonzero else ""
        game_row["pre_launch_reviews"] = pre
        print(f"  {captured} reviews over weeks {first_wk}..{weeks[-1]}"
              f"  [{game_row['review_curve_coverage']} {pct}"
              + (f", {pre} pre-launch/EA" if pre else "") + "]")
    return game_row, ts_rows

def build_rows():
    games_rows, ts_rows = [], []
    for title, hint in GAMES:
        g, ts = build_one(title, hint)
        if g:
            games_rows.append(g)
            ts_rows.extend(ts)
    return games_rows, ts_rows

def write_csv(path, rows):
    if not rows:
        print(f"  (no rows for {path.name})"); return
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()), lineterminator="\n")
        w.writeheader(); w.writerows(rows)
    print(f"wrote {path}  ({len(rows)} rows)")

# --- single-game merge (used by `--add`, i.e. adding a competitor from the dashboard) ---
def _read(path):
    if not path.exists():
        return [], None
    with open(path, encoding="utf-8-sig", newline="") as f:
        r = csv.DictReader(f)
        return list(r), r.fieldnames

def _write(path, fieldnames, rows):
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames, lineterminator="\n")
        w.writeheader()
        for row in rows:
            w.writerow({k: row.get(k, "") for k in fieldnames})

def add_game(appid, title):
    """Fetch ONE appid and merge it into the SCRIPT-owned CSVs (replace-in-place
    for games_steam + timeseries, append for fetch_log). Leaves every other game
    untouched, so a re-run doesn't re-hammer Steam for the whole set."""
    appid = str(appid).strip()
    game_row, ts_new = build_one(title or appid, int(appid) if appid.isdigit() else appid)
    if not game_row:
        raise SystemExit(f"could not fetch appid {appid}")

    gs_path, ts_path, log_path = DATA / "games_steam.csv", DATA / "timeseries.csv", DATA / "fetch_log.csv"

    gs_rows, gs_fields = _read(gs_path)
    gs_fields = gs_fields or list(game_row.keys())
    gs_rows = [r for r in gs_rows if str(r.get("game_id", "")).strip() != appid]
    gs_rows.append({k: game_row.get(k, "") for k in gs_fields})
    _write(gs_path, gs_fields, gs_rows)

    ts_rows, ts_fields = _read(ts_path)
    ts_fields = ts_fields or (list(ts_new[0].keys()) if ts_new else [])
    ts_rows = [r for r in ts_rows if str(r.get("game_id", "")).strip() != appid]
    ts_rows.extend({k: r.get(k, "") for k in ts_fields} for r in ts_new)
    if ts_fields:
        _write(ts_path, ts_fields, ts_rows)

    log_rows_existing, log_fields = _read(log_path)
    log_fields = log_fields or list(log_rows[0].keys()) if log_rows else ["retrieved_date", "appid", "endpoint", "url", "n_records", "status"]
    log_rows_existing.extend({k: r.get(k, "") for k in log_fields} for r in log_rows)
    _write(log_path, log_fields, log_rows_existing)

    print(f"merged appid {appid} into games_steam ({len(gs_rows)} rows), timeseries ({len(ts_new)} new weeks)")

def refresh_prices():
    """Re-price every tracked game WITHOUT re-walking the review weeks.

    Prices move constantly and the weekly walk is the slow part, so these are worth
    separating: this is ~2 requests per game and finishes in under a minute, against
    ~90 minutes for a full run. Touches only the price columns; every other column,
    including the whole launch curve, is left exactly as it was."""
    path = DATA / "games_steam.csv"
    rows, fields = _read(path)
    if not rows:
        raise SystemExit("games_steam.csv is empty -- run a full fetch first")

    for f in ("base_price_usd", "current_price_usd", "discount_pct_usd",
              "base_price_eur", "current_price_eur", "discount_pct_eur",
              "price_region_eur", "price_retrieved"):
        if f not in fields:
            fields.append(f)

    for r in rows:
        appid = str(r.get("game_id", "")).strip()
        d = fetch_details(appid)
        if not d:
            print(f"  !! {appid} {r.get('title','')}: appdetails failed, keeping old price")
            continue
        d_alt = fetch_details(appid, cc=CC_ALT)
        before = r.get("base_price_usd", "")
        r.update(price_fields(d, "usd"))
        r.update(price_fields(d_alt, "eur"))
        r["price_region_eur"], r["price_retrieved"] = CC_ALT, TODAY
        moved = "  <- CHANGED" if str(before) != str(r["base_price_usd"]) else ""
        print(f"  {r.get('title','')[:28]:30} ${r['base_price_usd']}  /  EUR {r['base_price_eur']}{moved}")

    _write(path, fields, rows)
    print(f"\nrepriced {len(rows)} games in {path.name}. "
          f"Now re-run build_data.py to push it into the dashboard.")

if __name__ == "__main__":
    if len(sys.argv) >= 2 and sys.argv[1] == "--prices":
        refresh_prices()
    elif len(sys.argv) >= 3 and sys.argv[1] == "--add":
        add_game(sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else "")
    else:
        games_rows, ts_rows = build_rows()
        write_csv(DATA / "games_steam.csv", games_rows)
        write_csv(DATA / "timeseries.csv", ts_rows)
        write_csv(DATA / "fetch_log.csv", log_rows)
        print("\nDone. games_steam + timeseries are SCRIPT-owned -- never hand-edit them.")
        print("All appids in GAMES are pinned and verified; if you add one, pin it too.")
