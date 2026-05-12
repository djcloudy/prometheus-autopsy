import { useAppContext } from "@/lib/store";
import { Navigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PlayCircle, Plus, Trash2, ArrowRight, ChevronsUpDown } from "lucide-react";
import { PageHelp, simulateHelp } from "@/components/PageHelp";
import { useState, useMemo, useRef, useEffect } from "react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { ScrollArea } from "@/components/ui/scroll-area";

import { queryInstant } from "@/lib/prometheus";
import {
  unionExpression,
  estimateMonthlyCost,
  formatUSD,
} from "@/lib/exportMatch";
import { Link as RouterLink } from "react-router-dom";

type SimAction = "drop_label" | "drop_bucket" | "increase_interval" | "drop_metric";

interface Simulation {
  id: string;
  action: SimAction;
  target: string;
  param?: string;
  /** Cached series count fetched from Prometheus when not in TSDB top-N */
  seriesCount?: number;
  /** Series this drop would remove from the EXPORTED set */
  exportedSeriesCount?: number;
  /** For drop_label: number of distinct values of this label */
  labelValueCount?: number;
  /** For drop_label: distinct values of this label within the EXPORTED set */
  labelValueCountExported?: number;
  /** For drop_label: total series that carry this label */
  labelAffectedSeries?: number;
  /** For drop_label: series carrying this label within the EXPORTED set */
  labelAffectedSeriesExported?: number;
  /** True while we're fetching live counts from Prometheus */
  loading?: boolean;
}

export default function Simulate() {
  const { connection } = useAppContext();
  const [searchParams, setSearchParams] = useSearchParams();
  const tsdb = connection.tsdbStatus;
  const totalSeries = tsdb?.headStats?.numSeries ?? 0;
  const metrics = tsdb?.seriesCountByMetricName ?? [];
  const labels = tsdb?.labelValueCountByLabelName ?? [];
  // Full lists from /api/v1/label/__name__/values and /api/v1/labels (not limited to TSDB top-N)
  const allMetricNames = connection.allMetricNames ?? [];
  const allLabelNames = connection.allLabelNames ?? [];

  const [simulations, setSimulations] = useState<Simulation[]>(() => {
    try {
      const stored = localStorage.getItem("autopsy-simulations");
      return stored ? JSON.parse(stored) : [];
    } catch { return []; }
  });
  const [action, setAction] = useState<SimAction>("drop_metric");
  const [target, setTarget] = useState("");
  const [comboOpen, setComboOpen] = useState(false);

  const suggestions = useMemo(() => {
    if (action === "drop_label") {
      // Merge full label list with TSDB top labels, dedupe, sort
      const set = new Set<string>(allLabelNames);
      labels.forEach((l) => set.add(l.name));
      return Array.from(set).sort();
    }
    // Drop metric / drop bucket: merge full metric name list with TSDB top metrics
    const set = new Set<string>(allMetricNames);
    metrics.forEach((m) => set.add(m.name));
    return Array.from(set).sort();
  }, [action, metrics, labels, allMetricNames, allLabelNames]);

  // Handle incoming deep-link params from Churn page
  useEffect(() => {
    const paramAction = searchParams.get("action") as SimAction | null;
    const paramTarget = searchParams.get("target");
    if (paramAction && paramTarget) {
      setAction(paramAction);
      setTarget(paramTarget);
      // Clear params so they don't re-trigger
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  // Persist simulations to localStorage
  const updateSimulations = (updater: (prev: Simulation[]) => Simulation[]) => {
    setSimulations((prev) => {
      const next = updater(prev);
      localStorage.setItem("autopsy-simulations", JSON.stringify(next));
      return next;
    });
  };

  const addSimulation = async () => {
    const t = target.trim();
    if (!t) return;
    // Dedupe: don't add an identical (action, target) twice
    if (simulations.some((s) => s.action === action && s.target === t)) {
      setTarget("");
      return;
    }
    const id = crypto.randomUUID();
    updateSimulations((prev) => [...prev, { id, action, target: t, loading: true }]);
    setTarget("");

    if (!connection.config) {
      updateSimulations((prev) => prev.map((s) => (s.id === id ? { ...s, loading: false } : s)));
      return;
    }

    try {
      if (action === "drop_metric" || action === "drop_bucket") {
        // Live, accurate series count for this metric
        const metricName = action === "drop_bucket" ? `${t}_bucket` : t;
        const res = await queryInstant(connection.config, `count({__name__="${metricName}"})`);
        const val = Number(res?.result?.[0]?.value?.[1]);
        updateSimulations((prev) =>
          prev.map((s) =>
            s.id === id ? { ...s, seriesCount: Number.isFinite(val) ? val : 0, loading: false } : s
          )
        );
      } else if (action === "drop_label") {
        // affectedSeries = series carrying this label; valueCount = distinct values seen
        const [affectedRes, valuesRes] = await Promise.all([
          queryInstant(connection.config, `count({__name__!="",${t}!=""})`),
          queryInstant(connection.config, `count(count by (${t}) ({__name__!="",${t}!=""}))`),
        ]);
        const affected = Number(affectedRes?.result?.[0]?.value?.[1]);
        const values = Number(valuesRes?.result?.[0]?.value?.[1]);
        updateSimulations((prev) =>
          prev.map((s) =>
            s.id === id
              ? {
                  ...s,
                  labelAffectedSeries: Number.isFinite(affected) ? affected : 0,
                  labelValueCount: Number.isFinite(values) ? values : 0,
                  loading: false,
                }
              : s
          )
        );
      } else {
        updateSimulations((prev) => prev.map((s) => (s.id === id ? { ...s, loading: false } : s)));
      }
    } catch {
      updateSimulations((prev) => prev.map((s) => (s.id === id ? { ...s, loading: false } : s)));
    }
  };

  const removeSimulation = (id: string) => {
    updateSimulations((prev) => prev.filter((s) => s.id !== id));
  };

  const clearAll = () => {
    updateSimulations(() => []);
  };

  // Estimate impact — series reduction is computed per simulation, then summed and
  // clamped to never exceed total series (we cannot compute exact overlap between
  // simultaneous drops, so the result is a directional upper bound).
  const impact = useMemo(() => {
    let seriesReduction = 0;
    let pendingCount = 0;
    for (const sim of simulations) {
      if (sim.loading) pendingCount++;
      switch (sim.action) {
        case "drop_metric": {
          // Prefer live count fetched at add-time; fall back to TSDB top-N value
          if (typeof sim.seriesCount === "number") seriesReduction += sim.seriesCount;
          else {
            const m = metrics.find((x) => x.name === sim.target);
            if (m) seriesReduction += m.value;
          }
          break;
        }
        case "drop_bucket": {
          if (typeof sim.seriesCount === "number") seriesReduction += sim.seriesCount;
          else {
            const bucket = metrics.find((x) => x.name === `${sim.target}_bucket`);
            if (bucket) seriesReduction += bucket.value;
          }
          break;
        }
        case "drop_label": {
          // Dropping a label collapses series that share all other labels.
          // Reduction ≈ affectedSeries × (1 − 1/valueCount).
          // Fall back to TSDB labelValueCountByLabelName when live data is missing.
          const affected = sim.labelAffectedSeries ?? totalSeries;
          const values =
            sim.labelValueCount ??
            labels.find((x) => x.name === sim.target)?.value ??
            0;
          if (values > 1 && affected > 0) {
            seriesReduction += Math.round(affected * (1 - 1 / values));
          }
          break;
        }
        case "increase_interval": {
          // Doesn't reduce series count — only sample rate.
          break;
        }
      }
    }
    seriesReduction = Math.min(seriesReduction, totalSeries);
    const pctReduction =
      totalSeries > 0 ? Math.round((seriesReduction / totalSeries) * 100) : 0;
    return {
      seriesReduction,
      pctReduction,
      remainingSeries: Math.max(0, totalSeries - seriesReduction),
      pendingCount,
    };
  }, [simulations, metrics, labels, totalSeries]);

  if (!connection.isConnected) return <Navigate to="/" replace />;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <PlayCircle className="h-6 w-6" />
            "What If" Simulation
          </h1>
          <p className="text-muted-foreground text-sm">
            Stack multiple simulations to estimate cumulative impact.
          </p>
        </div>
        <PageHelp {...simulateHelp} />
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
              <Popover open={comboOpen} onOpenChange={setComboOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={comboOpen}
                    className="w-full justify-between font-mono text-sm h-10"
                  >
                    {target || (action === "drop_label" ? "Select label…" : "Select metric…")}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                  <Command>
                    <CommandInput placeholder={action === "drop_label" ? "Search labels…" : "Search metrics…"} />
                    <CommandList>
                      <CommandEmpty>No matches found.</CommandEmpty>
                      <CommandGroup>
                        <ScrollArea className="max-h-[200px]">
                          {suggestions.map((name) => (
                            <CommandItem
                              key={name}
                              value={name}
                              onSelect={(v) => {
                                setTarget(v);
                                setComboOpen(false);
                              }}
                              className="font-mono text-xs"
                            >
                              {name}
                            </CommandItem>
                          ))}
                        </ScrollArea>
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
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
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                    <Trash2 className="h-3.5 w-3.5 mr-1" /> Clear All
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Clear all simulations?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will remove all {simulations.length} simulation(s). This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={clearAll}>Clear All</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardHeader>
            <CardContent className="space-y-2">
              {simulations.map((sim) => {
                const detail =
                  sim.action === "drop_label"
                    ? sim.labelAffectedSeries != null && sim.labelValueCount != null
                      ? `${sim.labelAffectedSeries.toLocaleString()} series · ${sim.labelValueCount.toLocaleString()} values`
                      : null
                    : sim.seriesCount != null
                    ? `${sim.seriesCount.toLocaleString()} series`
                    : null;
                return (
                  <div key={sim.id} className="flex items-center justify-between p-3 rounded-md border border-border text-sm">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs uppercase text-muted-foreground font-medium">
                        {sim.action.replace("_", " ")}
                      </span>
                      <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                      <span className="font-mono truncate">{sim.target}</span>
                      {sim.loading ? (
                        <span className="text-xs text-muted-foreground italic ml-2">measuring…</span>
                      ) : detail ? (
                        <span className="text-xs text-muted-foreground ml-2">({detail})</span>
                      ) : null}
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeSimulation(sim.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Estimated Impact</CardTitle>
              <CardDescription>
                Live counts queried from Prometheus per simulation. Stacked drops are summed and capped at total head series — overlap between simulations isn't deducted, so treat the result as a directional upper bound.
                {impact.pendingCount > 0 && (
                  <span className="text-severity-warning"> · {impact.pendingCount} pending…</span>
                )}
              </CardDescription>
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
