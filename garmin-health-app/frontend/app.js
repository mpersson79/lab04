const API = "";

const statCards = [
  { key: "steps", label: "Steps", glow: "#4f7cff", format: (v, s) => `${v.steps.toLocaleString()}`, sub: (v) => `Goal ${v.stepGoal.toLocaleString()}` },
  { key: "calories", label: "Calories", glow: "#ff6b9d", format: (v) => `${v.totalKilocalories.toLocaleString()}`, sub: () => "kcal today" },
  { key: "distance", label: "Distance", glow: "#22d3c8", format: (v) => `${(v.distanceMeters / 1000).toFixed(2)}`, sub: () => "km" },
  { key: "floors", label: "Floors Climbed", glow: "#ffb84f", format: (v) => `${v.floorsClimbed}`, sub: () => "floors" },
  { key: "restingHr", label: "Resting HR", glow: "#3ddc97", format: (v) => `${v.restingHeartRate}`, sub: () => "bpm" },
];

let hrChart, bbChart, sleepChart;

function fmtDuration(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

async function fetchJSON(path) {
  const res = await fetch(`${API}${path}`);
  if (!res.ok) throw new Error(`${path} failed: ${res.status}`);
  return res.json();
}

function renderStatGrid(summary, sleep, stress) {
  const grid = document.getElementById("stat-grid");
  grid.innerHTML = "";

  statCards.forEach((cfg) => {
    const card = document.createElement("div");
    card.className = "card stat-card";
    card.style.setProperty("--stat-glow", cfg.glow);
    card.innerHTML = `
      <span class="stat-label">${cfg.label}</span>
      <span class="stat-value">${cfg.format(summary)}</span>
      <span class="stat-sub">${cfg.sub(summary)}</span>
    `;
    grid.appendChild(card);
  });

  const sleepCard = document.createElement("div");
  sleepCard.className = "card stat-card";
  sleepCard.style.setProperty("--stat-glow", "#8b7bff");
  sleepCard.innerHTML = `
    <span class="stat-label">Sleep</span>
    <span class="stat-value">${fmtDuration(sleep.totalSleepSeconds)}</span>
    <span class="stat-sub">Score ${sleep.sleepScore}/100</span>
  `;
  grid.appendChild(sleepCard);

  const stressCard = document.createElement("div");
  stressCard.className = "card stat-card";
  stressCard.style.setProperty("--stat-glow", "#ff9f43");
  stressCard.innerHTML = `
    <span class="stat-label">Avg Stress</span>
    <span class="stat-value">${stress.avgStressLevel}</span>
    <span class="stat-sub">Rest ${stress.restStressPercent}% of day</span>
  `;
  grid.appendChild(stressCard);
}

function toChartPoints(values) {
  return (values || []).filter((p) => p && p[1] !== null).map((p) => ({ x: p[0], y: p[1] }));
}

function renderHrChart(hr) {
  const ctx = document.getElementById("hr-chart");
  const data = toChartPoints(hr.heartRateValues);
  if (hrChart) hrChart.destroy();
  hrChart = new Chart(ctx, {
    type: "line",
    data: {
      datasets: [
        {
          label: "Heart Rate (bpm)",
          data,
          borderColor: "#ff6b9d",
          backgroundColor: "rgba(255,107,157,0.15)",
          borderWidth: 2,
          pointRadius: 0,
          fill: true,
          tension: 0.35,
        },
      ],
    },
    options: chartOptions("bpm"),
  });
}

function renderBbChart(bb) {
  const ctx = document.getElementById("bb-chart");
  const data = toChartPoints(bb.bodyBatteryValues);
  if (bbChart) bbChart.destroy();
  bbChart = new Chart(ctx, {
    type: "line",
    data: {
      datasets: [
        {
          label: "Body Battery",
          data,
          borderColor: "#22d3c8",
          backgroundColor: "rgba(34,211,200,0.15)",
          borderWidth: 2,
          pointRadius: 0,
          fill: true,
          tension: 0.35,
        },
      ],
    },
    options: chartOptions("%"),
  });
}

function renderSleepChart(sleep) {
  const ctx = document.getElementById("sleep-chart");
  if (sleepChart) sleepChart.destroy();
  sleepChart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["Deep", "Light", "REM", "Awake"],
      datasets: [
        {
          data: [sleep.deepSleepSeconds, sleep.lightSleepSeconds, sleep.remSleepSeconds, sleep.awakeSeconds],
          backgroundColor: ["#4f7cff", "#8b93ab", "#22d3c8", "#ff6b9d"],
          borderWidth: 0,
        },
      ],
    },
    options: {
      plugins: {
        legend: { position: "bottom", labels: { color: "#eef1fb", boxWidth: 12, padding: 16 } },
      },
      cutout: "65%",
    },
  });
}

function chartOptions(unitLabel) {
  return {
    responsive: true,
    animation: false,
    plugins: { legend: { display: false } },
    scales: {
      x: {
        type: "time",
        time: { unit: "hour" },
        ticks: { color: "#8b93ab", maxTicksLimit: 6 },
        grid: { color: "rgba(255,255,255,0.05)" },
      },
      y: {
        ticks: { color: "#8b93ab", callback: (v) => `${v}${unitLabel === "%" ? "%" : ""}` },
        grid: { color: "rgba(255,255,255,0.05)" },
        title: { display: true, text: unitLabel, color: "#8b93ab" },
      },
    },
  };
}

function renderActivities(activities) {
  const list = document.getElementById("activities-list");
  list.innerHTML = "";
  activities.forEach((a) => {
    const li = document.createElement("li");
    li.className = "activity-item";
    li.innerHTML = `
      <div>
        <div class="activity-name">${a.activityName}</div>
        <div class="activity-meta">${a.startTimeLocal}</div>
      </div>
      <div class="activity-stats">
        <div>${Math.round(a.duration / 60)} min · ${a.calories} kcal</div>
        <div>avg HR ${a.averageHR} bpm</div>
      </div>
    `;
    list.appendChild(li);
  });
}

async function refreshStatus() {
  const pill = document.getElementById("status-pill");
  try {
    const status = await fetchJSON("/api/status");
    pill.textContent = status.live ? "● Live Garmin data" : "○ Sample data";
    pill.className = `status-pill ${status.live ? "live" : "mock"}`;
    pill.title = status.message;
  } catch {
    pill.textContent = "○ Offline";
  }
}

async function loadDashboard(day) {
  const [summary, hr, sleep, stress, bb, activities] = await Promise.all([
    fetchJSON(`/api/health/summary?day=${day}`),
    fetchJSON(`/api/health/heart-rate?day=${day}`),
    fetchJSON(`/api/health/sleep?day=${day}`),
    fetchJSON(`/api/health/stress?day=${day}`),
    fetchJSON(`/api/health/body-battery?day=${day}`),
    fetchJSON(`/api/health/activities?limit=8`),
  ]);

  renderStatGrid(summary, sleep, stress);
  renderHrChart(hr);
  renderBbChart(bb);
  renderSleepChart(sleep);
  renderActivities(activities);
}

function init() {
  const picker = document.getElementById("date-picker");
  const today = new Date().toISOString().slice(0, 10);
  picker.value = today;
  picker.max = today;

  refreshStatus();
  loadDashboard(today);

  picker.addEventListener("change", () => loadDashboard(picker.value));
}

init();
