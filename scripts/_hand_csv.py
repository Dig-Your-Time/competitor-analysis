#!/usr/bin/env python3
"""
_hand_csv.py  --  the shared, guarded writer for HAND-owned CSVs.

Both apply_edit.py (single dashboard edit) and add_game.py (new competitor)
route every write through here, so the one-owner-per-file rule lives in exactly
one place. It writes ONLY the HAND files and refuses, by name, to touch the
SCRIPT-owned ones (games_steam / timeseries / estimates / fetch_log).

apply_action() applies one action and returns a small result dict. It raises
ValueError on any validation problem; callers turn that into a JSON error.
"""
import csv, os, tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"

# table name -> (filename, unique-key columns used for add/upsert duplicate checks)
HAND = {
    "companies":         ("companies.csv",         ["company_id"]),
    "games_manual_seed": ("games_manual_seed.csv", ["game_id"]),
    "financials":        ("financials.csv",        ["company_id", "fiscal_year"]),
    "funding":           ("funding.csv",           []),          # rounds have no natural key
    "sources":           ("sources.csv",           ["source_id"]),
    "gamalytic_stats":   ("gamalytic_stats.csv",   ["game_id"]),
}

# SCRIPT-owned; never writable here (belt-and-suspenders over the HAND allowlist)
FORBIDDEN = {"games_steam.csv", "timeseries.csv", "estimates.csv", "fetch_log.csv"}

# tables whose contents feed estimates.csv -> a change means build_estimates must re-run
AFFECTS_ESTIMATES = {"gamalytic_stats"}


def read_csv(path):
    with open(path, encoding="utf-8-sig", newline="") as f:
        r = csv.DictReader(f)
        return list(r), r.fieldnames


def write_csv(path, fieldnames, rows):
    fd, tmp = tempfile.mkstemp(dir=str(path.parent), suffix=".tmp")
    try:
        # LF line endings (repo convention) so a one-field edit is a one-line diff
        with os.fdopen(fd, "w", encoding="utf-8", newline="") as f:
            w = csv.DictWriter(f, fieldnames=fieldnames, lineterminator="\n")
            w.writeheader()
            for row in rows:
                w.writerow({k: row.get(k, "") for k in fieldnames})
        os.replace(tmp, path)
    except Exception:
        if os.path.exists(tmp):
            os.remove(tmp)
        raise


def norm(v):
    if v is None:
        return ""
    if isinstance(v, bool):
        return "TRUE" if v else "FALSE"
    return str(v)


def _matches(row, match):
    return all(norm(row.get(k, "")).strip() == norm(v).strip() for k, v in match.items())


def apply_action(action):
    """Apply one edit action. Returns {'op','table'}. Raises ValueError on error."""
    table = action.get("table")
    op = action.get("op")
    values = action.get("values") or {}
    match = action.get("match") or {}

    if table not in HAND:
        raise ValueError(f"table '{table}' is not editable (HAND files only: {', '.join(HAND)})")
    filename, uniq = HAND[table]
    if filename in FORBIDDEN:
        raise ValueError(f"refusing to write script-owned file {filename}")
    if op not in ("add", "update", "delete", "upsert"):
        raise ValueError(f"unknown op '{op}'")

    path = DATA / filename
    if not path.exists():
        raise ValueError(f"{filename} not found")
    rows, fieldnames = read_csv(path)

    unknown = [c for c in list(values) + list(match) if c not in fieldnames]
    if unknown:
        raise ValueError(f"unknown column(s) for {filename}: {', '.join(unknown)}")

    # upsert on a keyed table = update if the key exists, else add
    if op == "upsert":
        if not uniq:
            raise ValueError(f"{table} has no unique key; use add/update explicitly")
        key = {k: norm(values.get(k, "")) for k in uniq}
        if any(v == "" for v in key.values()):
            raise ValueError(f"missing key value(s) {uniq} for {table} upsert")
        op = "update" if any(_matches(r, key) for r in rows) else "add"
        if op == "update":
            match = key

    if op == "add":
        if uniq:
            key = {k: norm(values.get(k, "")) for k in uniq}
            if any(v == "" for v in key.values()):
                raise ValueError(f"missing key value(s) {uniq} for new {table} row")
            if any(_matches(r, key) for r in rows):
                raise ValueError(f"a {table} row with {key} already exists")
        rows.append({k: norm(values.get(k, "")) for k in fieldnames})
        result = {"op": "add", "table": table}
    else:  # update / delete
        if not match:
            raise ValueError(f"{op} needs a 'match' to locate the row")
        hits = [i for i, r in enumerate(rows) if _matches(r, match)]
        if not hits:
            raise ValueError(f"no {table} row matches {match}")
        if len(hits) > 1:
            raise ValueError(f"{len(hits)} {table} rows match {match}; add more fields to 'match' to disambiguate")
        i = hits[0]
        if op == "update":
            for k, v in values.items():
                rows[i][k] = norm(v)
            result = {"op": "update", "table": table}
        else:
            rows.pop(i)
            result = {"op": "delete", "table": table}

    write_csv(path, fieldnames, rows)
    return result
