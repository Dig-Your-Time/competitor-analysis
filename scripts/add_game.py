#!/usr/bin/env python3
"""
add_game.py  --  add a whole new competitor game from the dashboard.

Adding a game is NOT one row write; it's a small pipeline run, because a game's
HARD facts + launch curve come from Steam and its estimate comes from Gamalytic,
all script-owned. So this:

  1. writes the games_manual_seed row (HAND: your judgement columns)
  2. writes the gamalytic_stats row  (HAND: the pasted estimate numbers)
  3. optionally fetches Steam for that ONE appid  (SCRIPT: fetch_steam --add)
  4. runs build_estimates + build_data so the dashboard can refetch

Reads a JSON payload on stdin; prints one JSON line on stdout. The HAND writes go
through _hand_csv.apply_action, so the same one-owner guardrails apply here too.

Payload:
  { "seed":     { title, game_id, company_id, tier, comparable_class, production_tier, relevance_note },
    "gamalytic":{ title, game_id, copies_sold, revenue_gross, units_low, units_mid, units_high, reviews, review_score },
    "fetch": true }
"""
import json, sys, subprocess
from pathlib import Path

from _hand_csv import apply_action

ROOT = Path(__file__).resolve().parents[1]


def run(script, *args):
    proc = subprocess.run(
        [sys.executable, str(ROOT / "scripts" / script), *args],
        capture_output=True, text=True,
    )
    return proc.returncode == 0, (proc.stdout or "") + (proc.stderr or "")


def main():
    try:
        payload = json.loads(sys.stdin.read())
    except Exception as e:
        print(json.dumps({"ok": False, "error": f"invalid JSON payload: {e}"})); return

    seed = payload.get("seed") or {}
    gamalytic = payload.get("gamalytic") or {}
    do_fetch = bool(payload.get("fetch"))
    appid = str(seed.get("game_id", "")).strip()
    title = seed.get("title", "")

    if not appid:
        print(json.dumps({"ok": False, "error": "game_id (Steam appid) is required"})); return
    if not seed.get("company_id"):
        print(json.dumps({"ok": False, "error": "company_id is required (add the studio first if it's new)"})); return

    warnings = []

    # 1. HAND rows
    try:
        apply_action({"table": "games_manual_seed", "op": "add", "values": seed})
    except ValueError as e:
        print(json.dumps({"ok": False, "error": f"games_manual_seed: {e}"})); return

    if any(str(v).strip() for k, v in gamalytic.items() if k not in ("game_id", "title")):
        gvals = {**gamalytic, "game_id": appid, "title": gamalytic.get("title") or title}
        try:
            apply_action({"table": "gamalytic_stats", "op": "upsert", "values": gvals})
        except ValueError as e:
            warnings.append(f"gamalytic_stats not written: {e}")

    # 2. Steam fetch for this one appid (network, may be slow)
    fetched = False
    if do_fetch:
        ok, out = run("fetch_steam.py", "--add", appid, title)
        fetched = ok
        if not ok:
            warnings.append("Steam fetch failed; game added without HARD Steam facts.\n" + out[-800:])

    # 3. rebuild
    ok, out = run("build_estimates.py")
    if not ok:
        print(json.dumps({"ok": False, "error": "build_estimates failed:\n" + out[-800:], "warnings": warnings})); return
    ok, out = run("build_data.py")
    if not ok:
        print(json.dumps({"ok": False, "error": "build_data failed:\n" + out[-800:], "warnings": warnings})); return

    print(json.dumps({"ok": True, "op": "add-game", "game_id": appid, "fetched": fetched, "warnings": warnings}))


if __name__ == "__main__":
    main()
