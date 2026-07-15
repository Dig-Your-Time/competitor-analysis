#!/usr/bin/env python3
"""
build_estimates.py  --  joins the two estimate sources into one honest band.

Reads (never writes):
  data/gamalytic_stats.csv   vendor model, ONE point per game (our mid)
  data/games_steam.csv       HARD Steam review counts (input to Boxleiter)

Writes (SCRIPT-owned, never hand-edit):
  data/estimates.csv         est_units low/mid/high + gross revenue, one row/game

Why a band and not a single number:
  Valve never publishes sales, so units are always ESTIMATED. Gamalytic gives one
  modelled point. Boxleiter gives a second, independent estimate from review count
  (reviews * a multiplier). They disagree -- and CLAUDE.md's rule is that the SPREAD
  between them is the information. So we keep the mid (Gamalytic, per the dev's call)
  and bracket it with the Boxleiter range, widening the band whenever Gamalytic falls
  outside it. The gamalytic/boxleiter ratio is emitted so the disagreement is sortable.

  Revenue has only ONE estimator here (Gamalytic), so it gets a mid and no band.
  It is GROSS: Valve takes 30%, regional pricing + discounts eat more -- real
  take-home is well under half. Never compare it to a net figure for our own game.

Tune these if you calibrate against a dev-announced number (see the calibration loop).
"""
import csv
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"

BOX_LOW, BOX_MID, BOX_HIGH = 20, 30, 40      # Boxleiter multipliers (reviews * m)
SRC_EST = "S050"                              # sources.csv row describing the Gamalytic export

# tolerate a raw Gamalytic re-paste (spaced headers) as well as the normalized file
ALIASES = {"steam Id": "game_id", "copies sold": "copies_sold", "revenue": "revenue_gross"}

def load(name):
    with open(DATA / name, encoding="utf-8-sig", newline="") as f:
        rows = list(csv.DictReader(f))
    for r in rows:
        for old, new in ALIASES.items():
            if old in r and new not in r:
                r[new] = r[old]
    return rows

def as_int(v):
    v = (v or "").strip().replace(",", "")
    try:
        return int(float(v))
    except ValueError:
        return None

def main():
    reviews = {r["game_id"]: as_int(r.get("review_count_total")) for r in load("games_steam.csv")}
    out = []
    for r in load("gamalytic_stats.csv"):
        gid = r["game_id"].strip()
        gama = as_int(r.get("copies_sold"))
        rev_g = as_int(r.get("revenue_gross"))
        n_rev = reviews.get(gid)
        if gama is None:
            continue
        box_low  = n_rev * BOX_LOW  if n_rev else None
        box_mid  = n_rev * BOX_MID  if n_rev else None
        box_high = n_rev * BOX_HIGH if n_rev else None

        lows  = [x for x in (gama, box_low) if x is not None]
        highs = [x for x in (gama, box_high) if x is not None]
        out.append({
            "game_id": gid,
            "title": r.get("title", ""),
            "review_count": n_rev if n_rev is not None else "",
            "est_units_boxleiter_low": box_low if box_low is not None else "",
            "est_units_boxleiter_mid": box_mid if box_mid is not None else "",
            "est_units_boxleiter_high": box_high if box_high is not None else "",
            "est_units_gamalytic": gama,
            "est_units_low": min(lows),
            "est_units_mid": gama,                      # Gamalytic point = mid (dev's call)
            "est_units_high": max(highs),
            "units_gamalytic_vs_boxleiter": (round(gama / box_mid, 2) if box_mid else ""),
            "est_revenue_gross_mid": rev_g if rev_g is not None else "",
            "confidence_class": "EST",
            "src_est": SRC_EST,
            "method": f"mid=Gamalytic; low/high bracket Boxleiter reviews x{BOX_LOW}/{BOX_HIGH}; revenue=Gamalytic GROSS",
        })

    path = DATA / "estimates.csv"
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(out[0].keys()))
        w.writeheader(); w.writerows(out)
    print(f"wrote {path}  ({len(out)} rows)")

if __name__ == "__main__":
    main()
