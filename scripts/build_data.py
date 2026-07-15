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

def load(name):
    with open(DATA / name, encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))

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
        "release_date": s.get("release_date", ""), "price_usd": num(s.get("current_price_usd")),
        "genres": s.get("genres", ""), "steam_tags": s.get("steam_top_tags", ""),
        "platforms": s.get("platforms", ""), "publisher": s.get("publisher", ""),
        "developer": s.get("developer", ""),
        "review_count": num(s.get("review_count_total")),
        "review_pct": num(s.get("review_positive_pct")),
        "review_desc": s.get("review_desc", ""),
        "curve_coverage": s.get("review_curve_coverage", ""),
        "est_units_low": num(e.get("est_units_low")), "est_units_mid": num(e.get("est_units_mid")),
        "est_units_high": num(e.get("est_units_high")),
        "est_revenue_gross_mid": num(e.get("est_revenue_gross_mid")),
        "est_ratio": num(e.get("units_gamalytic_vs_boxleiter")),
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
    "review_count": None, "review_pct": None, "review_desc": "", "curve_coverage": "",
    "est_units_low": None, "est_units_mid": None, "est_units_high": None,
    "est_revenue_gross_mid": None, "est_ratio": None,
    "is_our_game": True, "placeholder": True,
    "target_price_usd": 19.99, "ea_window": "TBD",
})

# launch curves: full-curve games only (recent-tail giants have no real week 0)
by = {}
for r in load("timeseries.csv"):
    by.setdefault(r["game_id"], []).append(r)
full_ids = {gid for gid, s in steam.items() if s.get("review_curve_coverage") == "full"}
curves = {}
for gid, rows in by.items():
    if gid not in full_ids:
        continue
    rows = sorted(rows, key=lambda r: int(r["week_index"]))
    total = int(rows[-1]["reviews_cumulative"]) if rows else 0
    if total <= 0:
        continue
    curves[gid] = [{"w": int(r["week_index"]), "new": int(r["reviews_new"]),
                    "cum": int(r["reviews_cumulative"]),
                    "pct": round(int(r["reviews_cumulative"]) / total, 4)} for r in rows]

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
                              "Only games with a full review history appear; million-review giants are "
                              "excluded because their launch weeks are unrecoverable from the reviews API."),
        "est_note": "Units & revenue are ESTIMATES, never sales data. Revenue is GROSS (Valve takes 30%+).",
    },
    "games": games,
    "launch_curves": curves,
}

path = OUT / "data.json"
with open(path, "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False)
print(f"wrote {path}  ({len(games)} games, {len(curves)} launch curves)")
