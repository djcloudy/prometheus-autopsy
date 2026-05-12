// Parser + helpers for GMP --export.match flag rules.
// Format examples:
//   - --export.match={__name__=~"kube_pod.*"}
//   --export.match={project_id=~"pr-inf-telemetry"}
//   {__name__="up", job!=""}

export type MatchOp = "=" | "!=" | "=~" | "!~";

export interface Matcher {
  label: string;
  op: MatchOp;
  value: string;
}

export interface ExportRule {
  raw: string;
  matchers: Matcher[];
}

export interface ParseError {
  line: number;
  raw: string;
  message: string;
}

export interface ParseResult {
  rules: ExportRule[];
  errors: ParseError[];
}

const OPS: MatchOp[] = ["=~", "!~", "!=", "="];

function stripPrefix(line: string): string {
  let s = line.trim();
  // strip yaml dash + spaces
  if (s.startsWith("-")) s = s.slice(1).trim();
  // strip --export.match=
  s = s.replace(/^--?export\.match\s*=\s*/i, "");
  // strip surrounding quotes
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1);
  }
  return s.trim();
}

// Parse the inside of {...} into matchers. Handles quoted values that may contain commas.
function parseSelector(body: string): Matcher[] {
  const matchers: Matcher[] = [];
  let i = 0;
  const n = body.length;
  while (i < n) {
    // skip whitespace + commas
    while (i < n && /[\s,]/.test(body[i])) i++;
    if (i >= n) break;

    // read label (identifier)
    const labelStart = i;
    while (i < n && /[A-Za-z0-9_]/.test(body[i])) i++;
    const label = body.slice(labelStart, i);
    if (!label) throw new Error(`unexpected character '${body[i]}' at ${i}`);

    while (i < n && /\s/.test(body[i])) i++;

    // read op (longest match first)
    let op: MatchOp | null = null;
    for (const candidate of OPS) {
      if (body.startsWith(candidate, i)) {
        op = candidate;
        i += candidate.length;
        break;
      }
    }
    if (!op) throw new Error(`expected operator after label '${label}'`);

    while (i < n && /\s/.test(body[i])) i++;

    // read value: quoted "..." (with \" escape) or bare token
    let value = "";
    if (body[i] === '"' || body[i] === "'") {
      const q = body[i];
      i++;
      while (i < n && body[i] !== q) {
        if (body[i] === "\\" && i + 1 < n) {
          value += body[i + 1];
          i += 2;
        } else {
          value += body[i++];
        }
      }
      if (body[i] !== q) throw new Error(`unterminated quoted value for '${label}'`);
      i++;
    } else {
      const valStart = i;
      while (i < n && !/[,\s]/.test(body[i])) i++;
      value = body.slice(valStart, i);
    }

    matchers.push({ label, op, value });
  }
  return matchers;
}

export function parseExportMatchBlock(text: string): ParseResult {
  const rules: ExportRule[] = [];
  const errors: ParseError[] = [];
  const lines = text.split(/\r?\n/);
  lines.forEach((rawLine, idx) => {
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    let body = stripPrefix(rawLine);
    if (!body) return;
    if (!body.startsWith("{") || !body.endsWith("}")) {
      errors.push({ line: idx + 1, raw: rawLine, message: "rule must be wrapped in { … }" });
      return;
    }
    body = body.slice(1, -1);
    try {
      const matchers = parseSelector(body);
      if (matchers.length === 0) {
        errors.push({ line: idx + 1, raw: rawLine, message: "no matchers found" });
        return;
      }
      rules.push({ raw: rawLine.trim(), matchers });
    } catch (e: any) {
      errors.push({ line: idx + 1, raw: rawLine, message: e?.message || "parse error" });
    }
  });
  return { rules, errors };
}

/**
 * Parse the Go-formatted value Prometheus returns for the `export.match` flag at
 * /api/v1/status/flags. Format example:
 *   [[__name__=~"kube_pod.*"] [__name__=~"node_.*" __name__!~"node_systemd_unit.*"] [project_id=~"foo"]]
 * Each inner [...] group is one rule with one or more space-separated matchers.
 * Returns the equivalent text in `--export.match={...}` form so the standard
 * parseExportMatchBlock can consume it without special-casing.
 */
export function flagValueToRuleText(flagValue: string): string {
  const s = flagValue.trim();
  if (!s) return "";
  // Strip outer [ and ]
  let body = s;
  if (body.startsWith("[") && body.endsWith("]")) body = body.slice(1, -1);
  body = body.trim();

  const groups: string[] = [];
  let depth = 0;
  let start = -1;
  let inQuote: '"' | "'" | null = null;
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (inQuote) {
      if (ch === "\\") { i++; continue; }
      if (ch === inQuote) inQuote = null;
      continue;
    }
    if (ch === '"' || ch === "'") { inQuote = ch as any; continue; }
    if (ch === "[") {
      if (depth === 0) start = i + 1;
      depth++;
    } else if (ch === "]") {
      depth--;
      if (depth === 0 && start >= 0) {
        groups.push(body.slice(start, i));
        start = -1;
      }
    }
  }

  // For each group: matchers are separated by whitespace at depth 0.
  // Split, respecting quoted values.
  const lines: string[] = [];
  for (const g of groups) {
    const matchers: string[] = [];
    let buf = "";
    let q: '"' | "'" | null = null;
    for (let i = 0; i < g.length; i++) {
      const ch = g[i];
      if (q) {
        buf += ch;
        if (ch === "\\" && i + 1 < g.length) { buf += g[i + 1]; i++; continue; }
        if (ch === q) q = null;
        continue;
      }
      if (ch === '"' || ch === "'") { q = ch as any; buf += ch; continue; }
      if (/\s/.test(ch)) {
        if (buf.trim()) matchers.push(buf.trim());
        buf = "";
        continue;
      }
      buf += ch;
    }
    if (buf.trim()) matchers.push(buf.trim());
    if (matchers.length === 0) continue;
    lines.push(`- --export.match={${matchers.join(",")}}`);
  }
  return lines.join("\n");
}

function escapeQuotes(v: string): string {
  return v.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

export function matcherToString(m: Matcher): string {
  return `${m.label}${m.op}"${escapeQuotes(m.value)}"`;
}

export function ruleToSelector(rule: ExportRule): string {
  return `{${rule.matchers.map(matcherToString).join(",")}}`;
}

/**
 * Build a PromQL instant-vector expression that yields the union of all rule-matched
 * series. Uses `or` between selectors so duplicate series (same label set) are
 * deduplicated by PromQL set semantics.
 */
export function unionExpression(rules: ExportRule[]): string {
  if (rules.length === 0) return "";
  return rules.map((r) => `(${ruleToSelector(r)})`).join(" or ");
}

/**
 * Wrap a base selector so that it only matches series that ALSO match the export
 * rules. Implemented as `count((base) and on() (rule1 or rule2 ...))` is wrong
 * because `and on()` collapses to a single match — instead we use vector matching
 * `and ignoring()` won't work either. The correct trick: use label-equality `and`
 * (default matching on all labels) which keeps left-hand series whose label set
 * matches any series on the right. Returns the wrapped expression.
 */
export function intersectWithExport(baseSelector: string, rules: ExportRule[]): string {
  if (rules.length === 0) return baseSelector;
  return `(${baseSelector}) and (${unionExpression(rules)})`;
}

// ---------- per-connection persistence ----------

export interface ExportSettings {
  pricePerMillionSamples: number; // USD
  scrapeIntervalSec: number;
  samplesPerSeriesMultiplier: number; // for histograms etc.
}

export const DEFAULT_EXPORT_SETTINGS: ExportSettings = {
  pricePerMillionSamples: 0.06,
  scrapeIntervalSec: 30,
  samplesPerSeriesMultiplier: 1.0,
};

interface PersistShape {
  rawText: string;
  settings: ExportSettings;
}

const KEY = (baseUrl: string) => `prometheus-autopsy-export-${baseUrl}`;

export function loadExportConfig(baseUrl: string): PersistShape {
  try {
    const raw = localStorage.getItem(KEY(baseUrl));
    if (!raw) return { rawText: "", settings: { ...DEFAULT_EXPORT_SETTINGS } };
    const parsed = JSON.parse(raw);
    return {
      rawText: typeof parsed.rawText === "string" ? parsed.rawText : "",
      settings: { ...DEFAULT_EXPORT_SETTINGS, ...(parsed.settings ?? {}) },
    };
  } catch {
    return { rawText: "", settings: { ...DEFAULT_EXPORT_SETTINGS } };
  }
}

export function saveExportConfig(baseUrl: string, data: PersistShape): void {
  try {
    localStorage.setItem(KEY(baseUrl), JSON.stringify(data));
  } catch {
    /* ignore */
  }
}

// ---------- cost helpers ----------

export function estimateMonthlyCost(
  exportedSeries: number,
  settings: ExportSettings
): number {
  const samplesPerSec =
    (exportedSeries * settings.samplesPerSeriesMultiplier) /
    Math.max(1, settings.scrapeIntervalSec);
  const samplesPerMonth = samplesPerSec * 86400 * 30;
  return (samplesPerMonth / 1_000_000) * settings.pricePerMillionSamples;
}

export function formatUSD(n: number): string {
  if (!Number.isFinite(n)) return "$0";
  if (Math.abs(n) >= 1000) return `$${Math.round(n).toLocaleString()}`;
  if (Math.abs(n) >= 1) return `$${n.toFixed(2)}`;
  return `$${n.toFixed(4)}`;
}
