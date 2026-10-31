"""
main.py  —  Step 4 of the Gridbricks backend

Job of this file: be the web server. The React app calls these URLs and
gets JSON back. All the real work is done by steps 1-3; this file just
wires them together.

We use FastAPI, a Python web framework. If you know Express:

    Express:   app.get("/api/days", (req, res) => res.json(data))
    FastAPI:   @app.get("/api/days")
               def days(): return data

Run it locally (from the backend folder):
    .venv/bin/uvicorn app.main:app --reload
Then open http://localhost:8000/docs  -> FastAPI makes an interactive API page for free.
"""

from datetime import date, timedelta
from functools import lru_cache

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from .elexon_client import fetch_actuals, fetch_forecasts
from .forecast_selection import (
    decision_time_for,
    delivery_day_bounds,
    select_latest_forecasts,
)
from .metrics import (
    build_comparison,
    compute_metrics,
    metrics_by_hour_of_day,
    metrics_by_lead_time,
)

# ---------------------------------------------------------------------------
# Scope from the brief: purchase decisions made in January 2026.
# A decision on day X is for delivery on X+1, so delivery days are 2 Jan - 1 Feb.
# ---------------------------------------------------------------------------
FIRST_DELIVERY_DAY = date(2026, 1, 2)
LAST_DELIVERY_DAY = date(2026, 2, 1)

# Create the app. Like `const app = express()`.
app = FastAPI(title="Gridbricks API", version="1.0.0")

# CORS: lets the React dev server (a different port) call this API from the
# browser. Same idea as the `cors` package in Express.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Data loading + caching
#
# @lru_cache is a "decorator": a line starting with @ that wraps the
# function below it. lru_cache remembers the return value, so the slow
# download happens only on the FIRST call; later calls return instantly.
# (The data is historical, so it never changes.)
# ---------------------------------------------------------------------------
@lru_cache(maxsize=1)
def load_data() -> dict:
    actuals = fetch_actuals(FIRST_DELIVERY_DAY, LAST_DELIVERY_DAY)
    raw_forecasts = fetch_forecasts(
        decision_time_for(FIRST_DELIVERY_DAY) - timedelta(days=3),
        decision_time_for(LAST_DELIVERY_DAY),
    )

    # Step 2 for every delivery day, stored per day: { date: [forecasts] }
    selected_by_day: dict[date, list[dict]] = {}
    for day in _all_delivery_days():
        selected_by_day[day] = select_latest_forecasts(raw_forecasts, day)

    # Step 3 for each day, plus one combined list for the whole month.
    comparison_by_day = {
        day: build_comparison(actuals, forecasts)
        for day, forecasts in selected_by_day.items()  # .items() gives (key, value) pairs
    }
    all_rows = [row for rows in comparison_by_day.values() for row in rows]  # flatten

    return {
        "actuals": actuals,
        "selected_by_day": selected_by_day,
        "comparison_by_day": comparison_by_day,
        "all_rows": all_rows,
    }


def _all_delivery_days() -> list[date]:
    count = (LAST_DELIVERY_DAY - FIRST_DELIVERY_DAY).days + 1
    # range(n) = 0, 1, ..., n-1   (like Array.from({length: n}, (_, i) => i))
    return [FIRST_DELIVERY_DAY + timedelta(days=i) for i in range(count)]


# This runs once when the server starts, so the first visitor doesn't wait.
@app.on_event("startup")
def warm_cache() -> None:
    load_data()


# ---------------------------------------------------------------------------
# Routes
# FastAPI automatically turns the returned dicts/lists into JSON, including
# datetimes (they become "2026-01-02T00:00:00Z"-style strings).
# ---------------------------------------------------------------------------
@app.get("/api/health")
def health() -> dict:
    return {"status": "ok"}


@app.get("/api/days")
def list_days() -> list[dict]:
    """One row per delivery day: when the decision was made + how good the forecast was."""
    data = load_data()
    result = []
    for day in _all_delivery_days():
        m = compute_metrics(data["comparison_by_day"][day])
        result.append(
            {
                "deliveryDay": day,
                "decisionTime": decision_time_for(day),
                "mae": m.get("mae"),     # .get() -> None (null in JSON) if missing
                "bias": m.get("bias"),
                "maePct": m.get("maePct"),
            }
        )
    return result


@app.get("/api/day")
def day_detail(
    # Query(...) says "read this from the URL: /api/day?date=2026-01-12".
    # FastAPI checks it's a valid date and returns a 422 error if not.
    date_: date = Query(alias="date"),
) -> dict:
    """Everything needed to draw one delivery day's chart."""
    if not (FIRST_DELIVERY_DAY <= date_ <= LAST_DELIVERY_DAY):
        # raise = throw. FastAPI turns this into a proper 404 JSON response.
        raise HTTPException(
            status_code=404,
            detail=f"Pick a delivery day between {FIRST_DELIVERY_DAY} and {LAST_DELIVERY_DAY}",
        )

    data = load_data()
    start, end = delivery_day_bounds(date_)
    comparison = data["comparison_by_day"][date_]

    return {
        "deliveryDay": date_,
        "decisionTime": decision_time_for(date_),
        # The forecast the team had at decision time (hourly)
        "forecast": data["selected_by_day"][date_],
        # What actually happened (every 30 minutes)
        "actual": [a for a in data["actuals"] if start <= a["startTime"] < end],
        # Matched hourly pairs with error
        "comparison": comparison,
        "metrics": compute_metrics(comparison),
    }


@app.get("/api/summary")
def summary() -> dict:
    """Accuracy over the whole January 2026 decision window."""
    rows = load_data()["all_rows"]
    return {
        "firstDeliveryDay": FIRST_DELIVERY_DAY,
        "lastDeliveryDay": LAST_DELIVERY_DAY,
        "metrics": compute_metrics(rows),
        "byHourOfDay": metrics_by_hour_of_day(rows),
        "byLeadTime": metrics_by_lead_time(rows),
        # Every error value, so the frontend can draw a histogram.
        "errors": [r["error"] for r in rows],
    }
