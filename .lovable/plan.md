
## Exported Metrics view (GMP)

A new page that lets you paste your `--export.match={...}` flags, evaluates which series Prometheus would export to Google Managed Prometheus, and surfaces both share-of-total and estimated monthly cost. The Simulate page gains an exported-impact column per row and an aggregate exported card.

### 1. New page: `/exported` — "Exported Metrics"

Sidebar entry between Scrapes and Simulate (icon: `Cloud` or `Upload`).

Sections:

1. **Export rules** — textarea where the user pastes their flag block, e.g.
   ```
   - --export.match={__name__=~"kube_pod.*"}
   - --export.match={project_id=~"pr-inf-telemetry"}
   ```
   Parsed into matchers; combined with **OR** (GMP default). Saved per-connection in localStorage. Each parsed rule rendered as a chip with delete + parse-error display.

2. **Cost settings** — small form: `$ per million samples ingested` (default `0.06`, GMP public price), `scrape interval (s)` (default pulled from `promConfig` global, fallback 30). Saved alongside rules.

3. **Summary cards**:
   - Total active series (from TSDB head)
   - Exported series (live count via PromQL — see below)
   - % exported
   - Estimated samples/sec = exported_series / scrape_interval
   - Estimated $/month = samples/sec × 86400 × 30 × ($/M / 1e6)

4. **Top exported metrics table** — for each rule, show matched series count and top metric names. Click a metric → deep-link to Simulate with `drop_metric` prefilled.

5. **Top non-exported high-cardinality metrics** — pulled from TSDB top-N minus what the rules match. Useful for "this is huge AND we don't even ship it — drop it."

### 2. Evaluation strategy (live, accurate)

For each parsed rule, build a PromQL series count using the rule's matchers:

- `--export.match={__name__=~"kube_pod.*"}` → `count({__name__=~"kube_pod.*"})`
- `--export.match={project_id=~"pr-inf-telemetry"}` → `count({project_id=~"pr-inf-telemetry"})`
- Combined exported total via OR using `or` operator on aggregates is wrong (would double-count). Instead: run one `count(...)` per rule for the per-rule breakdown, and one combined `count({...} or {...} or ...)` query for the unique total. (Prom `or` on instant vectors deduplicates by label set, so `count({a} or {b})` returns the union series count.)
- For top exported metrics per rule: `topk(20, count by (__name__) ({matchers}))`.

All queries gated behind a "Run analysis" button (Deep Scan-style) since wide regexes can be expensive. Cache results in component state until rules change.

### 3. Simulate page integration

Extend `Simulation` with:
- `exportedSeriesCount?: number` — measured at add-time using the active export rules (if configured).
- For `drop_metric`: `count({__name__="X"} and ({rule1} or {rule2} ...))`.
- For `drop_label`: `count({L!="",__name__!=""} and ({rules}))` and value count within exported set.

Per-row UI: new "Exported delta" line showing `−N exported series (~$X/mo)`.

Aggregate impact card gets two new lines:
- `Exported series reduction: −N (Y% of exported)`
- `Estimated monthly savings: $Z`

If no export rules configured, hide the exported columns and show a one-line "Configure export rules in Exported Metrics →" link.

### 4. Shared module: `src/lib/exportMatch.ts`

```text
parseExportMatchBlock(text) -> { rules: Rule[], errors: ParseError[] }
Rule = { raw: string, matchers: Matcher[] }
Matcher = { label: string, op: '='|'!='|'=~'|'!~', value: string }

ruleToSelector(rule) -> string         // "{__name__=~\"kube_pod.*\"}"
unionSelector(rules) -> string          // "({r1}) or ({r2}) or ..."
intersectWithSelector(seriesSelector, rules) -> string
```

Parser handles:
- Lines starting with `- --export.match=` or `--export.match=` (strip leading dash/whitespace).
- Selector content `{label OP "value"[, label OP "value"...]}` — values may be quoted or bare.
- Skips blank lines and comments.
- Returns line-level errors so the UI can flag bad rules without dropping good ones.

### 5. Persistence

`src/lib/store.ts` ConnectionState gains:
```text
exportRules: Rule[]
exportSettings: { pricePerMillionSamples: number; scrapeIntervalSec: number }
```
Stored per-baseUrl in localStorage under `prometheus-autopsy-export-${baseUrl}`. Loaded on connect, written on change.

### 6. Help content

Add `exportedHelp` to `PageHelp.tsx` covering: what GMP export.match does, OR vs AND semantics, why % matters for cost, how cost is calculated (with the formula), and caveats (samples-per-scrape ≈ 1 for counters/gauges; histograms/summaries inflate it — note this in fine print and offer a "samples per series multiplier" advanced setting, default 1.0).

### 7. Files

New:
- `src/pages/Exported.tsx`
- `src/lib/exportMatch.ts`

Edited:
- `src/App.tsx` — register `/exported` route; extend ConnectionState init/disconnect.
- `src/components/AppSidebar.tsx` — add nav entry.
- `src/components/PageHelp.tsx` — add `exportedHelp`; extend `simulateHelp` to mention exported impact.
- `src/lib/store.ts` — extend ConnectionState type.
- `src/pages/Connect.tsx` — load persisted export rules/settings on connect.
- `src/pages/Simulate.tsx` — measure exported deltas, render per-row line + aggregate card lines, link to Exported page when unconfigured.

### Out of scope (call out, don't build)

- Parsing Prometheus YAML config to auto-extract export.match — deferred; paste-only for v1.
- Per-target sample rate measurement (would need `scrape_samples_scraped` aggregation) — using interval-based estimate with a multiplier knob instead.
- Multi-region GMP pricing tiers — single price input for now.
