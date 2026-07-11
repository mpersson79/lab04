# Garmin Health Dashboard

A small FastAPI + vanilla JS app that pulls your daily health stats from Garmin
Connect (steps, heart rate, sleep, stress, body battery, recent activities)
and displays them on a dashboard.

Garmin has no public API for personal accounts, so this uses the unofficial
[`garminconnect`](https://github.com/cyberjunky/python-garminconnect) library,
which logs in with your Garmin email/password the same way the Connect
website/app does. That means it can break if Garmin changes their internal
API — there is no supported alternative for personal use short of Garmin's
Health API partner program (business approval + OAuth, not covered here).

If no credentials are configured, the app serves realistic **sample data**
instead so you can run and demo it immediately.

## Setup

```bash
cd garmin-health-app/backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

cp ../.env.example .env
# edit .env with your real Garmin Connect email/password to see live data,
# or leave it as-is to run on sample data
```

## Run

```bash
cd garmin-health-app/backend
source venv/bin/activate
uvicorn app:app --reload --port 8000
```

Open http://localhost:8000 in a browser.

The status pill in the header shows whether you're looking at **live Garmin
data** or **sample data** (e.g. because no credentials were set, or Garmin
rejected the login — 2FA-enabled accounts aren't supported by this flow).

## How it works

- `backend/garmin_client.py` wraps the `garminconnect` library. On startup it
  tries to log in using `GARMIN_EMAIL` / `GARMIN_PASSWORD` from the
  environment; session tokens are cached to `~/.garmin_health_app_tokens` so
  you're not re-logging in on every restart. Any failure (missing
  credentials, bad login, a broken upstream endpoint) falls back to
  deterministic mock data per endpoint, so the UI never breaks.
- `backend/app.py` exposes `/api/health/*` JSON endpoints and serves the
  static frontend.
- `frontend/` is a single dashboard page (no build step) using Chart.js for
  the heart rate, body battery, and sleep charts.

## Notes

- Accounts with two-factor authentication enabled are not supported by the
  unofficial login flow.
- Credentials are only read from your local `.env` (gitignored) — never
  commit real credentials.
