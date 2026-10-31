"""
forecast_selection.py  —  Step 2 of the Gridbricks backend

Job of this file: answer the question
    "At the moment the team had to buy power, which forecast was the
     newest one they could see?"

Background (the business rule):
  - The GB day-ahead auction closes at 11:00 UK time on the day BEFORE
    delivery. Call the delivery day D. The decision is made on D-1 at 11:00.
  - Elexon publishes new wind forecasts several times a day. Each forecast
    covers many future hours.
  - So for every hour of day D, we want the forecast with the latest
    publishTime that is still at or before 11:00 on D-1.
    Anything published after 11:00 came too late to help the decision.
"""

from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo  # built in: knows about UK summer time etc.

# `from .elexon_client import ...` means "import from the file next to me".
# The dot = "this same folder (package)". Like `import x from "./elexon_client"`.
# We wrap it in try/except so the file also works when run directly
# (python app/forecast_selection.py), where the dot-import isn't allowed.
try:
    from .elexon_client import fetch_forecasts
except ImportError:
    from elexon_client import fetch_forecasts


UK = ZoneInfo("Europe/London")
UTC = ZoneInfo("UTC")

# The auction deadline. Kept as a constant so it's easy to change later.
DECISION_TIME_LOCAL = time(11, 0)  # 11:00


# ---------------------------------------------------------------------------
# When was the decision for delivery day D made?
# ---------------------------------------------------------------------------
def decision_time_for(delivery_day: date) -> datetime:
    """Return 11:00 UK time on the day before delivery, as a UTC datetime."""
    day_before = delivery_day - timedelta(days=1)  # dates support + and -

    # datetime.combine glues a date and a time together.
    # tzinfo=UK says "this is UK local time".
    local = datetime.combine(day_before, DECISION_TIME_LOCAL, tzinfo=UK)

    # Convert to UTC so it can be compared with Elexon's times (all UTC).
    # In January, UK time == UTC, but in summer they differ by 1 hour.
    return local.astimezone(UTC)


def delivery_day_bounds(delivery_day: date) -> tuple[datetime, datetime]:
    """
    Return (start, end) of the delivery day in UTC.
    A `tuple` is a fixed-size, read-only list: (a, b). Like returning [a, b]
    in JS and destructuring it:  start, end = delivery_day_bounds(d)
    """
    start = datetime.combine(delivery_day, time(0, 0), tzinfo=UK).astimezone(UTC)
    end = start + timedelta(days=1)
    return start, end


# ---------------------------------------------------------------------------
# The core logic: pick the latest forecast per target hour
# ---------------------------------------------------------------------------
def select_latest_forecasts(
    forecasts: list[dict], delivery_day: date
) -> list[dict]:
    """
    From a big pile of forecasts, keep only ONE per target hour of
    delivery_day: the newest one published at or before the decision time.

    Returns items like:
      {"startTime": datetime, "generation": 15000,
       "publishTime": datetime, "leadHours": 26.5}
    """
    cutoff = decision_time_for(delivery_day)
    day_start, day_end = delivery_day_bounds(delivery_day)  # tuple unpacking

    # `best` is a dict used as a lookup table:  { startTime: forecastRow }
    # Like a JS Map / object keyed by time.
    best: dict[datetime, dict] = {}

    for row in forecasts:
        # Rule 1: must be a target time inside the delivery day.
        # Python allows chained comparisons: a <= x < b  (JS needs a <= x && x < b)
        if not (day_start <= row["startTime"] < day_end):
            continue  # skip to the next row, same as JS `continue`

        # Rule 2: must have been published by the decision deadline.
        if row["publishTime"] > cutoff:
            continue

        # Rule 3: keep it only if it's newer than what we already have.
        # dict.get(key) returns None (Python's null) if the key isn't there.
        current = best.get(row["startTime"])
        if current is None or row["publishTime"] > current["publishTime"]:
            best[row["startTime"]] = row

    # Turn the lookup table back into a sorted list.
    # sorted(...) returns a NEW sorted list (doesn't change the original).
    # best.values() = all the stored rows, like Object.values(best) in JS.
    selected = []
    for row in sorted(best.values(), key=lambda r: r["startTime"]):
        lead = row["startTime"] - row["publishTime"]  # a timedelta
        selected.append(
            {
                "startTime": row["startTime"],
                "generation": row["generation"],
                "publishTime": row["publishTime"],
                # How many hours ahead the forecast was made.
                # total_seconds() turns a timedelta into a plain number.
                "leadHours": round(lead.total_seconds() / 3600, 1),
            }
        )
    return selected


# ---------------------------------------------------------------------------
# Convenience: fetch + select in one go, for one delivery day
# ---------------------------------------------------------------------------
def forecasts_for_delivery_day(delivery_day: date) -> list[dict]:
    cutoff = decision_time_for(delivery_day)
    # Forecasts reach about 2 days ahead, so looking back 3 days from the
    # cutoff is enough to catch every forecast that could cover day D.
    raw = fetch_forecasts(cutoff - timedelta(days=3), cutoff)
    return select_latest_forecasts(raw, delivery_day)


# ---------------------------------------------------------------------------
# Try it:  python app/forecast_selection.py
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    day = date(2026, 1, 2)
    print("Delivery day:  ", day)
    print("Decision time: ", decision_time_for(day))

    picked = forecasts_for_delivery_day(day)
    print(f"\nSelected {len(picked)} hourly forecasts (expect 24):")
    for item in picked:
        # :%H:%M inside an f-string formats a datetime, like "06:00"
        print(
            f"  target {item['startTime']:%d %b %H:%M}"
            f"  published {item['publishTime']:%d %b %H:%M}"
            f"  ({item['leadHours']}h ahead)"
            f"  -> {item['generation']} MW"
        )
