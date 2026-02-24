// Prometheus API client — direct browser calls

export interface PrometheusConfig {
  baseUrl: string;
  username?: string;
  password?: string;
}

export interface TSDBStatus {
  headStats: {
    numSeries: number;
    numLabelPairs: number;
    chunkCount: number;
    minTime: number;
    maxTime: number;
  };
  seriesCountByMetricName: Array<{ name: string; value: number }>;
  labelValueCountByLabelName: Array<{ name: string; value: number }>;
  memoryInBytesByLabelName: Array<{ name: string; value: number }>;
  seriesCountByLabelValuePair: Array<{ name: string; value: number }>;
}

export interface TargetInfo {
  activeTargets: Array<{
    discoveredLabels: Record<string, string>;
    labels: Record<string, string>;
    scrapePool: string;
    scrapeUrl: string;
    globalUrl: string;
    lastError: string;
    lastScrape: string;
    lastScrapeDuration: number;
    health: "up" | "down" | "unknown";
    scrapeInterval: string;
    scrapeTimeout: string;
  }>;
  droppedTargets: Array<{
    discoveredLabels: Record<string, string>;
  }>;
}

export interface PrometheusResponse<T> {
  status: "success" | "error";
  data: T;
  errorType?: string;
  error?: string;
}

function buildHeaders(config: PrometheusConfig): HeadersInit {
  const headers: HeadersInit = { "Content-Type": "application/json" };
  if (config.username && config.password) {
    headers["Authorization"] = `Basic ${btoa(`${config.username}:${config.password}`)}`;
  }
  return headers;
}

async function fetchProm<T>(config: PrometheusConfig, path: string): Promise<T> {
  const url = `${config.baseUrl.replace(/\/+$/, "")}${path}`;
  const res = await fetch(url, { headers: buildHeaders(config) });
  if (!res.ok) throw new Error(`Prometheus API error: ${res.status} ${res.statusText}`);
  const json: PrometheusResponse<T> = await res.json();
  if (json.status === "error") throw new Error(json.error || "Unknown Prometheus error");
  return json.data;
}

export async function getTSDBStatus(config: PrometheusConfig): Promise<TSDBStatus> {
  return fetchProm<TSDBStatus>(config, "/api/v1/status/tsdb");
}

export async function getTargets(config: PrometheusConfig): Promise<TargetInfo> {
  return fetchProm<TargetInfo>(config, "/api/v1/targets");
}

export async function getConfig(config: PrometheusConfig): Promise<{ yaml: string }> {
  return fetchProm<{ yaml: string }>(config, "/api/v1/status/config");
}

export async function queryInstant(config: PrometheusConfig, query: string): Promise<any> {
  const encoded = encodeURIComponent(query);
  return fetchProm<any>(config, `/api/v1/query?query=${encoded}`);
}

export async function queryRange(
  config: PrometheusConfig,
  query: string,
  start: number,
  end: number,
  step: string
): Promise<any> {
  const params = new URLSearchParams({ query, start: String(start), end: String(end), step });
  return fetchProm<any>(config, `/api/v1/query_range?${params}`);
}

export async function getSeries(config: PrometheusConfig, match: string): Promise<any[]> {
  const params = new URLSearchParams({ "match[]": match });
  return fetchProm<any[]>(config, `/api/v1/series?${params}`);
}

export async function getLabelValues(config: PrometheusConfig, label: string): Promise<string[]> {
  return fetchProm<string[]>(config, `/api/v1/label/${label}/values`);
}

// Health check — tries all 3 endpoints
export async function healthCheck(config: PrometheusConfig): Promise<{
  tsdb: boolean;
  targets: boolean;
  config: boolean;
}> {
  const results = await Promise.allSettled([
    getTSDBStatus(config),
    getTargets(config),
    getConfig(config),
  ]);
  return {
    tsdb: results[0].status === "fulfilled",
    targets: results[1].status === "fulfilled",
    config: results[2].status === "fulfilled",
  };
}

// Local storage persistence
const STORAGE_KEY = "prometheus-autopsy-connections";

export function getSavedConnections(): PrometheusConfig[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveConnection(config: PrometheusConfig): void {
  const existing = getSavedConnections();
  const filtered = existing.filter((c) => c.baseUrl !== config.baseUrl);
  filtered.unshift(config);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered.slice(0, 10)));
}

export function removeConnection(baseUrl: string): void {
  const existing = getSavedConnections();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(existing.filter((c) => c.baseUrl !== baseUrl)));
}
