#!/usr/bin/env python3
"""
build_data.py  --  joins every table into one dashboard/public/data.json.

The dashboard reads this ONE file and nothing else. Rebuild it whenever any CSV
changes:  python scripts/build_data.py

It joins on game_id (games) and company_id (studios), folds the estimate band in
next to the HARD Steam facts, and packs the launch curves (full-curve games only).
Nothing here invents data -- it only reshapes what the CSVs already hold.
"""
import csv, json, datetime as dt
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
OUT  = ROOT / "dashboard" / "public"
OUT.mkdir(parents=True, exist_ok=True)
YEAR = dt.date.today().year
REVIEWS_LIVE = "2013-11-25"      # the day Steam reviews went live; see pre_review_era

def load(name):
    with open(DATA / name, encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))

def load_optional(name):
    """For tables produced by a separate fetch (languages), so a fresh clone that
    has not run fetch_languages.py yet still builds instead of crashing."""
    p = DATA / name
    if not p.exists():
        print(f"  (no {name} yet -- run scripts/fetch_languages.py)")
        return []
    return load(name)

def num(v):
    v = (v or "").strip().replace(",", "")
    if v == "":
        return None
    try:
        f = float(v)
        return int(f) if f.is_integer() else f
    except ValueError:
        return None

seed  = load("games_manual_seed.csv")
steam = {r["game_id"]: r for r in load("games_steam.csv")}
est   = {r["game_id"]: r for r in load("estimates.csv")}
comp  = {r["company_id"]: r for r in load("companies.csv")}

games = []
for r in seed:
    gid = r["game_id"].strip()
    s = steam.get(gid, {})
    e = est.get(gid, {})
    c = comp.get(r["company_id"].strip(), {})
    founded = num(c.get("founded_year"))
    games.append({
        "game_id": gid, "title": r["title"],
        "tier": r["tier"], "comparable_class": r["comparable_class"],
        "production_tier": r["production_tier"], "relevance_note": r.get("relevance_note", ""),
        "company_id": r["company_id"], "company_name": c.get("company_name", ""),
        "country": c.get("country", ""), "region": c.get("region_bucket", ""),
        "status": c.get("company_status", ""), "company_size": c.get("company_size", ""),
        "self_published": c.get("self_published", ""), "parent_company": c.get("parent_company", ""),
        "company_founded": founded, "company_age": (YEAR - founded) if founded else None,
        # Both are LIST prices, never today's discounted price: a game caught mid-sale
        # is not a cheap game, and price_usd is the x-axis of the market map, the chart
        # that exists to inform our own pricing. price_eur is the Finnish store price,
        # a separate regional decision by the publisher rather than a conversion of the
        # dollar figure -- which is why it is fetched, not computed.
        "release_date": s.get("release_date", ""),
        "price_usd": num(s.get("base_price_usd")),
        "price_eur": num(s.get("base_price_eur")),
        "price_retrieved": s.get("price_retrieved", ""),
        "genres": s.get("genres", ""), "steam_tags": s.get("steam_top_tags", ""),
        # which languages the game SHIPS (as review-language codes, so it joins to
        # the language mix). The pair answers "did shipping this move its share?"
        "supported_languages": [c for c in (s.get("supported_language_codes") or "").split(";") if c],
        "platforms": s.get("platforms", ""), "publisher": s.get("publisher", ""),
        "developer": s.get("developer", ""),
        "review_count": num(s.get("review_count_total")),
        "review_pct": num(s.get("review_positive_pct")),
        "review_desc": s.get("review_desc", ""),
        "curve_coverage": s.get("review_curve_coverage", ""),
        "curve_capture_pct": num(s.get("curve_capture_pct")),
        "reviews_start_week": num(s.get("reviews_start_week")),
        "pre_launch_reviews": num(s.get("pre_launch_reviews")),
        # Steam's review system went live 2013-11-25 and absorbed the older Community
        # recommendations with their original dates -- so a 2011 game DOES have real
        # week-0 data. What it carries instead is a one-off spike the week the feature
        # launched and players reviewed the back catalogue (Terraria: ~9x its baseline).
        # Flag it so that bump isn't read as a sales event.
        "pre_review_era": bool(s.get("release_date", "")) and s.get("release_date", "") < REVIEWS_LIVE,
        "est_units_low": num(e.get("est_units_low")), "est_units_mid": num(e.get("est_units_mid")),
        "est_units_high": num(e.get("est_units_high")),
        "est_units_source": e.get("est_units_source", ""),
        "est_revenue_gross_mid": num(e.get("est_revenue_gross_mid")),
        "est_ratio": num(e.get("units_gamalytic_vs_boxleiter")),
        "src_est": e.get("src_est", ""),
        "src_registry": c.get("src_registry", ""), "src_headcount": c.get("src_headcount", ""),
        "is_our_game": False,
    })

# our game -- placeholder targets, to be corrected by the developer
games.append({
    "game_id": "our-game", "title": "Our game (placeholder)", "tier": "0-Ours",
    "comparable_class": "Mining/Digging", "production_tier": "Small team", "relevance_note": "Us.",
    "company_id": "ours", "company_name": "Your studio", "country": "Finland", "region": "Finland",
    "status": "Active", "company_size": "Micro (2-5)", "self_published": "TBD", "parent_company": "",
    "company_founded": YEAR - 3, "company_age": 3,
    "release_date": "", "price_usd": 19.99, "genres": "Adventure, Indie, Simulation",
    "steam_tags": "Mining, First-Person, Cozy, Exploration, Survival",
    "platforms": "windows", "publisher": "(undecided)", "developer": "Your studio",
    "review_count": 0, "review_pct": 0, "review_desc": "", "curve_coverage": "",
    "est_units_low": 0, "est_units_mid": 0, "est_units_high": 0,
    "est_revenue_gross_mid": 0, "est_ratio": None,
    "is_our_game": True, "placeholder": True,
    "target_price_usd": 19.99, "ea_window": "TBD",
})

# launch curves: EVERY game that has a real review history.
#
# The old rule kept only rows flagged "full", which dropped the eight biggest games
# outright -- their curves were never fetched because paging a million reviews was
# impractical. Weekly window counts removed that limit, so the filter is gone: if a
# game has reviews, it has a curve. What survives is honesty about the edges:
#
#   * leading zero weeks are TRIMMED, so a line begins where its data does instead
#     of running flat along the axis (which reads as "nobody bought it").
#     reviews_start_week records where that is.
#   * NEGATIVE weeks are kept. A game whose Steam release_date is its 1.0 date
#     (Techtonica: 1,984 of its 3,245 reviews predate 1.0) has a real Early Access
#     ramp to the left of week 0. The old code clamped all of it into week 0 and
#     manufactured a launch spike that never happened.
by = {}
for r in load("timeseries.csv"):
    by.setdefault(r["game_id"], []).append(r)

curves = {}
for gid, rows in by.items():
    rows = sorted(rows, key=lambda r: int(r["week_index"]))
    while rows and int(rows[0]["reviews_cumulative"]) == 0:      # trim the dead prefix
        rows.pop(0)
    total = int(rows[-1]["reviews_cumulative"]) if rows else 0
    if total <= 0:
        continue
    curves[gid] = [{"w": int(r["week_index"]), "new": int(r["reviews_new"]),
                    "cum": int(r["reviews_cumulative"]),
                    "pct": round(int(r["reviews_cumulative"]) / total, 4)} for r in rows]

# language mix: one game -> its review-language breakdown, biggest first.
# `share` is computed here from the rows themselves rather than against the
# all-languages total Steam reports, so it always sums to exactly 1 — the two
# readings can differ by a review or three, because reviews are posted and deleted
# while the ~32 requests for a game are in flight.
languages = {}
for r in load_optional("languages.csv"):
    languages.setdefault(r["game_id"], []).append(r)
for gid, rows in languages.items():
    total = sum(num(r["reviews"]) or 0 for r in rows) or 1
    languages[gid] = [{
        "lang": r["language"],
        "n": num(r["reviews"]),
        "share": round((num(r["reviews"]) or 0) / total, 5),
        "pos": num(r["reviews_positive"]),
        "neg": num(r["reviews_negative"]),
    } for r in sorted(rows, key=lambda x: -(num(x["reviews"]) or 0)) if num(r["reviews"])]

# Valve's own platform-wide language split. This is the denominator that makes a
# per-game share readable: 11% Simplified Chinese looks healthy until you see that
# Chinese is 22% of Steam. It measures CLIENT language while reviews measure the
# language someone wrote in, so it is sound for comparing games to each other and
# not for reading an absolute share of players off a single game.
language_baseline = {r["language"]: num(r["steam_share_pct"])
                     for r in load_optional("steam_language_baseline.csv")}

# company financials: one company -> its filed annual rows (native currency kept;
# CLAUDE.md rule -> currency is converted in the dashboard, never in the data).
fin_by = {}
for r in load("financials.csv"):
    fin_by.setdefault(r["company_id"].strip(), []).append(r)

financials = []
for cid, rows in fin_by.items():
    c = comp.get(cid, {})
    rows = sorted(rows, key=lambda r: r.get("fiscal_year", ""))
    years = [{
        "fiscal_year": num(r.get("fiscal_year")),
        "revenue": num(r.get("revenue")),
        "operating_profit": num(r.get("operating_profit")),
        "net_profit": num(r.get("net_profit")),
        "employees_avg": num(r.get("employees_avg")),
        "source_id": r.get("source_id", ""),
        "note": r.get("notes", ""),
    } for r in rows]
    financials.append({
        "company_id": cid,
        "company_name": c.get("company_name", ""),
        "country": c.get("country", ""),
        "region": c.get("region_bucket", ""),
        "status": c.get("company_status", ""),
        "self_published": c.get("self_published", ""),
        "currency": next((r.get("currency", "") for r in rows if r.get("currency")), ""),
        "years": years,
        "has_revenue": any(y["revenue"] is not None for y in years),
    })

# sources lookup: every source_id -> the one place its URL + archive URL live.
# The whole point of the src_* columns is that they hold an id, not a 90-char URL.
SRC_FIELDS = ("source_type", "title", "url", "archive_url", "outlet",
              "author", "date_published", "reliability", "notes")
sources = {r["source_id"]: {k: r.get(k, "") for k in SRC_FIELDS} for r in load("sources.csv")}

# funding & ownership: one company -> its rounds. Amounts stay native (dashboard
# converts). Valuations are deliberately dropped per CLAUDE.md (not obtainable).
fund_by = {}
for r in load("funding.csv"):
    fund_by.setdefault(r["company_id"].strip(), []).append(r)

funding = []
for cid, rows in fund_by.items():
    c = comp.get(cid, {})
    funding.append({
        "company_id": cid,
        "company_name": c.get("company_name", ""),
        "country": c.get("country", ""),
        "region": c.get("region_bucket", ""),
        "status": c.get("company_status", ""),
        "parent_company": c.get("parent_company", ""),
        "rounds": [{
            "round_date": r.get("round_date", ""),
            "funding_stage": r.get("funding_stage", ""),
            "amount": num(r.get("amount")),
            "currency": r.get("currency", ""),
            "investors": r.get("investors", ""),
            "confidence": r.get("confidence", ""),
            "source_id": r.get("source_id", ""),
            "note": r.get("notes", ""),
        } for r in rows],
    })

# ownership roster: every distinct tracked studio, for the "who owns whom" view
seen_co = {}
for g in games:
    cid = g.get("company_id")
    if cid and cid not in seen_co and not g.get("is_our_game"):
        c = comp.get(cid, {})
        seen_co[cid] = {
            "company_id": cid, "company_name": g.get("company_name", ""),
            "region": g.get("region", ""), "country": g.get("country", ""),
            "status": g.get("status", ""), "parent_company": g.get("parent_company", ""),
            "self_published": g.get("self_published", ""),
            "city": c.get("city", ""), "founded_year": num(c.get("founded_year")),
            "company_size": c.get("company_size", ""), "website": c.get("website", ""),
            "src_registry": c.get("src_registry", ""), "src_headcount": c.get("src_headcount", ""),
        }

# also surface studios filed in companies.csv that have no tracked game yet, so a
# newly-added studio is visible in Browse before its first game is fetched.
for cid, c in comp.items():
    if cid and cid not in seen_co:
        seen_co[cid] = {
            "company_id": cid, "company_name": c.get("company_name", ""),
            "region": c.get("region_bucket", ""), "country": c.get("country", ""),
            "status": c.get("company_status", ""), "parent_company": c.get("parent_company", ""),
            "self_published": c.get("self_published", ""),
            "city": c.get("city", ""), "founded_year": num(c.get("founded_year")),
            "company_size": c.get("company_size", ""), "website": c.get("website", ""),
            "src_registry": c.get("src_registry", ""), "src_headcount": c.get("src_headcount", ""),
        }

data = {
    "generated": dt.date.today().isoformat(),
    "meta": {
        "confidence": {
            "HARD": "filed / directly observed (reviews, dates, prices, Nordic accounts)",
            "EST": "modelled estimate (units, revenue) - shown as a band, never a point",
            "ANEC": "someone said it out loud (dev tweets, interviews, postmortems)",
        },
        "tiers": {
            "1-Direct": "small-scope mining/dig loop - the core comparable set",
            "2-Adjacent": "related loop or tone",
            "3-Reference": "big / multiplayer - ceiling markers, not typical-case",
            "X-Drop?": "survival-craft cluster - different genre, labelled not deleted",
            "0-Ours": "our game",
        },
        "launch_curve_note": ("Cumulative REVIEWS (a HARD proxy for sales velocity), week 0 = launch. "
                              "Every tracked game with a review history appears, counted a week at a "
                              "time from Steam's own review index. Negative weeks are Early Access, "
                              "before a game's 1.0 date. Games released before 2013-11-25 carry a "
                              "one-off spike the week Steam's review feature launched -- that bump "
                              "is the feature, not a sale."),
        "est_note": "Units & revenue are ESTIMATES, never sales data. Revenue is GROSS (Valve takes 30%+).",
        "language_note": ("Share of REVIEWS by language, not of players -- review propensity "
                          "differs by language community and there is no ground truth to "
                          "correct it with. Comparing one game to another is sound; reading "
                          "an absolute share of players off it is not. It is also not country: "
                          "Spanish spans Spain and Latin America. Steam publishes no country "
                          "data for games you do not own."),
    },
    "games": games,
    "launch_curves": curves,
    "languages": languages,
    "language_baseline": language_baseline,
    "financials": financials,
    "funding": funding,
    "companies": list(seen_co.values()),
    "sources": sources,
}

path = OUT / "data.json"
with open(path, "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False)
print(f"wrote {path}  ({len(games)} games, {len(curves)} launch curves)")
