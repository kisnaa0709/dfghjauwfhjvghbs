# Gridbricks

**Wind forecast desk for UK day-ahead power buying.**

Gridbricks helps a UK utility's day-ahead trading team answer two questions:

1. **What did the latest wind forecast say when we had to buy?** For any delivery day, it shows the newest national wind forecast that existed at the day-ahead auction deadline, next to what actually happened.
2. **How far can we trust it?** It measures the forecast's error over every January 2026 decision, so the team can buy with a known error margin instead of taking the forecast at face value.

Scope: national-level wind only, Elexon BMRS data only, for purchase decisions made in **January 2026**.

### Live demo

| What | URL |
|---|---|
| Web app | https://dev-gridbricks-frontend.dhql6p.easypanel.host/ |
| API | https://dev-gridbricks.dhql6p.easypanel.host/api/health |
| Interactive API docs | https://dev-gridbricks.dhql6p.easypanel.host/docs |

---

## Quick start (Docker)

```bash
docker compose up --build
```

| What | URL |
|---|---|
| Web app | http://localhost:3000 |
| API | http://localhost:8000 |
| Interactive API docs | http://localhost:8000/docs |

The backend downloads January's data from Elexon when it starts (about 10 seconds). The app shows a loading state until that's done.

---

## The business rule

| Term | Meaning |
|---|---|
| Delivery day **D** | The day the power is used |
| Decision time | **11:00 UK time on D-1**, the GB day-ahead auction deadline |
| Forecast used | For each hour of D, the forecast with the **latest `publishTime` at or before the decision time** |
| Decisions in January 2026 | Decisions made 1–31 Jan, so delivery days are **2 Jan – 1 Feb 2026** |

Anything published after 11:00 on D-1 arrived too late to affect the purchase, so it's ignored. Forecasts made for a time that had already passed are excluded too.

### Data sources

| Dataset | Endpoint | Resolution | Used fields |
|---|---|---|---|
| Actuals, FUELHH (`fuelType = WIND`) | `/datasets/FUELHH/stream` | 30 min | `startTime`, `generation` |
| Forecasts, WINDFOR | `/datasets/WINDFOR/stream` | 60 min | `startTime`, `publishTime`, `generation` |

Forecasts are hourly and actuals are half-hourly, so accuracy is measured at the **on-the-hour points**, where both exist. No forecast values are made up for the :30 slots.

---

## Accuracy metrics

`error = forecast − actual` (MW). A **positive** error means the forecast was **too high**: less wind came than expected, which is the risky direction for a buyer.

| Metric | What it tells the trader |
|---|---|
| MAE | Typical size of a miss, in MW |
| MAE % | MAE as a % of average wind output. Used instead of MAPE, which blows up when wind is near zero. |
| RMSE | Like MAE but punishes large misses more |
| Bias | Average signed error. Shows whether the forecast leans high or low. |
| P50 / P90 absolute error | "In 50% / 90% of hours, the miss was at most X MW", a ready-made safety margin |
| P10 / P90 signed error | Used to draw the **likely range** around each forecast |
| By hour of day / by lead time | Where in the day the forecast is weakest |

### January 2026 results (744 hours)

| | |
|---|---|
| Average actual wind | 11,286 MW |
| MAE | 1,996 MW (17.7%) |
| Bias | **+1,728 MW** (forecast usually too high) |
| 90% of hours missed by at most | 4,184 MW |

**Probable cause of the high bias:** FUELHH counts only metered output. On very windy days some wind farms, mostly in Scotland, are paid to switch off because the grid can't carry the power, so the actuals come in below what the wind could have produced. This is a hypothesis; it isn't proven from this data alone.

**Lead time vs time of day:** with a fixed 11:00 decision, lead time and time of day move together. 12–18 h ahead is always overnight, and 30–36 h ahead is always late afternoon. The app shows error by hour of day as the main view for that reason.

---

## How it's built

```
gridbricks/
├── backend/                     Python 3.13 · FastAPI
│   ├── app/
│   │   ├── elexon_client.py       1. Download FUELHH + WINDFOR from Elexon
│   │   ├── forecast_selection.py  2. Pick the latest forecast at decision time
│   │   ├── metrics.py             3. Line up forecast vs actual, compute errors
│   │   └── main.py                4. REST API + in-memory cache
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/                    React 19 · Vite · Tailwind CSS 4 · Recharts
│   ├── src/
│   │   ├── App.jsx                Tabs, data loading
│   │   ├── api.js                 API calls
│   │   ├── format.js              Number and UK-time formatting
│   │   └── components/            Day view, accuracy view, charts
│   ├── nginx.conf                 Serves the built app
│   └── Dockerfile                 Node build, then nginx
└── docker-compose.yml
```

### Backend design

- **One job per file.** Each step can be run alone (`python app/<file>.py`) and prints a sample of its output, which makes the pipeline easy to inspect and debug.
- **Pure logic is separate from I/O.** `forecast_selection.py` and `metrics.py` never touch the network, so they can be tested with plain lists.
- **Fetch once, serve from memory.** The data is historical and only ~30k rows, so `main.py` downloads and computes everything at startup (`lru_cache`). Every request after that is instant. No database is needed at this scale.
- **Time zones done properly.** All times are UTC internally. The decision time is built in `Europe/London` and converted, so the 11:00 rule stays correct in summer time (BST) if the date range is extended.
- **Standard library for the maths.** The metrics are a few dozen lines of plain Python (`math`, sorting), so there's no numpy/pandas dependency to install.

### API

| Endpoint | Returns |
|---|---|
| `GET /api/health` | `{"status": "ok"}` |
| `GET /api/days` | Each delivery day with its decision time, MAE and bias |
| `GET /api/day?date=YYYY-MM-DD` | The forecast used, half-hourly actuals, matched pairs and metrics for one day |
| `GET /api/summary` | Whole-month metrics, error by hour of day and by lead time, and all errors (for the histogram) |

### Frontend

- **Day view:** pick a delivery day and see the decision time, which forecast was used and how old it was, forecast vs actual with a likely-range band, the hourly error, and a data table.
- **Accuracy view:** headline metrics, a calendar of daily error (click a day to open it), error by hour of day, the error distribution, and the worst misses.
- Follows the system light/dark setting. Every chart has a hover tooltip, and the day view has a table alternative.

---

## Deployment (Easypanel)

Backend and frontend are deployed as two separate services:

| Service | Build | Port | URL |
|---|---|---|---|
| Backend | `backend/Dockerfile` | 8000 | https://dev-gridbricks.dhql6p.easypanel.host |
| Frontend | `frontend/Dockerfile` | 80 | https://dev-gridbricks-frontend.dhql6p.easypanel.host |

The browser calls the backend directly. Its address is set into the frontend when it's built, through the `VITE_API_URL` build argument, which defaults to the backend URL above. To point the frontend at a different backend, set that build argument and rebuild. The backend allows requests from any site (CORS), and it only has read endpoints.

---

## Running without Docker

```bash
# Backend
cd backend
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/uvicorn app.main:app --reload        # http://localhost:8000

# Frontend (second terminal)
cd frontend
npm install
npm run dev                                     # http://localhost:5173 (proxies /api to :8000)
```

---

## Limitations and next steps

- **The likely range is in-sample.** The band uses January's own error percentiles. In production it should come from a rolling window of past errors only.
- **National wind only.** Solar, demand and embedded (distribution-connected) wind are out of scope, as the brief asks.
- **Fixed date range.** Making it live would mean a scheduled refresh and moving the date range into config.
- **Next:** a procurement view (demand minus the P90 wind figure), forecast vs actual broken down by wind level, and unit tests for `forecast_selection` and `metrics`.

---

## Use of AI tools

This project was built with help from **Claude Code (Anthropic's AI coding assistant)**. AI was used to research the Elexon API and the GB day-ahead market rules, to write the backend one file at a time with teaching comments, to build the React frontend, and to draft this README. I reviewed, ran and checked every step against live Elexon data.
