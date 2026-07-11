import os
import threading
from datetime import date

import mock_data

TOKEN_STORE = os.path.expanduser("~/.garmin_health_app_tokens")


class GarminHealthClient:
    """Wraps the unofficial `garminconnect` library.

    Falls back to deterministic mock data whenever real credentials aren't
    configured, or whenever a live call to Garmin fails, so the dashboard
    always has something to show.
    """

    def __init__(self):
        self._lock = threading.Lock()
        self._client = None
        self._login_error = None
        self._live = False
        self._try_login()

    def _try_login(self):
        email = os.environ.get("GARMIN_EMAIL")
        password = os.environ.get("GARMIN_PASSWORD")
        if not email or not password:
            self._login_error = "No GARMIN_EMAIL / GARMIN_PASSWORD set in environment."
            return
        try:
            from garminconnect import Garmin

            client = Garmin(email, password)
            client.login(TOKEN_STORE)
            self._client = client
            self._live = True
            self._login_error = None
        except Exception as exc:  # noqa: BLE001 - surface any auth/library failure as mock fallback
            self._login_error = f"{type(exc).__name__}: {exc}"
            self._client = None
            self._live = False

    @property
    def is_live(self) -> bool:
        return self._live

    @property
    def status(self) -> dict:
        return {
            "live": self._live,
            "message": "Connected to Garmin Connect." if self._live else (self._login_error or "Running on mock data."),
        }

    def _safe_call(self, fn, mock_fn, *args):
        if not self._live:
            return mock_fn(*args)
        try:
            with self._lock:
                result = fn(*args)
            if not result:
                return mock_fn(*args)
            return result
        except Exception:  # noqa: BLE001 - degrade gracefully to mock data on any live-call failure
            return mock_fn(*args)

    def get_summary(self, day: str):
        return self._safe_call(lambda d: self._client.get_stats(d), mock_data.mock_summary, day)

    def get_heart_rate(self, day: str):
        return self._safe_call(lambda d: self._client.get_heart_rates(d), mock_data.mock_heart_rate, day)

    def get_sleep(self, day: str):
        def live(d):
            raw = self._client.get_sleep_data(d)
            dto = raw.get("dailySleepDTO", {}) if raw else {}
            if not dto:
                return None
            return {
                "date": day,
                "totalSleepSeconds": dto.get("sleepTimeSeconds", 0),
                "deepSleepSeconds": dto.get("deepSleepSeconds", 0),
                "lightSleepSeconds": dto.get("lightSleepSeconds", 0),
                "remSleepSeconds": dto.get("remSleepSeconds", 0),
                "awakeSeconds": dto.get("awakeSleepSeconds", 0),
                "sleepScore": (raw.get("sleepScores", {}) or {}).get("overall", {}).get("value", 0),
            }

        return self._safe_call(live, mock_data.mock_sleep, day)

    def get_stress(self, day: str):
        def live(d):
            raw = self._client.get_stress_data(d)
            if not raw:
                return None
            return {
                "date": day,
                "avgStressLevel": raw.get("avgStressLevel", 0),
                "maxStressLevel": raw.get("maxStressLevel", 0),
                "restStressPercent": raw.get("restStressPercentage", 0),
            }

        return self._safe_call(live, mock_data.mock_stress, day)

    def get_body_battery(self, day: str):
        def live(d):
            raw = self._client.get_body_battery(d, d)
            if not raw:
                return None
            entry = raw[0] if isinstance(raw, list) else raw
            return {
                "date": day,
                "bodyBatteryValues": entry.get("bodyBatteryValuesArray", []),
            }

        return self._safe_call(live, mock_data.mock_body_battery, day)

    def get_activities(self, limit: int = 10):
        return self._safe_call(lambda n: self._client.get_activities(0, n), mock_data.mock_activities, limit)


def today_str() -> str:
    return date.today().isoformat()
