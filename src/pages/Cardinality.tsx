import { useAppContext } from "@/lib/store";
import { Navigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart3 } from "lucide-react";
import { Treemap, ResponsiveContainer } from "recharts";
import CardinalityMultiplierTree from "@/components/CardinalityMultiplierTree";

export default function Cardinality() {
  const { connection } = useAppContext();
  const tsdb = connection.tsdbStatus;
  const metrics = tsdb?.seriesCountByMetricName ?? [];
  const labels = tsdb?.labelValueCountByLabelName ?? [];
  const pairs = tsdb?.seriesCountByLabelValuePair ?? [];

  if (!connection.isConnected) return <Navigate to="/" replace />;

  // Build treemap data
  const treemapData = metrics.slice(0, 30).map((m) => ({
    name: m.name.length > 30 ? m.name.slice(0, 30) + "…" : m.name,
    fullName: m.name,
    size: m.value,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <BarChart3 className="h-6 w-6" />
          High Cardinality Analysis
        </h1>
        <p className="text-muted-foreground text-sm">
          Identifies the most expensive metrics, labels, and label-value pairs.
        </p>
      </div>

      {/* Treemap */}
      {treemapData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Metric Family Impact</CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <Treemap
                data={treemapData}
                dataKey="size"
                nameKey="name"
                stroke="hsl(var(--border))"
                fill="hsl(var(--primary))"
                content={<TreemapCell />}
              />
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Multiplier Tree */}
      <CardinalityMultiplierTree />

      {/* Top metrics table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Top Metrics by Series Count</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1.5">
            {metrics.slice(0, 30).map((m) => (
              <div key={m.name} className="flex items-center justify-between text-sm py-1.5 border-b border-border/50 last:border-0">
                <span className="font-mono truncate flex-1 mr-4">{m.name}</span>
                <div className="flex items-center gap-2">
                  <SeverityBadge count={m.value} />
                  <span className="font-mono font-medium w-20 text-right">{m.value.toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Top labels */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Top Labels by Value Count</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1.5">
            {labels.slice(0, 20).map((l) => (
              <div key={l.name} className="flex items-center justify-between text-sm py-1.5 border-b border-border/50 last:border-0">
                <span className="font-mono truncate flex-1 mr-4">{l.name}</span>
                <span className="font-mono font-medium">{l.value.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Top label-value pairs */}
      {pairs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Top Label-Value Pairs by Series Count</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5">
              {pairs.slice(0, 20).map((p) => (
                <div key={p.name} className="flex items-center justify-between text-sm py-1.5 border-b border-border/50 last:border-0">
                  <span className="font-mono truncate flex-1 mr-4">{p.name}</span>
                  <span className="font-mono font-medium">{p.value.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function SeverityBadge({ count }: { count: number }) {
  if (count > 10_000)
    return <Badge className="bg-severity-critical/15 text-severity-critical border-severity-critical/30 text-xs">Critical</Badge>;
  if (count > 5_000)
    return <Badge className="bg-severity-moderate/15 text-severity-moderate border-severity-moderate/30 text-xs">High</Badge>;
  if (count > 1_000)
    return <Badge className="bg-severity-info/15 text-severity-info border-severity-info/30 text-xs">Moderate</Badge>;
  return null;
}

function TreemapCell(props: any) {
  const { x, y, width, height, name, size } = props;
  if (width < 30 || height < 20) return null;

  const severity = size > 10_000 ? "critical" : size > 5_000 ? "moderate" : size > 1_000 ? "info" : "healthy";
  const fills: Record<string, string> = {
    critical: "hsl(var(--severity-critical) / 0.3)",
    moderate: "hsl(var(--severity-moderate) / 0.3)",
    info: "hsl(var(--severity-info) / 0.2)",
    healthy: "hsl(var(--severity-healthy) / 0.15)",
  };

  return (
    <g>
      <rect x={x} y={y} width={width} height={height} fill={fills[severity]} stroke="hsl(var(--border))" strokeWidth={1} rx={3} />
      {width > 60 && height > 30 && (
        <text x={x + 6} y={y + 16} fill="hsl(var(--foreground))" fontSize={11} fontFamily="JetBrains Mono, monospace">
          {name}
        </text>
      )}
      {width > 50 && height > 40 && (
        <text x={x + 6} y={y + 30} fill="hsl(var(--muted-foreground))" fontSize={10} fontFamily="JetBrains Mono, monospace">
          {size?.toLocaleString()}
        </text>
      )}
    </g>
  );
}
