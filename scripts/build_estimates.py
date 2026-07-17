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

Manual override (the honest low/high):
  The Gamalytic *export* is only a single point -- it does not carry the low/high the
  Gamalytic site actually shows, so our default band is the modelled Boxleiter bracket,
  not Gamalytic's own range. When the dev reads the real low/mid/high off Gamalytic and
  types them into units_low / units_mid / units_high in gamalytic_stats.csv, those win
  and the row is marked est_units_source = "manual". Blank override -> model as before.

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

        # hand-typed low/mid/high read off the Gamalytic site (blank -> fall back to model)
        man_low = as_int(r.get("units_low"))
        man_mid = as_int(r.get("units_mid"))
        man_high = as_int(r.get("units_high"))
        manual = any(v is not None for v in (man_low, man_mid, man_high))

        mid = man_mid if man_mid is not None else gama
        if mid is None:                                 # nothing to anchor on -> skip
            continue

        box_low  = n_rev * BOX_LOW  if n_rev else None
        box_mid  = n_rev * BOX_MID  if n_rev else None
        box_high = n_rev * BOX_HIGH if n_rev else None

        lows  = [x for x in (gama, box_low) if x is not None] or [mid]
        highs = [x for x in (gama, box_high) if x is not None] or [mid]
        est_low  = man_low  if man_low  is not None else min(lows)
        est_high = man_high if man_high is not None else max(highs)
        est_low, est_high = min(est_low, mid), max(est_high, mid)   # keep low <= mid <= high

        out.append({
            "game_id": gid,
            "title": r.get("title", ""),
            "review_count": n_rev if n_rev is not None else "",
            "est_units_boxleiter_low": box_low if box_low is not None else "",
            "est_units_boxleiter_mid": box_mid if box_mid is not None else "",
            "est_units_boxleiter_high": box_high if box_high is not None else "",
            "est_units_gamalytic": gama if gama is not None else "",
            "est_units_low": est_low,
            "est_units_mid": mid,
            "est_units_high": est_high,
            "est_units_source": "manual" if manual else "model",
            "units_gamalytic_vs_boxleiter": (round(gama / box_mid, 2) if (gama and box_mid) else ""),
            "est_revenue_gross_mid": rev_g if rev_g is not None else "",
            "confidence_class": "EST",
            "src_est": SRC_EST,
            "method": ("units low/mid/high entered by hand from Gamalytic" if manual
                       else f"mid=Gamalytic; low/high bracket Boxleiter reviews x{BOX_LOW}/{BOX_HIGH}") + "; revenue=Gamalytic GROSS",
        })

    path = DATA / "estimates.csv"
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(out[0].keys()), lineterminator="\n")
        w.writeheader(); w.writerows(out)
    print(f"wrote {path}  ({len(out)} rows)")

if __name__ == "__main__":
    main()
