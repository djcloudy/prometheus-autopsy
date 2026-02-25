import { useAppContext } from "@/lib/store";
import { Navigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PlayCircle, Plus, Trash2, ArrowRight } from "lucide-react";
import { useState, useMemo } from "react";

type SimAction = "drop_label" | "drop_bucket" | "increase_interval" | "drop_metric";

interface Simulation {
  id: string;
  action: SimAction;
  target: string;
  param?: string;
}

export default function Simulate() {
  const { connection } = useAppContext();
  const tsdb = connection.tsdbStatus;
  const totalSeries = tsdb?.headStats?.numSeries ?? 0;
  const metrics = tsdb?.seriesCountByMetricName ?? [];
  const labels = tsdb?.labelValueCountByLabelName ?? [];

  const [simulations, setSimulations] = useState<Simulation[]>(() => {
    try {
      const stored = localStorage.getItem("autopsy-simulations");
      return stored ? JSON.parse(stored) : [];
    } catch { return []; }
  });
  const [action, setAction] = useState<SimAction>("drop_metric");
  const [target, setTarget] = useState("");

  // Persist simulations to localStorage
  const updateSimulations = (updater: (prev: Simulation[]) => Simulation[]) => {
    setSimulations((prev) => {
      const next = updater(prev);
      localStorage.setItem("autopsy-simulations", JSON.stringify(next));
      return next;
    });
  };

  const addSimulation = () => {
    if (!target.trim()) return;
    updateSimulations((prev) => [...prev, { id: crypto.randomUUID(), action, target: target.trim() }]);
    setTarget("");
  };

  const removeSimulation = (id: string) => {
    updateSimulations((prev) => prev.filter((s) => s.id !== id));
  };

  const clearAll = () => {
    updateSimulations(() => []);
  };

  // Estimate impact
  const impact = useMemo(() => {
    let seriesReduction = 0;
    for (const sim of simulations) {
      switch (sim.action) {
        case "drop_metric": {
          const m = metrics.find((x) => x.name === sim.target);
          if (m) seriesReduction += m.value;
          break;
        }
        case "drop_bucket": {
          const bucket = metrics.find((x) => x.name === `${sim.target}_bucket`);
          if (bucket) seriesReduction += bucket.value;
          break;
        }
        case "drop_label": {
          const l = labels.find((x) => x.name === sim.target);
          if (l && l.value > 1) {
            // Rough estimate: dropping a label reduces series by (1 - 1/values) for metrics using it
            seriesReduction += Math.round(totalSeries * 0.1 * (1 - 1 / l.value));
          }
          break;
        }
        case "increase_interval": {
          // Doesn't reduce series, reduces samples/sec
          break;
        }
      }
    }
    const pctReduction = totalSeries > 0 ? Math.min(99, Math.round((seriesReduction / totalSeries) * 100)) : 0;
    return { seriesReduction, pctReduction, remainingSeries: Math.max(0, totalSeries - seriesReduction) };
  }, [simulations, metrics, labels, totalSeries]);

  if (!connection.isConnected) return <Navigate to="/" replace />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <PlayCircle className="h-6 w-6" />
          "What If" Simulation
        </h1>
        <p className="text-muted-foreground text-sm">
          Stack multiple simulations to estimate cumulative impact.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Add Simulation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Action</Label>
              <Select value={action} onValueChange={(v: SimAction) => setAction(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="drop_metric">Drop Metric</SelectItem>
                  <SelectItem value="drop_bucket">Drop Buckets</SelectItem>
                  <SelectItem value="drop_label">Drop Label</SelectItem>
                  <SelectItem value="increase_interval">Increase Interval</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Target</Label>
              <Input
                className="font-mono text-sm"
                placeholder={action === "drop_label" ? "label_name" : "metric_name"}
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addSimulation()}
              />
            </div>
            <div className="flex items-end">
              <Button onClick={addSimulation} disabled={!target.trim()}>
                <Plus className="h-4 w-4 mr-1" /> Add
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {simulations.length > 0 && (
        <>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Active Simulations</CardTitle>
              <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={clearAll}>
                <Trash2 className="h-3.5 w-3.5 mr-1" /> Clear All
              </Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {simulations.map((sim) => (
                <div key={sim.id} className="flex items-center justify-between p-3 rounded-md border border-border text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-xs uppercase text-muted-foreground font-medium">
                      {sim.action.replace("_", " ")}
                    </span>
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                    <span className="font-mono">{sim.target}</span>
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeSimulation(sim.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Estimated Impact</CardTitle>
              <CardDescription>Directional estimates based on current TSDB data</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-6">
                <div>
                  <span className="text-xs text-muted-foreground uppercase">Series Reduction</span>
                  <p className="text-3xl font-bold font-mono text-severity-healthy">
                    -{impact.pctReduction}%
                  </p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground uppercase">Series Removed</span>
                  <p className="text-3xl font-bold font-mono">
                    {impact.seriesReduction.toLocaleString()}
                  </p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground uppercase">Remaining Series</span>
                  <p className="text-3xl font-bold font-mono">
                    {impact.remainingSeries.toLocaleString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
