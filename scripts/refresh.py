#!/usr/bin/env python3
"""
refresh.py  --  one command to bring the dashboard up to date.

    python scripts/refresh.py             # everything automatable, then report
    python scripts/refresh.py --prices    # just re-price (under a minute)
    python scripts/refresh.py --full      # + re-walk review weeks and language mix
    python scripts/refresh.py --vendors   # + import any vendor capture files present

What is automatic and what is not, and why:

  AUTOMATIC (Steam, free, no key)
    prices .......... both regions, force-refreshed
    review curves ... weekly counts; cached per closed week, so a re-run is cheap
    language mix .... per game per language, with a reconciliation check
    build ........... estimates.csv then data.json

  MANUAL STEP (the two vendors)
    GameSensor is behind a Cloudflare bot challenge and Gamalytic's API is paywalled,
    so neither can be fetched by a script. The reading is done in a browser with
    scripts/capture/*.js and imported here. See scripts/capture/README.md.

    This script does NOT try to drive a browser. Selenium or Playwright could automate
    the Gamalytic half using your own logged-in profile, but making GameSensor work
    that way means defeating a bot challenge, and adding a headless-browser dependency
    to a repo that has three runtime packages is a poor trade. What this does instead
    is notice whether a capture is present and how old it is, so the manual step is
    never silently skipped.
"""
import argparse, csv, datetime as dt, subprocess, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
PY = sys.executable

# vendor file -> how many days before it is worth re-capturing
VENDOR_FILES = {
    "gamesensor_stats.csv": ("GameSensor", "gamesensor"),
    "gamalytic_detail.csv": ("Gamalytic", "gamalytic"),
}
STALE_DAYS = 30


def run(script, *args, label=None):
    label = label or script
    print(f"\n=== {label} " + "=" * max(0, 60 - len(label)))
    r = subprocess.run([PY, str(ROOT / "scripts" / script), *args])
    if r.returncode != 0:
        print(f"\n!! {script} failed (exit {r.returncode}) — stopping so nothing "
              f"half-updated reaches the dashboard.")
        sys.exit(r.returncode)


def captured_date(filename):
    """Newest captured_date inside a vendor CSV, or None."""
    p = DATA / filename
    if not p.exists():
        return None
    try:
        with open(p, encoding="utf-8-sig", newline="") as f:
            dates = [r.get("captured_date", "") for r in csv.DictReader(f)]
        dates = sorted(d for d in dates if d)
        return dates[-1] if dates else None
    except Exception:
        return None


def vendor_report():
    """Say plainly how old each vendor capture is. Never silently skip it."""
    print("\n=== vendor data (manual capture) " + "=" * 28)
    today = dt.date.today()
    stale = []
    for filename, (name, vendor) in VENDOR_FILES.items():
        got = captured_date(filename)
        if not got:
            print(f"  {name:11} MISSING — nothing captured yet")
            stale.append((name, vendor))
            continue
        age = (today - dt.date.fromisoformat(got)).days
        flag = "  <-- worth re-capturing" if age >= STALE_DAYS else ""
        print(f"  {name:11} captured {got}  ({age} days ago){flag}")
        if age >= STALE_DAYS:
            stale.append((name, vendor))
    if stale:
        print("\n  To refresh, for each appid in GAMES open the vendor page in a browser,")
        print("  run the matching snippet from scripts/capture/, collect the JSON lines")
        print("  into an array, then:")
        for name, vendor in stale:
            print(f"    python scripts/import_vendor_capture.py {vendor} <capture.json>")
        print("  Details: scripts/capture/README.md")
    return stale


def main():
    ap = argparse.ArgumentParser(description="Refresh the dashboard's data.")
    ap.add_argument("--prices", action="store_true", help="only re-price (fast)")
    ap.add_argument("--full", action="store_true",
                    help="also re-walk review weeks and the language mix (~10 min warm)")
    ap.add_argument("--vendors", action="store_true",
                    help="import vendor captures found in data/raw/*-capture.json")
    args = ap.parse_args()

    print(f"Refreshing competitor data — {dt.date.today().isoformat()}")

    if args.prices:
        run("fetch_steam.py", "--prices", label="Steam prices (both regions)")
    elif args.full:
        run("fetch_steam.py", label="Steam facts, prices and review curves")
        run("fetch_languages.py", label="Language mix + Steam-wide baseline")
    else:
        # Default: prices always move; curves only gain whole new weeks, and the weekly
        # cache makes a full run cheap anyway — but it is still minutes, so keep the
        # default fast and let --full be explicit.
        run("fetch_steam.py", "--prices", label="Steam prices (both regions)")

    if args.vendors:
        for vendor in ("gamesensor", "gamalytic"):
            cap = DATA / "raw" / f"{vendor}-capture.json"
            if cap.exists():
                run("import_vendor_capture.py", vendor, str(cap),
                    label=f"import {vendor} capture")
            else:
                print(f"\n  (no {cap.name} — skipping {vendor} import)")

    run("build_estimates.py", label="Rebuild estimates")
    run("build_data.py", label="Rebuild dashboard data.json")

    stale = vendor_report()

    print("\n" + "=" * 64)
    print("Done. Steam data is current.")
    if stale:
        print(f"{len(stale)} vendor source(s) need the manual capture above.")
    print("Serve it with:  cd dashboard && npm run dev")


if __name__ == "__main__":
    main()
