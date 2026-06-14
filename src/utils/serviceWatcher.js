import { buildServiceMatrix } from "./serviceOrchestrator";

const WATCHER_STORAGE_KEY = "sysai_service_watcher_baselines";

function normalizePorts(openPorts = []) {
  return openPorts
    .map((item) => ({
      port: Number(item.port),
      service: item.service || "unknown",
      banner: item.banner || "",
    }))
    .filter((item) => Number.isFinite(item.port))
    .sort((a, b) => a.port - b.port);
}

export function loadWatcherBaselines() {
  try {
    return JSON.parse(localStorage.getItem(WATCHER_STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

export function saveWatcherBaseline(target, openPorts) {
  const baselines = loadWatcherBaselines();
  const normalized = normalizePorts(openPorts);
  baselines[target] = {
    target,
    capturedAt: new Date().toISOString(),
    openPorts: normalized,
  };
  localStorage.setItem(WATCHER_STORAGE_KEY, JSON.stringify(baselines));
  return baselines[target];
}

export function comparePortExposure(previousOpenPorts = [], currentOpenPorts = []) {
  const previous = normalizePorts(previousOpenPorts);
  const current = normalizePorts(currentOpenPorts);
  const previousByPort = new Map(previous.map((item) => [item.port, item]));
  const currentByPort = new Map(current.map((item) => [item.port, item]));

  const opened = current.filter((item) => !previousByPort.has(item.port));
  const closed = previous.filter((item) => !currentByPort.has(item.port));
  const changed = current
    .filter((item) => {
      const before = previousByPort.get(item.port);
      return before && (before.service !== item.service || before.banner !== item.banner);
    })
    .map((item) => ({
      port: item.port,
      before: previousByPort.get(item.port),
      after: item,
    }));

  return {
    opened,
    closed,
    changed,
    serviceMatrix: buildServiceMatrix(current.map((item) => item.port)),
  };
}
