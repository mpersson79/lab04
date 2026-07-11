from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from garmin_client import GarminHealthClient, today_str

app = FastAPI(title="Garmin Health Dashboard")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

client = GarminHealthClient()

FRONTEND_DIR = Path(__file__).resolve().parent.parent / "frontend"


@app.get("/api/status")
def status():
    return client.status


@app.get("/api/health/summary")
def summary(day: str = Query(default_factory=today_str)):
    return client.get_summary(day)


@app.get("/api/health/heart-rate")
def heart_rate(day: str = Query(default_factory=today_str)):
    return client.get_heart_rate(day)


@app.get("/api/health/sleep")
def sleep(day: str = Query(default_factory=today_str)):
    return client.get_sleep(day)


@app.get("/api/health/stress")
def stress(day: str = Query(default_factory=today_str)):
    return client.get_stress(day)


@app.get("/api/health/body-battery")
def body_battery(day: str = Query(default_factory=today_str)):
    return client.get_body_battery(day)


@app.get("/api/health/activities")
def activities(limit: int = 10):
    return client.get_activities(limit)


app.mount("/", StaticFiles(directory=str(FRONTEND_DIR), html=True), name="frontend")
