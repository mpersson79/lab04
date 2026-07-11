"""Deterministic sample data so the dashboard is demoable without real Garmin credentials."""
import random
from datetime import datetime, timedelta


def _seeded_random(date_str: str) -> random.Random:
    return random.Random(date_str)


def mock_summary(date_str: str) -> dict:
    rnd = _seeded_random(date_str)
    steps = rnd.randint(4500, 14000)
    return {
        "date": date_str,
        "steps": steps,
        "stepGoal": 10000,
        "totalKilocalories": round(steps * 0.045 + rnd.randint(200, 500)),
        "distanceMeters": round(steps * 0.78),
        "floorsClimbed": rnd.randint(2, 22),
        "activeSeconds": rnd.randint(1200, 5400),
        "restingHeartRate": rnd.randint(48, 62),
        "minHeartRate": rnd.randint(42, 50),
        "maxHeartRate": rnd.randint(120, 175),
    }


def mock_heart_rate(date_str: str) -> dict:
    rnd = _seeded_random(date_str + "hr")
    base = datetime.strptime(date_str, "%Y-%m-%d")
    points = []
    hr = rnd.randint(58, 68)
    for i in range(0, 24 * 60, 15):
        hr += rnd.randint(-4, 4)
        hr = max(45, min(170, hr))
        ts = base + timedelta(minutes=i)
        points.append([int(ts.timestamp() * 1000), hr])
    return {
        "date": date_str,
        "restingHeartRate": rnd.randint(48, 62),
        "heartRateValues": points,
    }


def mock_sleep(date_str: str) -> dict:
    rnd = _seeded_random(date_str + "sleep")
    total = rnd.randint(5 * 3600, 8 * 3600 + 1800)
    deep = int(total * rnd.uniform(0.12, 0.22))
    rem = int(total * rnd.uniform(0.15, 0.25))
    light = total - deep - rem - rnd.randint(300, 1800)
    awake = total - deep - rem - light
    return {
        "date": date_str,
        "totalSleepSeconds": total,
        "deepSleepSeconds": deep,
        "lightSleepSeconds": max(light, 0),
        "remSleepSeconds": rem,
        "awakeSeconds": max(awake, 0),
        "sleepScore": rnd.randint(55, 92),
    }


def mock_stress(date_str: str) -> dict:
    rnd = _seeded_random(date_str + "stress")
    return {
        "date": date_str,
        "avgStressLevel": rnd.randint(15, 45),
        "maxStressLevel": rnd.randint(60, 95),
        "restStressPercent": rnd.randint(30, 60),
    }


def mock_body_battery(date_str: str) -> dict:
    rnd = _seeded_random(date_str + "bb")
    base = datetime.strptime(date_str, "%Y-%m-%d")
    points = []
    level = rnd.randint(80, 100)
    for i in range(0, 24 * 60, 15):
        drift = rnd.randint(-3, 2)
        level = max(5, min(100, level + drift))
        ts = base + timedelta(minutes=i)
        points.append([int(ts.timestamp() * 1000), level])
    return {"date": date_str, "bodyBatteryValues": points}


def mock_activities(limit: int = 10) -> list:
    rnd = _seeded_random("activities")
    types = ["running", "cycling", "strength_training", "swimming", "walking", "yoga"]
    activities = []
    for i in range(limit):
        day = datetime.now() - timedelta(days=i)
        activities.append({
            "activityId": 1000 + i,
            "activityName": f"{types[i % len(types)].replace('_', ' ').title()} Session",
            "activityType": types[i % len(types)],
            "startTimeLocal": day.strftime("%Y-%m-%d %H:%M:%S"),
            "duration": rnd.randint(900, 5400),
            "distance": rnd.randint(0, 15000),
            "calories": rnd.randint(150, 900),
            "averageHR": rnd.randint(110, 165),
        })
    return activities
