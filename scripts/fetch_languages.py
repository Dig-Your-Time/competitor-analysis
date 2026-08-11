#!/usr/bin/env python3
"""
fetch_languages.py  --  which language communities actually play these games.

Writes (SCRIPT-owned, never hand-edit):
  data/languages.csv               one row per game PER LANGUAGE
  data/steam_language_baseline.csv one row per language: Steam's platform-wide share

Why this exists, i.e. the decisions it changes:
  1. Which languages to localise into, and in what order -- read off the Tier 1
     comps rather than a generic Steam average.
  2. Whether localising PAYS. games_steam.csv already records which languages each
     game ships (supported_languages), so the set splits into games that shipped a
     language and games that did not, and the gap in that language's review share
     between the two groups is the measured lift from localising.
  3. Where a bad translation costs you. Sentiment comes back per language for free,
     and a language whose positive rate runs consistently low across the comp set is
     one where machine translation will show up in your review score.

What this is NOT, and the dashboard must say so:
  * It is REVIEWS, not players. Review propensity differs by language community,
    so the mix over-weights some and under-weights others, and there is no ground
    truth to calibrate against. HARD about reviews, EST about people.
  * It is not country. Spanish spans Spain and Latin America; English spans nearly
    everywhere. Steam exposes no country data for games you do not own -- there is
    no field for it anywhere in the reviews API.
  * The platform baseline measures a user's STEAM CLIENT language while reviews
    measure the language someone chose to write in. Comparing one game to another
    is sound because the bias is common to both. Reading an absolute "share of
    players" off the index is not.

Method: appreviews with num_per_page=0 and language=<code> returns that language's
count in query_summary -- one small response per game-language, no review bodies.
Nothing is cached: these are lifetime totals that move daily, and this repo has
already been bitten once by serving a month-old cached number as today's fact.
Per game the per-language counts must sum to the all-languages total, and the run
fails loudly if they do not.
"""

import csv, re, sys, time, datetime as dt
from pathlib import Path

try:
    import httpx
except ImportError:
    sys.exit("pip install httpx")

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
PAUSE = 0.3
DRIFT_MARGIN = 5     # reviews may be deleted mid-loop, so the bracket needs slack
TODAY = dt.date.today().isoformat()

# Steam's review language codes. The odd ones are historical: Korean is "koreana",
# Brazilian Portuguese is "brazilian", and Latin American Spanish is "latam".
LANGS = [
    "arabic", "bulgarian", "schinese", "tchinese", "czech", "danish", "dutch",
    "english", "finnish", "french", "german", "greek", "hungarian", "indonesian",
    "italian", "japanese", "koreana", "malay", "norwegian", "polish", "portuguese",
    "brazilian", "romanian", "russian", "spanish", "latam", "swedish", "thai",
    "turkish", "ukrainian", "vietnamese",
]

# Hardware-survey display name -> Steam review language code
SURVEY_TO_CODE = {
    "English": "english", "Simplified Chinese": "schinese",
    "Traditional Chinese": "tchinese", "Russian": "russian",
    "Spanish - Spain": "spanish", "Spanish - Latin America": "latam",
    "Portuguese-Brazil": "brazilian", "Portuguese - Portugal": "portuguese",
    "German": "german", "French": "french", "Japanese": "japanese",
    "Korean": "koreana", "Polish": "polish", "Turkish": "turkish", "Thai": "thai",
    "Ukrainian": "ukrainian", "Italian": "italian", "Czech": "czech",
    "Hungarian": "hungarian", "Swedish": "swedish", "Dutch": "dutch",
    "Vietnamese": "vietnamese", "Danish": "danish", "Indonesian": "indonesian",
    "Finnish": "finnish", "Romanian": "romanian", "Norwegian": "norwegian",
    "Greek": "greek", "Bulgarian": "bulgarian", "Malay": "malay", "Arabic": "arabic",
}

client = httpx.Client(
    timeout=30,
    headers={"User-Agent": "indie-market-research/1.0 (contact: you@example.com)"},
    follow_redirects=True,
)


def summary(appid, lang):
    """(total, positive, negative) for one game in one language."""
    url = (f"https://store.steampowered.com/appreviews/{appid}"
           f"?json=1&purchase_type=all&num_per_page=0"
           f"&filter_offtopic_activity=0&language={lang}")
    for attempt in range(4):
        time.sleep(PAUSE * (1 + attempt * 3))
        try:
            r = client.get(url)
            if r.status_code == 200:
                q = r.json().get("query_summary", {})
                return (int(q.get("total_reviews", 0) or 0),
                        int(q.get("total_positive", 0) or 0),
                        int(q.get("total_negative", 0) or 0))
        except Exception:
            pass
    raise RuntimeError(f"{appid}/{lang} failed after 4 tries")


def fetch_baseline():
    """Steam's own platform-wide language split, from the Hardware & Software Survey.

    Free, official, refreshed monthly, and the denominator that makes a per-game
    share interpretable: 9% Simplified Chinese looks healthy until you see that
    Chinese is 22% of Steam."""
    t = client.get("https://store.steampowered.com/hwsurvey/?platform=combined").text
    i = t.find('id="cat7_stats_row"')          # cat7 is the Language category
    if i < 0:
        print("  !! could not find the Language section -- skipping baseline")
        return []
    j = t.find("stats_row row_", i + 10)
    seg = t[i:j if j > 0 else i + 9000]
    rows = []
    head = re.search(r'cat7_val_1_on">([^<]+)</span>.*?cat7_val_2_on">([\d.]+)%', seg, re.S)
    if head:
        rows.append((head.group(1).strip(), float(head.group(2))))
    rows += [(n.strip(), float(v)) for n, v in re.findall(
        r'stats_col_mid data_row"><nobr>([^<]+)</nobr></div>\s*'
        r'<div class="stats_col_right data_row">([\d.]+)%', seg)]

    out, unknown = [], []
    for name, pct in rows:
        code = SURVEY_TO_CODE.get(name)
        if not code:
            unknown.append(name); continue
        out.append({"language": code, "survey_name": name,
                    "steam_share_pct": pct, "retrieved_date": TODAY})
    if unknown:
        print(f"  !! survey names with no code mapping (add them): {unknown}")
    print(f"  baseline: {len(out)} languages, sums to {sum(r['steam_share_pct'] for r in out):.2f}%")
    return out


def write_csv(path, rows, fields):
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fields, lineterminator="\n")
        w.writeheader()
        for r in rows:
            w.writerow({k: r.get(k, "") for k in fields})
    print(f"wrote {path}  ({len(rows)} rows)")


def main():
    with open(DATA / "games_steam.csv", encoding="utf-8-sig", newline="") as f:
        games = [(r["game_id"], r["title"]) for r in csv.DictReader(f)]

    print("Steam platform language baseline")
    baseline = fetch_baseline()

    out, problems = [], []
    for n, (appid, title) in enumerate(games, 1):
        # Integrity: the parts must equal the whole, which catches a language Steam
        # has added that is missing from LANGS -- silently dropping a community would
        # understate exactly the market we are sizing.
        #
        # But the whole is a MOVING target: 32 requests take ~20s and reviews are
        # posted and deleted the entire time, so demanding exact equality fails on
        # any busy game (and can fail NEGATIVE, which no missing language explains).
        # So read the all-languages total before AND after the loop and require the
        # sum to land inside that bracket. Drift is bounded by the two readings, and
        # a genuinely missing language is off by hundreds, not by three.
        before, _, _ = summary(appid, "all")
        got = {lang: summary(appid, lang) for lang in LANGS}
        after, _, _ = summary(appid, "all")

        s = sum(v[0] for v in got.values())
        lo, hi = min(before, after) - DRIFT_MARGIN, max(before, after) + DRIFT_MARGIN
        total_all = after
        if not (lo <= s <= hi):
            problems.append(f"{title}: languages sum to {s:,}, outside the "
                            f"{min(before, after):,}..{max(before, after):,} bracket "
                            f"(off by {s - max(before, after):+,})")

        for lang, (tot, pos, neg) in got.items():
            out.append({"game_id": appid, "title": title, "language": lang,
                        "reviews": tot, "reviews_positive": pos,
                        "reviews_negative": neg, "retrieved_date": TODAY})
        top = max(got.items(), key=lambda kv: kv[1][0])
        print(f"[{n:>2}/{len(games)}] {title[:26]:28} {s:>9,} reviews  "
              f"top={top[0]} {top[1][0]/s*100 if s else 0:.0f}%  "
              f"drift {after - before:+d}  {'OK' if lo <= s <= hi else 'MISMATCH'}")

    write_csv(DATA / "languages.csv", out,
              ["game_id", "title", "language", "reviews", "reviews_positive",
               "reviews_negative", "retrieved_date"])
    if baseline:
        write_csv(DATA / "steam_language_baseline.csv", baseline,
                  ["language", "survey_name", "steam_share_pct", "retrieved_date"])

    print()
    if problems:
        print("RECONCILIATION FAILURES -- do not trust this file until fixed:")
        for p in problems:
            print("  -", p)
        sys.exit(1)
    print(f"All {len(games)} games reconcile: per-language counts land inside the "
          f"all-languages reading taken before and after each game's fetch.")


if __name__ == "__main__":
    main()
