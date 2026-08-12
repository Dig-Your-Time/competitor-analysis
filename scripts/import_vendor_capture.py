#!/usr/bin/env python3
"""
import_vendor_capture.py  --  turn a browser capture into the vendor CSVs.

    python scripts/import_vendor_capture.py gamesensor <file.json>
    python scripts/import_vendor_capture.py gamalytic  <file.json>

Neither vendor can be fetched by a script -- GameSensor is behind a Cloudflare bot
challenge and Gamalytic's API is paywalled -- so the reading is done in a browser with
scripts/capture/*.js and the JSON it produces is imported here. See scripts/capture/README.md.

This exists so the PARSING AND VALIDATION are in the repo rather than in whatever
throwaway file happened to be open at the time. It writes nothing unless every check
passes, because the failure mode being guarded against is real: a regex that required
"Gross revenue (base game):" silently wrote 0 for the five games whose pages say plain
"Gross revenue:", and nothing complained.

Writes (HAND-owned; registered in _hand_csv.py so later edits go through the guarded writer):
  gamesensor -> data/gamesensor_stats.csv, data/gamesensor_languages.csv
  gamalytic  -> data/gamalytic_detail.csv, data/gamalytic_countries.csv
"""
import csv, json, sys, datetime as dt
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
TODAY = dt.date.today().isoformat()

SRC = {"gamesensor": "S051", "gamalytic": "S055"}

# GameSensor display name -> our review-language code. "Traditional Chinese" is mapped to
# chinese_all ON PURPOSE: GameSensor files BOTH Chinese scripts under that one label
# (Dome Keeper 10%, against Steam's real 9.1% Simplified + 1.2% Traditional), so joining
# it to tchinese would attach the larger script's players to the smaller one.
GS_LANG = {
    "English": "english", "Russian": "russian", "German": "german", "French": "french",
    "Spanish": "spanish", "Brazilian Portuguese": "brazilian", "Korean": "koreana",
    "Polish": "polish", "Turkish": "turkish", "Japanese": "japanese",
    "Italian": "italian", "Czech": "czech", "Danish": "danish", "Dutch": "dutch",
    "Swedish": "swedish", "Thai": "thai", "Ukrainian": "ukrainian",
    "Traditional Chinese": "chinese_all", "Simplified Chinese": "schinese",
    "Others": "other",
}

COUNTRY = {
    "US": "United States", "CN": "China", "DE": "Germany", "RU": "Russia",
    "GB": "United Kingdom", "BR": "Brazil", "FR": "France", "CA": "Canada",
    "JP": "Japan", "KR": "South Korea", "PL": "Poland", "TR": "Turkey",
    "ES": "Spain", "IT": "Italy", "AU": "Australia", "UA": "Ukraine",
    "OTHERS": "All other countries",
}


def to_num(v):
    """'1.7m' / '$6M' / '400K' / '666' -> int. Returns '' for blanks."""
    if v in (None, ""):
        return ""
    s = str(v).replace("$", "").replace(",", "").strip().lower()
    mult = {"k": 1_000, "m": 1_000_000, "b": 1_000_000_000}.get(s[-1:])
    try:
        return int(float(s[:-1]) * mult) if mult else int(float(s))
    except ValueError:
        return ""


def load(path):
    rows = json.loads(Path(path).read_text(encoding="utf-8"))
    if isinstance(rows, dict):
        rows = [rows]
    return rows


def known_games():
    with open(DATA / "games_steam.csv", encoding="utf-8-sig", newline="") as f:
        return {r["game_id"]: r["title"] for r in csv.DictReader(f)}


def write(path, rows, fields):
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fields, lineterminator="\n")
        w.writeheader()
        for r in rows:
            w.writerow({k: r.get(k, "") for k in fields})
    print(f"  wrote {path.name}  ({len(rows)} rows)")


# ---------------------------------------------------------------- gamesensor
def build_gamesensor(capture, titles):
    stats, langs, problems, warnings = [], [], [], []
    for c in capture:
        gid = str(c.get("game_id", "")).strip()
        if gid not in titles:
            problems.append(f"{gid}: not a tracked appid"); continue
        # A missing scalar is usually genuine — GameSensor shows no copies figure for
        # very small games (Cave Digger 2, 34 reviews). Warn, don't block.
        if not c.get("gross") or not c.get("copies"):
            warnings.append(f"{titles[gid]}: no gross or no copies on the site "
                            f"(gross={c.get('gross')!r} copies={c.get('copies')!r})")
        rows = c.get("langs") or []
        if not rows:
            problems.append(f"{titles[gid]}: no language rows — did the table render?")
        for key in ("revenue_pct", "copies_pct"):
            total = sum(r[key] for r in rows if r.get(key) is not None)
            if rows and not (90 <= total <= 110):
                problems.append(f"{titles[gid]}: {key} sums to {total}% (expected ~100)")

        stats.append({
            "game_id": gid, "title": titles[gid],
            "gross_revenue_usd": to_num(c.get("gross")),
            "net_revenue_usd": to_num(c.get("net")),
            "copies_sold": to_num(c.get("copies")),
            "displayed_gross": c.get("gross") or "", "displayed_net": c.get("net") or "",
            "displayed_copies": c.get("copies") or "",
            "captured_date": TODAY, "confidence_class": "EST", "src_est": SRC["gamesensor"],
        })
        for r in rows:
            name = r.get("gs_language", "")
            code = GS_LANG.get(name, "")
            if not code:
                problems.append(f"{titles[gid]}: unmapped GameSensor language {name!r} "
                                f"— add it to GS_LANG")
            langs.append({
                "game_id": gid, "title": titles[gid], "gs_language": name, "language": code,
                "revenue_pct": r.get("revenue_pct") if r.get("revenue_pct") is not None else "",
                "copies_pct": r.get("copies_pct") if r.get("copies_pct") is not None else "",
                "supported": 1 if r.get("supported") else 0,
                "captured_date": TODAY, "confidence_class": "EST", "src_est": SRC["gamesensor"],
            })
    return problems, warnings, [
        (DATA / "gamesensor_stats.csv", stats,
         ["game_id", "title", "gross_revenue_usd", "net_revenue_usd", "copies_sold",
          "displayed_gross", "displayed_net", "displayed_copies",
          "captured_date", "confidence_class", "src_est"]),
        (DATA / "gamesensor_languages.csv", langs,
         ["game_id", "title", "gs_language", "language", "revenue_pct", "copies_pct",
          "supported", "captured_date", "confidence_class", "src_est"]),
    ]


# ----------------------------------------------------------------- gamalytic
def build_gamalytic(capture, titles):
    detail, countries, problems, warnings = [], [], [], []
    for c in capture:
        gid = str(c.get("game_id", "")).strip()
        if gid not in titles:
            problems.append(f"{gid}: not a tracked appid"); continue
        cop, rev = c.get("copies"), c.get("revenue")
        if not cop:
            problems.append(f"{titles[gid]}: no copies band")
        # This is the check that would have caught the "(base game)" regex bug: every
        # Gamalytic page carries a revenue band, so a missing one means a parse failure,
        # not a gap in their data. Fatal on purpose.
        if not rev:
            problems.append(f"{titles[gid]}: no revenue band — the page may say plain "
                            f"'Gross revenue:' rather than 'Gross revenue (base game):'")
        for name, band in (("copies", cop), ("revenue", rev)):
            if band:
                mid, lo, hi = (to_num(x) for x in band)
                if not (lo <= mid <= hi):
                    problems.append(f"{titles[gid]}: {name} band out of order {lo}/{mid}/{hi}")

        cs = c.get("countries") or []
        total = sum(x.get("pct", 0) for x in cs)
        if cs and not (95 <= total <= 105):
            problems.append(f"{titles[gid]}: country % sums to {total} (expected ~100)")

        detail.append({
            "game_id": gid, "title": titles[gid],
            "copies_mid": to_num(cop[0]) if cop else "", "copies_low": to_num(cop[1]) if cop else "",
            "copies_high": to_num(cop[2]) if cop else "",
            "revenue_gross_mid": to_num(rev[0]) if rev else "",
            "revenue_gross_low": to_num(rev[1]) if rev else "",
            "revenue_gross_high": to_num(rev[2]) if rev else "",
            "displayed_copies": (c.get("shown") or {}).get("copies", ""),
            "displayed_revenue": (c.get("shown") or {}).get("revenue", ""),
            "captured_date": TODAY, "confidence_class": "EST", "src_est": SRC["gamalytic"],
        })
        for rank, x in enumerate(cs, 1):
            cc = x.get("cc", "")
            countries.append({
                "game_id": gid, "title": titles[gid],
                "rank": rank if cc != "OTHERS" else "", "country_code": cc,
                "country_name": COUNTRY.get(cc, cc), "players_pct": x.get("pct", ""),
                "captured_date": TODAY, "confidence_class": "EST", "src_est": SRC["gamalytic"],
            })
    return problems, warnings, [
        (DATA / "gamalytic_detail.csv", detail,
         ["game_id", "title", "copies_mid", "copies_low", "copies_high",
          "revenue_gross_mid", "revenue_gross_low", "revenue_gross_high",
          "displayed_copies", "displayed_revenue",
          "captured_date", "confidence_class", "src_est"]),
        (DATA / "gamalytic_countries.csv", countries,
         ["game_id", "title", "rank", "country_code", "country_name", "players_pct",
          "captured_date", "confidence_class", "src_est"]),
    ]


def main():
    if len(sys.argv) != 3 or sys.argv[1] not in ("gamesensor", "gamalytic"):
        sys.exit(__doc__)
    vendor, path = sys.argv[1], sys.argv[2]

    titles = known_games()
    capture = load(path)
    builder = build_gamesensor if vendor == "gamesensor" else build_gamalytic
    problems, warnings, outputs = builder(capture, titles)

    missing = [t for g, t in titles.items()
               if g not in {str(c.get("game_id", "")).strip() for c in capture}]
    if missing:
        problems.append(f"{len(missing)} tracked games absent from the capture: "
                        + ", ".join(missing[:6]) + ("..." if len(missing) > 6 else ""))

    print(f"{vendor}: {len(capture)} games in capture")
    if problems:
        print("\nREFUSING TO WRITE — these mean the capture is broken, not sparse:")
        for p in problems:
            print("  -", p)
        sys.exit(1)

    for path_, rows, fields in outputs:
        write(path_, rows, fields)
    if warnings:
        # Written, but say plainly what the vendor simply doesn't publish.
        print(f"\n{len(warnings)} gap(s) in the vendor's own data (written as blank):")
        for w in warnings:
            print("  -", w)
    print("\nNow run:  python scripts/build_data.py")


if __name__ == "__main__":
    main()
