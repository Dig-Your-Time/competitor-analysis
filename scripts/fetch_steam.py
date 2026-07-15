#!/usr/bin/env python3
"""
fetch_steam.py  --  fills the two SCRIPT-owned data files.

Run this in an environment with open network (your machine / Claude Code).
It never touches the HAND-owned files (games_manual.csv, companies.csv, ...).

What it writes:
  data/games_steam.csv   one row per game: Steam-side facts (HARD) + a SteamSpy
                         owners estimate (EST, clearly labelled)
  data/timeseries.csv    one row per game per week: review accumulation curve
                         (HARD) normalised to week_index 0 = launch week
  data/fetch_log.csv     the provenance receipt: what appid, which endpoint,
                         when, how many records. This is why timeseries needs
                         no per-row source column.
  data/raw/*.json        cached raw API responses (gitignore this dir)

Input: GAMES below -- a list of (title, hint_appid). If hint_appid is None the
script resolves it by name via Steam's store search. Pinning the appid once it
is known makes runs deterministic, so paste resolved ids back in.

No API key required. Be polite: this rate-limits and caches so a re-run does
not re-hammer Steam.
"""

import csv, json, os, time, sys, hashlib, urllib.parse, datetime as dt
from pathlib import Path

try:
    import httpx
except ImportError:
    sys.exit("pip install httpx   (or swap the two get() calls for requests)")

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
RAW  = DATA / "raw"
RAW.mkdir(parents=True, exist_ok=True)

CC, LANG = "us", "english"          # currency / language for pricing + reviews
PAUSE = 0.8                          # seconds between review-page calls; be a good citizen
TODAY = dt.date.today().isoformat()

# --- launch-curve capture policy ------------------------------------------
# filter=recent walks reviews newest->oldest, so reaching launch week 0 means
# paging a game's ENTIRE review history. Feasible for our direct/adjacent comps;
# not for million-review ceiling games (Terraria, DayZ, ...), whose launch week
# is simply unreachable from this endpoint. For those we don't burn an hour
# paging -- we grab a short recent sample and flag the row tail-only, so the
# dashboard can exclude them from launch-curve overlays instead of drawing junk.
CAP_REVIEWS = 100_000    # more reviews than this -> launch week unreachable -> tail-only
MAX_PAGES   = 1200       # 120k reviews; fully covers every game at/under CAP_REVIEWS
TAIL_PAGES  = 8          # recent-only pages for oversized ceiling games

# ---------------------------------------------------------------------------
# INPUT LIST.  hint_appid None -> resolve by name. Pin ids after first run.
# ---------------------------------------------------------------------------
GAMES = [
    # Tier 1 -- direct
    ("Dome Keeper",            1637320),
    ("SteamWorld Dig",         None),
    ("SteamWorld Dig 2",       None),
    ("Hydroneer",              None),
    ("Core Keeper",            1621690),
    ("Noita",                  None),
    ("Techtonica",             None),
    ("Cave Digger 2",          None),
    # Tier 2 -- adjacent
    ("Moonlighter",            606150),   # pin: name-search returns the 2025 sequel

    ("ASTRONEER",              None),
    ("Forager",                None),
    ("The Gunk",               None),
    # Tier 3 -- reference / ceiling
    ("Deep Rock Galactic",     548430),
    ("Terraria",               105600),
    ("Valheim",                892970),
    ("Teardown",               1167630),
    ("Outer Wilds",            753640),
    ("Enshrouded",             1203620),
    # From your original shortlist -- survival-craft cluster
    ("Grounded",               962130),
    ("Forever Skies",          None),
    ("Voidtrain",              None),
    ("7 Days to Die",          251570),
    ("Abiotic Factor",         427410 and None),
    ("RuneScape: Dragonwilds", None),
    ("SurrounDead",            None),
    ("DayZ",                   221100),
    ("ICARUS",                 1149460),
    ("ASKA",                   1731210 and None),
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

def fetch_details(appid):
    url = (f"https://store.steampowered.com/api/appdetails"
           f"?appids={appid}&cc={CC}&l={LANG}")
    data = get_json(url, f"details_{appid}", "appdetails", appid)
    node = data.get(str(appid), {})
    if not node.get("success"):
        return None
    return node["data"]

def fetch_steamspy(appid):
    """Free owners estimate -- rough, label EST. Also gives user tags."""
    url = f"https://steamspy.com/api.php?request=appdetails&appid={appid}"
    return get_json(url, f"steamspy_{appid}", "steamspy", appid)

def fetch_review_summary(appid):
    url = (f"https://store.steampowered.com/appreviews/{appid}"
           f"?json=1&language=all&purchase_type=all&num_per_page=0")
    data = get_json(url, f"revsum_{appid}", "appreviews_summary", appid)
    return data.get("query_summary", {})

def fetch_all_reviews(appid, max_pages=MAX_PAGES):
    """Paginate the review cursor, collect every review timestamp.
    Review timestamps are HARD data -- the shape of the accumulation curve is
    directly observed, not estimated."""
    timestamps, cursor, seen = [], "*", set()
    for page in range(max_pages):
        url = (f"https://store.steampowered.com/appreviews/{appid}"
               f"?json=1&filter=recent&language=all&purchase_type=all"
               f"&num_per_page=100&cursor={urllib.parse.quote(cursor, safe='')}")
        tag = f"reviews_{appid}_p{page}"
        data = get_json(url, tag, "appreviews", appid)
        revs = data.get("reviews", [])
        if not revs:
            break
        for rv in revs:
            timestamps.append(rv["timestamp_created"])
        nxt = data.get("cursor")
        if not nxt or nxt in seen:      # cursor stopped advancing -> done
            break
        seen.add(nxt); cursor = nxt
    return sorted(timestamps)

# ---------------------------------------------------------------------------
def to_week_index(ts, launch_ts):
    return (ts - launch_ts) // (7 * 86400)

def build_rows():
    games_rows, ts_rows = [], []
    for title, hint in GAMES:
        appid = hint or resolve_appid(title)
        if not appid:
            continue
        print(f"[{appid}] {title}")
        d = fetch_details(appid)
        if not d:
            print("  !! appdetails failed -- skipping"); continue

        rd = d.get("release_date", {}).get("date", "")     # e.g. '27 Sep, 2022'
        launch_ts = None
        for fmt in ("%d %b, %Y", "%b %d, %Y", "%d %B %Y", "%B %d, %Y"):
            try:
                launch_ts = int(time.mktime(time.strptime(rd, fmt))); break
            except Exception:
                pass

        price = d.get("price_overview", {})
        spy = fetch_steamspy(appid)
        summ = fetch_review_summary(appid)

        owners = spy.get("owners", "")                      # e.g. '500,000 .. 1,000,000'
        tags = ", ".join(list(spy.get("tags", {}).keys())[:8]) if isinstance(spy.get("tags"), dict) else ""

        # HARD review total decides whether the launch curve is even reachable.
        total_reviews = summ.get("total_reviews") or 0
        full_curve = bool(total_reviews) and total_reviews <= CAP_REVIEWS

        games_rows.append({
            "game_id": appid,
            "steam_appid": appid,
            "title": d.get("name", title),
            "developer": "; ".join(d.get("developers", []) or []),
            "publisher": "; ".join(d.get("publishers", []) or []),
            "release_date_raw": rd,
            "release_date": (dt.date.fromtimestamp(launch_ts).isoformat() if launch_ts else ""),
            "is_free": d.get("is_free", False),
            "current_price_usd": (price.get("final", 0) / 100) if price else "",
            "currency": price.get("currency", "USD") if price else "USD",
            "genres": ", ".join(g["description"] for g in d.get("genres", [])),
            "steam_top_tags": tags,
            "platforms": ", ".join(k for k, v in d.get("platforms", {}).items() if v),
            "review_count_total": summ.get("total_reviews", ""),
            "review_positive_pct": (round(summ.get("total_positive", 0) / summ["total_reviews"], 3)
                                    if summ.get("total_reviews") else ""),
            "review_desc": summ.get("review_score_desc", ""),
            "review_curve_coverage": ("full" if full_curve else "recent-tail"),
            "steamspy_owners_est": owners,        # EST -- rough, wide band
            "retrieved_date": TODAY,
        })

        if launch_ts:
            stamps = fetch_all_reviews(appid, max_pages=(MAX_PAGES if full_curve else TAIL_PAGES))
            buckets = {}
            for ts in stamps:
                wk = to_week_index(ts, launch_ts)
                if wk < 0:            # a handful of pre-release/press reviews
                    wk = 0
                buckets[wk] = buckets.get(wk, 0) + 1
            cum = 0
            for wk in range(0, (max(buckets) if buckets else 0) + 1):
                new = buckets.get(wk, 0)
                cum += new
                ts_rows.append({
                    "game_id": appid,
                    "week_index": wk,
                    "week_start": (dt.date.fromtimestamp(launch_ts + wk * 7 * 86400).isoformat()),
                    "reviews_new": new,
                    "reviews_cumulative": cum,
                    "peak_ccu": "", "price_that_week": "", "on_sale": "",
                    "discount_pct": "", "est_units_week": "", "est_revenue_week": "",
                    "event_note": "",
                })
            print(f"  {len(stamps)} reviews -> {len(buckets)} weeks  [{'full' if full_curve else 'recent-tail'}]")
    return games_rows, ts_rows

def write_csv(path, rows):
    if not rows:
        print(f"  (no rows for {path.name})"); return
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        w.writeheader(); w.writerows(rows)
    print(f"wrote {path}  ({len(rows)} rows)")

if __name__ == "__main__":
    games_rows, ts_rows = build_rows()
    write_csv(DATA / "games_steam.csv", games_rows)
    write_csv(DATA / "timeseries.csv", ts_rows)
    write_csv(DATA / "fetch_log.csv", log_rows)
    print("\nDone. games_steam + timeseries are SCRIPT-owned -- never hand-edit them.")
    print("Sanity-check the resolved appids printed above, then pin them in GAMES.")
