#!/usr/bin/env python3
"""
apply_edit.py  --  applies ONE dashboard edit to a HAND CSV, then rebuilds.

The Vite dev server spawns this; it does not exist in the production build.
All the write + guardrail logic lives in _hand_csv.apply_action (shared with
add_game.py). This wrapper reads a JSON action from stdin, applies it, runs the
right build step(s), and prints a single JSON line to stdout (build output is
captured so stdout stays pure JSON).

Every change is a plain CSV diff, so `git diff` remains a second provenance layer.
"""
import json, sys, subprocess
from pathlib import Path

from _hand_csv import apply_action, AFFECTS_ESTIMATES

ROOT = Path(__file__).resolve().parents[1]


def rebuild(with_estimates):
    """Run build_estimates (if needed) then build_data; return (ok, message)."""
    steps = (["build_estimates.py"] if with_estimates else []) + ["build_data.py"]
    for script in steps:
        proc = subprocess.run(
            [sys.executable, str(ROOT / "scripts" / script)],
            capture_output=True, text=True,
        )
        if proc.returncode != 0:
            return False, f"{script} failed:\n" + (proc.stderr or proc.stdout)
    return True, ""


def main():
    try:
        action = json.loads(sys.stdin.read())
    except Exception as e:
        print(json.dumps({"ok": False, "error": f"invalid JSON action: {e}"})); return

    try:
        result = apply_action(action)
    except ValueError as e:
        print(json.dumps({"ok": False, "error": str(e)})); return

    ok, msg = rebuild(action.get("table") in AFFECTS_ESTIMATES)
    result["ok"] = ok
    result["rebuilt"] = ok
    if not ok:
        result["error"] = "row written, but " + msg
    print(json.dumps(result))


if __name__ == "__main__":
    main()
