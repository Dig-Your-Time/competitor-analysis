# Known gaps

Things the dashboard doesn't do yet, with enough detail to pick up cold.

---

## 1. The calibration loop — how wrong are our estimates?

**The problem.** Every unit and revenue figure in the dashboard is a model's guess, and the
models disagree badly. On the 28 tracked games, GameSensor and Gamalytic land within ~20%
of each other on million-review games but diverge **2–4× on small ones**:

| Game | GameSensor | Gamalytic | Ratio |
|---|---|---|---|
| Dome Keeper | 400,000 | 1,700,000 | 4.3× |
| Core Keeper | 1,200,000 | 3,800,000 | 3.2× |
| Moonlighter | 500,000 | 1,500,000 | 3.0× |
| Terraria | 43,900,000 | 35,900,000 | 1.2× |
| Valheim | 19,400,000 | 16,800,000 | 1.2× |

Small games are exactly the bracket this game will ship into, and it's exactly where the
estimators are least reliable. Right now the dashboard shows the disagreement honestly but
can't say **which vendor runs closer for games our size** — and that's the number that
would actually change a plan.

**Why vendor accuracy claims don't help.** They're averaged across the whole catalogue,
including huge titles where estimation is easy. That average tells you nothing about a
20,000-review indie game.

**The only way to check.** Some developers publicly state their real sales — a tweet, an
interview, a postmortem, a GDC talk. That figure is the one place an estimate can be
checked against reality. If a dev said 100k and the estimators said 70k for that game
around that date, the estimators run ~30% low *for games that size*.

### What's needed

**a. Schema.** `games_manual_seed.csv` has no columns for this yet. Add:

| Column | Contents |
|---|---|
| `announced_units` | The number the developer stated, as a plain integer |
| `announced_date` | `YYYY-MM-DD` — when they said it, not when the game shipped |
| `announced_note` | What exactly was claimed ("500k copies", "1M players" — these are **not** the same thing) |
| `src_announced` | A `source_id` pointing at a row in `sources.csv` |

**b. Data.** Hunt for public statements across the 28 games. Realistically only a handful
will have one; that's still enough to be useful. **Archive every source at the moment of
recording** — `sources.csv` has an `archive_url` column, and dev tweets get deleted while
studio blogs 404 when the studio dies. Several studios in this dataset will die.

**c. The script.** `scripts/calibration.py`, reading `games_manual_seed.csv` +
`estimates.csv` + `gamesensor_stats.csv`. For each game with an `announced_units`, report
each estimator's error against it, and aggregate by review-count bracket — the bracket is
the point, since error varies with game size.

**d. Surface it.** The resulting error figure belongs on the dashboard, near the estimate
bands. "Our estimators run ~30% low for games in this size range" is a caveat a reader
can act on; a bare band isn't.

### Traps

- **"Players" ≠ "copies sold."** Free weekends, Game Pass and key giveaways inflate player
  counts well above sales. Record which was claimed in `announced_note` and never mix them.
- **Announcements are self-selecting.** Studios publicise good numbers and stay quiet about
  bad ones, so the sample skews high. Say so wherever the result is shown.
- **Match the date.** Compare a dev's figure against what the estimators said *around that
  date*, not against today's estimate. Today's includes years of later sales.
- **A milestone is a floor.** "Over 1 million sold" means ≥1M, not 1M.

---

## 2. Six Gamalytic fields are still on July data

`copies_sold`, `revenue_gross` and the `units_low/mid/high` band were refreshed on
2026-08-12. These were not: `wishlists_available`, `avg_playtime_hours`, `reviews`,
`review_score`, `followers`, `avg_daily_ccu`.

Nothing in the dashboard reads them, so this isn't urgent. Two of them — `reviews` and
`review_score` — should be dropped rather than refreshed: we have both from Steam directly,
where they're observed rather than modelled and current on every run.

---

## 3. Vendor data goes stale quietly

GameSensor and Gamalytic can't be fetched automatically (see
[the game page reference](./game-pages-and-gamesensor.md#refreshing-the-vendor-data)), so
they only update when someone does the browser capture. `scripts/refresh.py` reports the
age of each capture and flags anything past 30 days.

Observed drift over four weeks: most games moved under 3%, Moonlighter's gross moved 13%.
Monthly is a reasonable cadence; there's no case for automating it.
