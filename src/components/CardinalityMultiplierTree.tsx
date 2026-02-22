import { useState, useCallback } from "react";
import { useAppContext } from "@/lib/store";
import { getSeries } from "@/lib/prometheus";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronRight, ChevronDown, GitBranch, Loader2, X, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface LabelBreakdown {
  label: string;
  uniqueValues: number;
  topValues: string[];
}

interface MetricTree {
  metric: string;
  totalSeries: number;
  labels: LabelBreakdown[];
  product: number;
}

function buildMultiplierTree(seriesData: Record<string, string>[]): LabelBreakdown[] {
  if (seriesData.length === 0) return [];

  const labelValues: Record<string, Set<string>> = {};

  for (const series of seriesData) {
    for (const [key, value] of Object.entries(series)) {
      if (key === "__name__") continue;
      if (!labelValues[key]) labelValues[key] = new Set();
      labelValues[key].add(value);
    }
  }

  return Object.entries(labelValues)
    .map(([label, values]) => ({
      label,
      uniqueValues: values.size,
      topValues: Array.from(values).slice(0, 5),
    }))
    .sort((a, b) => b.uniqueValues - a.uniqueValues);
}

export default function CardinalityMultiplierTree() {
  const { connection } = useAppContext();
  const metrics = connection.tsdbStatus?.seriesCountByMetricName ?? [];
  const [expanded, setExpanded] = useState<Record<string, MetricTree | "loading" | "error">>({});

  const handleExpand = useCallback(
    async (metricName: string, totalSeries: number) => {
      if (expanded[metricName]) {
        // Collapse
        setExpanded((prev) => {
          const next = { ...prev };
          delete next[metricName];
          return next;
        });
        return;
      }

      if (!connection.config) return;

      setExpanded((prev) => ({ ...prev, [metricName]: "loading" }));

      try {
        const seriesData = await getSeries(connection.config, `{__name__="${metricName}"}`);
        const labels = buildMultiplierTree(seriesData);
        const product = labels.reduce((acc, l) => acc * l.uniqueValues, 1);

        setExpanded((prev) => ({
          ...prev,
          [metricName]: { metric: metricName, totalSeries, labels, product },
        }));
      } catch {
        setExpanded((prev) => ({ ...prev, [metricName]: "error" }));
      }
    },
    [connection.config, expanded]
  );

  const topMetrics = metrics.slice(0, 20);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <GitBranch className="h-5 w-5 text-primary" />
          Cardinality Multiplier Tree
        </CardTitle>
        <p className="text-muted-foreground text-xs">
          Click a metric to drill down and see how labels multiply its series count.
        </p>
      </CardHeader>
      <CardContent className="space-y-0.5">
        {topMetrics.map((m) => {
          const state = expanded[m.name];
          const isExpanded = !!state && state !== "loading" && state !== "error";
          const isLoading = state === "loading";
          const isError = state === "error";

          return (
            <div key={m.name} className="rounded-md border border-border/50 overflow-hidden">
              {/* Metric row */}
              <button
                onClick={() => handleExpand(m.name, m.value)}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted/50",
                  isExpanded && "bg-muted/30"
                )}
              >
                {isLoading ? (
                  <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" />
                ) : isExpanded ? (
                  <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                )}
                <span className="font-mono truncate flex-1">{m.name}</span>
                <SeverityBadge count={m.value} />
                <span className="font-mono font-medium text-xs text-muted-foreground w-20 text-right">
                  {m.value.toLocaleString()}
                </span>
              </button>

              {/* Expanded tree */}
              {isExpanded && typeof state === "object" && (
                <MultiplierDetail tree={state} />
              )}

              {isError && (
                <div className="px-4 py-3 bg-severity-critical/5 border-t border-border/50 flex items-center gap-2 text-xs text-severity-critical">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Failed to fetch series data. The metric may have too many series or CORS may be blocking.
                  <button
                    onClick={() =>
                      setExpanded((prev) => {
                        const next = { ...prev };
                        delete next[m.name];
                        return next;
                      })
                    }
                    className="ml-auto"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function MultiplierDetail({ tree }: { tree: MetricTree }) {
  const [expandedLabels, setExpandedLabels] = useState<Set<string>>(new Set());

  const toggleLabel = (label: string) => {
    setExpandedLabels((prev) => {
      const next = new Set(prev);
      next.has(label) ? next.delete(label) : next.add(label);
      return next;
    });
  };

  return (
    <div className="border-t border-border/50 bg-muted/10 px-4 py-3 space-y-3">
      {/* Multiplication formula */}
      <div className="font-mono text-xs leading-relaxed">
        <span className="text-primary font-semibold">{tree.metric}</span>
        {tree.labels.map((l, i) => (
          <span key={l.label}>
            <span className="text-muted-foreground"> × </span>
            <span className="text-foreground">{l.label}</span>
            <span className="text-primary/80">({l.uniqueValues})</span>
          </span>
        ))}
        <span className="text-muted-foreground"> = </span>
        <span className="font-bold text-foreground">{tree.totalSeries.toLocaleString()}</span>
      </div>

      {/* Computed vs actual */}
      {tree.product !== tree.totalSeries && (
        <div className="text-[11px] text-muted-foreground">
          Theoretical max: {tree.product.toLocaleString()} — actual: {tree.totalSeries.toLocaleString()}{" "}
          <span className="text-primary/70">
            ({Math.round((tree.totalSeries / tree.product) * 100)}% density)
          </span>
        </div>
      )}

      {/* Label breakdown */}
      <div className="space-y-0.5">
        {tree.labels.map((l) => {
          const isOpen = expandedLabels.has(l.label);
          return (
            <div key={l.label}>
              <button
                onClick={() => toggleLabel(l.label)}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs hover:bg-muted/50 transition-colors"
              >
                {isOpen ? (
                  <ChevronDown className="h-3 w-3 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-3 w-3 text-muted-foreground" />
                )}
                <span className="font-mono text-foreground">{l.label}</span>
                <MultiplierBadge count={l.uniqueValues} />
                <span className="ml-auto font-mono text-muted-foreground">
                  ×{l.uniqueValues}
                </span>
              </button>
              {isOpen && (
                <div className="ml-7 pl-3 border-l border-border/40 py-1 space-y-0.5">
                  {l.topValues.map((v) => (
                    <div key={v} className="font-mono text-[11px] text-muted-foreground truncate">
                      {v}
                    </div>
                  ))}
                  {l.uniqueValues > 5 && (
                    <div className="text-[11px] text-muted-foreground/60">
                      …and {l.uniqueValues - 5} more
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SeverityBadge({ count }: { count: number }) {
  if (count > 10_000)
    return (
      <Badge className="bg-severity-critical/15 text-severity-critical border-severity-critical/30 text-[10px] px-1.5 py-0">
        Critical
      </Badge>
    );
  if (count > 5_000)
    return (
      <Badge className="bg-severity-moderate/15 text-severity-moderate border-severity-moderate/30 text-[10px] px-1.5 py-0">
        High
      </Badge>
    );
  if (count > 1_000)
    return (
      <Badge className="bg-severity-info/15 text-severity-info border-severity-info/30 text-[10px] px-1.5 py-0">
        Moderate
      </Badge>
    );
  return null;
}

function MultiplierBadge({ count }: { count: number }) {
  if (count > 100)
    return (
      <Badge className="bg-severity-critical/15 text-severity-critical border-severity-critical/30 text-[10px] px-1.5 py-0">
        Explosion
      </Badge>
    );
  if (count > 20)
    return (
      <Badge className="bg-severity-moderate/15 text-severity-moderate border-severity-moderate/30 text-[10px] px-1.5 py-0">
        High
      </Badge>
    );
  return null;
}
