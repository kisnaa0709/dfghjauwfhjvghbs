"""
elexon_client.py  —  Step 1 of the Gridbricks backend

Job of this file: talk to the Elexon BMRS API and return wind data as
plain Python lists. Nothing else. No maths, no web server.

(A string in triple quotes at the top of a file is called a "docstring".
 It's just documentation, like a big /* comment */ in JavaScript.)
"""

from datetime import date, datetime, timedelta 

import requests


BASE_URL = "https://data.elexon.co.uk/bmrs/api/v1/datasets"
TIMEOUT_SECONDS = 60


# ---------------------------------------------------------------------------
# A small helper function.
#
# `def` = define a function (like `function` in JS).
# `path: str` and `params: dict` are *type hints*: they tell the reader
# what type is expected. Python does NOT enforce them at runtime; they
# are like TypeScript types that only exist for humans and editors.
# `-> list[dict]` means "this function returns a list of dictionaries".
#
# A Python `dict` is like a JS object:   {"name": "wind", "mw": 120}
# A Python `list` is like a JS array:    [1, 2, 3]
#
# The leading underscore in `_get` is a convention meaning "private,
# only used inside this file".
# ---------------------------------------------------------------------------
def _get(path: str, params: dict) -> list[dict]:
    url = f"{BASE_URL}/{path}"  # f-string = JS template literal `${BASE_URL}/${path}`

    response = requests.get(url, params=params, timeout=TIMEOUT_SECONDS)
    response.raise_for_status()  # throws an error if status is 4xx/5xx

    return response.json()  # the "stream" endpoints return a JSON array


# ---------------------------------------------------------------------------
# 1) ACTUAL wind generation  (dataset FUELHH, half-hourly)
# ---------------------------------------------------------------------------
def fetch_actuals(start_day: date, end_day: date) -> list[dict]:
    """
    Return actual wind generation for every 30-minute slot between
    start_day and end_day (inclusive, by settlement date).

    Each item looks like:  {"startTime": datetime, "generation": 14202}
    """
    raw_rows = _get(
        "FUELHH/stream",
        {
            # .isoformat() turns date(2026, 1, 2) into the text "2026-01-02"
            "settlementDateFrom": start_day.isoformat(),
            "settlementDateTo": end_day.isoformat(),
            "fuelType": "WIND",
        },
    )

    # Build a new, cleaner list. This `for` loop is like
    # `for (const row of rawRows) { ... }` in JavaScript.
    actuals = []
    for row in raw_rows:
        actuals.append(  # .append() is like .push() in JS
            {
                "startTime": _parse_time(row["startTime"]),
                "generation": row["generation"],
            }
        )

    # Sort by time. `key=` says "sort using this value".
    # `lambda item: item["startTime"]` is an inline function,
    # same as `(item) => item.startTime` in JS.
    actuals.sort(key=lambda item: item["startTime"])
    return actuals


# ---------------------------------------------------------------------------
# 2) FORECAST wind generation  (dataset WINDFOR, hourly)
# ---------------------------------------------------------------------------
def fetch_forecasts(publish_from: datetime, publish_to: datetime) -> list[dict]:
    """
    Return every wind forecast that was *published* between
    publish_from and publish_to.

    Important: one target hour gets forecast many times (e.g. 2 days ahead,
    1 day ahead, 6 hours ahead...). So the same startTime appears many
    times with different publishTime values. Step 2 decides which one
    to use.

    Each item looks like:
      {"publishTime": datetime, "startTime": datetime, "generation": 19498}
    """
    raw_rows = _get(
        "WINDFOR/stream",
        {
            "publishDateTimeFrom": _format_time(publish_from),
            "publishDateTimeTo": _format_time(publish_to),
        },
    )

    # This is a "list comprehension": a one-line loop that builds a list.
    # It is the Python version of JS:  rawRows.map(row => ({ ... }))
    forecasts = [
        {
            "publishTime": _parse_time(row["publishTime"]),
            "startTime": _parse_time(row["startTime"]),
            "generation": row["generation"],
        }
        for row in raw_rows
    ]

    forecasts.sort(key=lambda item: (item["startTime"], item["publishTime"]))
    return forecasts


# ---------------------------------------------------------------------------
# Time helpers
# Elexon sends times as text like "2026-01-02T23:30:00Z" (Z = UTC).
# We convert that text into real datetime objects so we can compare
# and subtract times later.
# ---------------------------------------------------------------------------
def _parse_time(text: str) -> datetime:
    # Python's parser wants "+00:00" instead of "Z", so we swap it.
    return datetime.fromisoformat(text.replace("Z", "+00:00"))


def _format_time(moment: datetime) -> str:
    return moment.strftime("%Y-%m-%dT%H:%M:%SZ")  # back to "2026-01-02T23:30:00Z"


# ---------------------------------------------------------------------------
# This block only runs when you execute this file directly:
#     python app/elexon_client.py
# It does NOT run when another file imports this one.
# (Think of it as a quick "try it out" section.)
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    actuals = fetch_actuals(date(2026, 1, 2), date(2026, 1, 2))
    print(f"Got {len(actuals)} actual rows. First 3:")  # len() = .length
    for item in actuals[:3]:  # [:3] = first 3 items, like .slice(0, 3)
        print("  ", item)

    forecasts = fetch_forecasts(
        datetime(2026, 1, 1, 0, 0), datetime(2026, 1, 1, 12, 0)
    )
    print(f"\nGot {len(forecasts)} forecast rows. First 3:")
    for item in forecasts[:3]:
        print("  ", item)

    # timedelta = a length of time. Here: how far ahead was the first forecast made?
    first = forecasts[0]
    lead: timedelta = first["startTime"] - first["publishTime"]
    print(f"\nTime between publish and target for first row: {lead}")
