"""
metrics.py  —  Step 3 of the Gridbricks backend

Job of this file: put forecast and actual side by side, then measure
how wrong the forecast was.

Sign convention (used everywhere in Gridbricks):
    error = forecast - actual
    error > 0  -> forecast was TOO HIGH  (less wind came than expected,
                  so the team would have UNDER-bought power: risky)
    error < 0  -> forecast was TOO LOW   (more wind came than expected,
                  so the team would have OVER-bought power: costly)

This file does NOT download anything. It only does maths on lists,
which makes it easy to test.
"""

import math  # built in: sqrt etc.
from datetime import datetime


# ---------------------------------------------------------------------------
# 1) Line up forecast and actual for the same target time
# ---------------------------------------------------------------------------
def build_comparison(actuals: list[dict], forecasts: list[dict]) -> list[dict]:
    """
    Match each hourly forecast with the actual for the same startTime.

    Actuals are every 30 min, forecasts every 60 min, so only the
    on-the-hour actuals get a partner. Hours with no actual yet are skipped.
    """
    # Dict comprehension: build a lookup {startTime: generation} in one line.
    # JS equivalent: Object.fromEntries(actuals.map(a => [a.startTime, a.generation]))
    actual_by_time: dict[datetime, int] = {
        a["startTime"]: a["generation"] for a in actuals
    }

    rows = []
    for f in forecasts:
        actual = actual_by_time.get(f["startTime"])
        if actual is None:
            continue
        rows.append(
            {
                "startTime": f["startTime"],
                "publishTime": f["publishTime"],
                "leadHours": f["leadHours"],
                "forecast": f["generation"],
                "actual": actual,
                "error": f["generation"] - actual,
            }
        )
    return rows


# ---------------------------------------------------------------------------
# 2) Summary numbers
# ---------------------------------------------------------------------------
def compute_metrics(rows: list[dict]) -> dict:
    """
    Turn a list of comparison rows into headline accuracy numbers (all MW
    unless the name says "pct").
    """
    if not rows:  # an empty list counts as False in Python, like [].length === 0
        return {"count": 0}

    errors = [r["error"] for r in rows]
    abs_errors = [abs(e) for e in errors]  # abs() = Math.abs()
    actuals = [r["actual"] for r in rows]

    n = len(errors)
    mean_actual = sum(actuals) / n  # sum() adds up a list. `/` always gives a decimal

    mae = sum(abs_errors) / n                    # Mean Absolute Error
    rmse = math.sqrt(sum(e * e for e in errors) / n)  # punishes big misses more
    bias = sum(errors) / n                       # + means usually too high

    # Find the single worst miss in each direction.
    # max(list, key=...) returns the item with the biggest key value.
    worst_over = max(rows, key=lambda r: r["error"])   # forecast far too high
    worst_under = min(rows, key=lambda r: r["error"])  # forecast far too low

    return {
        "count": n,
        "meanActual": round(mean_actual),
        "mae": round(mae),
        "rmse": round(rmse),
        "bias": round(bias),
        # MAE as a % of average wind output. We avoid the usual "MAPE"
        # because it explodes when wind output is near zero.
        "maePct": round(100 * mae / mean_actual, 1),
        # "In 50% / 90% of hours, the miss was no bigger than X MW."
        # This is the number the buying team can use as a safety margin.
        "p50AbsError": round(_percentile(abs_errors, 50)),
        "p90AbsError": round(_percentile(abs_errors, 90)),
        # Signed percentiles: how far too high/low it went, 10% of the time.
        "p10Error": round(_percentile(errors, 10)),
        "p90Error": round(_percentile(errors, 90)),
        "worstOver": _row_summary(worst_over),
        "worstUnder": _row_summary(worst_under),
    }


def _percentile(values: list[float], pct: float) -> float:
    """
    Linear-interpolated percentile, the same method Excel's PERCENTILE.INC uses.
    Example: _percentile([10, 20, 30, 40], 50) -> 25.0
    """
    ordered = sorted(values)
    position = (len(ordered) - 1) * pct / 100   # e.g. 1.5 = halfway between items 1 and 2
    low = math.floor(position)                  # floor = round down
    high = math.ceil(position)                  # ceil  = round up
    if low == high:
        return ordered[low]
    weight = position - low
    return ordered[low] * (1 - weight) + ordered[high] * weight


def _row_summary(row: dict) -> dict:
    return {
        "startTime": row["startTime"],
        "forecast": row["forecast"],
        "actual": row["actual"],
        "error": row["error"],
    }


# ---------------------------------------------------------------------------
# 3) Accuracy by how far ahead the forecast was made
# ---------------------------------------------------------------------------
def metrics_by_lead_time(rows: list[dict], bucket_hours: int = 6) -> list[dict]:
    """
    Group rows into buckets by leadHours (e.g. 12-18h, 18-24h, ...) and
    compute MAE for each group. Shows whether further-ahead forecasts are worse.

    `bucket_hours: int = 6` is a default argument value, like JS
    `function f(bucketHours = 6)`.
    """
    groups: dict[int, list[dict]] = {}
    for r in rows:
        # `//` is integer division: 17.5 // 6 -> 2.0 (rounds down). int() drops the .0
        bucket_start = int(r["leadHours"] // bucket_hours) * bucket_hours
        # setdefault: "get the list for this key, creating an empty one if missing"
        groups.setdefault(bucket_start, []).append(r)

    result = []
    for start in sorted(groups):  # looping over a dict gives its keys
        m = compute_metrics(groups[start])
        result.append(
            {
                "leadFrom": start,
                "leadTo": start + bucket_hours,
                "count": m["count"],
                "mae": m["mae"],
                "bias": m["bias"],
            }
        )
    return result


# ---------------------------------------------------------------------------
# 4) Accuracy by hour of the day (UK time)
# ---------------------------------------------------------------------------
def metrics_by_hour_of_day(rows: list[dict]) -> list[dict]:
    """
    MAE and bias for 00:00, 01:00, ... 23:00 across all days.
    Since every decision is made at 11:00 the day before, each hour of the
    day always has roughly the same lead time, so this view is the fairer one.
    """
    from zoneinfo import ZoneInfo  # imports can also live inside a function

    uk = ZoneInfo("Europe/London")
    groups: dict[int, list[dict]] = {}
    for r in rows:
        hour = r["startTime"].astimezone(uk).hour
        groups.setdefault(hour, []).append(r)

    result = []
    for hour in sorted(groups):
        m = compute_metrics(groups[hour])
        result.append(
            {"hour": hour, "count": m["count"], "mae": m["mae"], "bias": m["bias"]}
        )
    return result


# ---------------------------------------------------------------------------
# Try it on the whole of January 2026:  python app/metrics.py
# (takes a few seconds: it downloads one month of data)
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    from datetime import date, timedelta

    try:
        from .elexon_client import fetch_actuals, fetch_forecasts
        from .forecast_selection import decision_time_for, select_latest_forecasts
    except ImportError:
        from elexon_client import fetch_actuals, fetch_forecasts
        from forecast_selection import decision_time_for, select_latest_forecasts

    # Decisions made 1-31 Jan  ->  delivery days 2 Jan .. 1 Feb
    first_day = date(2026, 1, 2)
    last_day = date(2026, 2, 1)

    print("Downloading actuals...")
    actuals = fetch_actuals(first_day, last_day)

    print("Downloading forecasts...")
    # One big download covering every forecast that any of those decisions could use.
    all_forecasts = fetch_forecasts(
        decision_time_for(first_day) - timedelta(days=3),
        decision_time_for(last_day),
    )

    # Run step 2 for each delivery day and collect the results.
    selected = []
    day = first_day
    while day <= last_day:  # a while loop, same idea as in JS
        selected.extend(select_latest_forecasts(all_forecasts, day))  # extend = push(...items)
        day += timedelta(days=1)

    rows = build_comparison(actuals, selected)
    m = compute_metrics(rows)

    print(f"\nCompared {m['count']} hours (delivery 2 Jan - 1 Feb 2026)")
    print(f"  Average actual wind:       {m['meanActual']:>6} MW")  # :>6 = right-align in 6 chars
    print(f"  Mean absolute error (MAE): {m['mae']:>6} MW  ({m['maePct']}% of average)")
    print(f"  RMSE:                      {m['rmse']:>6} MW")
    print(f"  Bias (forecast - actual):  {m['bias']:>6} MW")
    print(f"  50% of hours missed by <=  {m['p50AbsError']:>6} MW")
    print(f"  90% of hours missed by <=  {m['p90AbsError']:>6} MW")
    wo, wu = m["worstOver"], m["worstUnder"]
    print(f"  Worst too-high: {wo['startTime']:%d %b %H:%M}  forecast {wo['forecast']} vs actual {wo['actual']}")
    print(f"  Worst too-low:  {wu['startTime']:%d %b %H:%M}  forecast {wu['forecast']} vs actual {wu['actual']}")

    print("\nMAE by how far ahead the forecast was made:")
    for b in metrics_by_lead_time(rows):
        print(f"  {b['leadFrom']:>2}-{b['leadTo']:<2}h ahead: MAE {b['mae']:>5} MW  ({b['count']} hours)")
