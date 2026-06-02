const PROTOCOLS = [
  {
    key: "xray",
    name: "Xray + Reality",
    pingUrl: "https://httpbin.org/status/204",
    downloadUrl: "https://speed.hetzner.de/1MB.bin",
    uploadUrl: "https://httpbin.org/post"
  },
  {
    key: "awg",
    name: "AmneziaWG",
    pingUrl: "https://httpbin.org/status/204",
    downloadUrl: "https://speed.hetzner.de/1MB.bin",
    uploadUrl: "https://httpbin.org/post"
  }
];

const historyLimit = 20;
const charts = new Map();
const history = new Map();

function createChart(canvasId, label) {
  const element = document.getElementById(canvasId);
  return new Chart(element, {
    type: "line",
    data: {
      labels: [],
      datasets: [
        { label: `${label} ↓ Mbps`, data: [], borderColor: "#8dc6ff", tension: 0.25 },
        { label: `${label} ↑ Mbps`, data: [], borderColor: "#7af4b0", tension: 0.25 },
        { label: `${label} ping ms`, data: [], borderColor: "#ffc171", tension: 0.25 }
      ]
    },
    options: {
      responsive: true,
      animation: false,
      scales: {
        y: { beginAtZero: true, ticks: { color: "#d8e8ff" } },
        x: { ticks: { color: "#d8e8ff" } }
      },
      plugins: {
        legend: { labels: { color: "#d8e8ff" } }
      }
    }
  });
}

function toMbps(bytes, seconds) {
  if (!seconds || seconds <= 0) return 0;
  return ((bytes * 8) / (seconds * 1_000_000));
}

async function measureDownload(url) {
  const started = performance.now();
  const response = await fetch(`${url}?t=${Date.now()}`, { cache: "no-store" });
  if (!response.ok) throw new Error("download_failed");
  const buffer = await response.arrayBuffer();
  const elapsedSeconds = (performance.now() - started) / 1000;
  return toMbps(buffer.byteLength, elapsedSeconds);
}

async function measureUpload(url) {
  const payload = crypto.getRandomValues(new Uint8Array(128 * 1024));
  const started = performance.now();
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/octet-stream" },
    body: payload
  });
  if (!response.ok) throw new Error("upload_failed");
  const elapsedSeconds = (performance.now() - started) / 1000;
  return toMbps(payload.byteLength, elapsedSeconds);
}

async function measurePingAndLoss(url, tries = 6) {
  let successful = 0;
  let totalPing = 0;
  for (let i = 0; i < tries; i += 1) {
    const started = performance.now();
    try {
      const response = await fetch(`${url}?ping=${Date.now()}-${i}`, { cache: "no-store" });
      if (!response.ok) throw new Error("ping_not_ok");
      totalPing += performance.now() - started;
      successful += 1;
    } catch (error) {
      // request failed, counted as packet loss
    }
  }

  const averagePing = successful ? totalPing / successful : 0;
  const loss = ((tries - successful) / tries) * 100;
  return { pingMs: averagePing, lossPercent: loss };
}

function format(value, suffix) {
  return `${value.toFixed(2)} ${suffix}`;
}

function setProtocolStatus(key, status, isUp) {
  const statusEl = document.getElementById(`${key}Status`);
  statusEl.textContent = status;
  statusEl.classList.remove("up", "down");
  statusEl.classList.add(isUp ? "up" : "down");
}

function updateDisplay(protocol, metrics) {
  const { key } = protocol;
  document.getElementById(`${key}Download`).textContent = format(metrics.downloadMbps, "Mbps");
  document.getElementById(`${key}Upload`).textContent = format(metrics.uploadMbps, "Mbps");
  document.getElementById(`${key}Ping`).textContent = format(metrics.pingMs, "ms");
  document.getElementById(`${key}Loss`).textContent = format(metrics.lossPercent, "%");

  const nowLabel = new Date().toLocaleTimeString("ru-RU", { hour12: false });
  const itemHistory = history.get(key);
  itemHistory.push({ label: nowLabel, ...metrics });
  if (itemHistory.length > historyLimit) itemHistory.shift();

  const chart = charts.get(key);
  chart.data.labels = itemHistory.map(item => item.label);
  chart.data.datasets[0].data = itemHistory.map(item => item.downloadMbps);
  chart.data.datasets[1].data = itemHistory.map(item => item.uploadMbps);
  chart.data.datasets[2].data = itemHistory.map(item => item.pingMs);
  chart.update();
}

async function runSingleProtocolCheck(protocol) {
  const { key, pingUrl, downloadUrl, uploadUrl } = protocol;
  setProtocolStatus(key, "Проверка...", true);

  try {
    const [downloadMbps, uploadMbps, pingResult] = await Promise.all([
      measureDownload(downloadUrl),
      measureUpload(uploadUrl),
      measurePingAndLoss(pingUrl)
    ]);

    const metrics = {
      downloadMbps,
      uploadMbps,
      pingMs: pingResult.pingMs,
      lossPercent: pingResult.lossPercent
    };
    const isUp = pingResult.lossPercent < 80 && pingResult.pingMs > 0;
    setProtocolStatus(key, isUp ? "UP" : "DOWN", isUp);
    updateDisplay(protocol, metrics);
  } catch (error) {
    setProtocolStatus(key, "DOWN", false);
    updateDisplay(protocol, {
      downloadMbps: 0,
      uploadMbps: 0,
      pingMs: 0,
      lossPercent: 100
    });
  }
}

async function runAllChecks() {
  await Promise.all(PROTOCOLS.map(runSingleProtocolCheck));
}

function init() {
  PROTOCOLS.forEach(protocol => {
    history.set(protocol.key, []);
    charts.set(protocol.key, createChart(`${protocol.key}Chart`, protocol.name));
  });

  document.getElementById("refreshButton").addEventListener("click", runAllChecks);
  runAllChecks();
  setInterval(runAllChecks, 30_000);
}

init();
