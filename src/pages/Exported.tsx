import { Navigate, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { useAppContext } from "@/lib/store";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Cloud, AlertTriangle, Loader2, Play, ArrowRight, Download } from "lucide-react";
import { PageHelp, exportedHelp } from "@/components/PageHelp";
import { queryInstant, getFlags } from "@/lib/prometheus";
import {
  parseExportMatchBlock,
  ruleToSelector,
  unionExpression,
  saveExportConfig,
  estimateMonthlyCost,
  formatUSD,
  flagValueToRuleText,
  type ExportRule,
  type ExportSettings,
} from "@/lib/exportMatch";

interface RuleResult {
  rule: ExportRule;
  count: number;
  topMetrics: Array<{ name: string; count: number }>;
  error?: string;
}

interface AnalysisResult {
  perRule: RuleResult[];
  exportedTotal: number;
  ranAt: number;
}

export default function Exported() {
  const { connection, setConnection } = useAppContext();
  const navigate = useNavigate();

  const [rawText, setRawText] = useState(connection.exportRulesRaw);
  const [settings, setSettings] = useState<ExportSettings>(connection.exportSettings);
  const [running, setRunning] = useState(false);
  const [fetchingFlags, setFetchingFlags] = useState(false);
  const [flagsMessage, setFlagsMessage] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);

  const totalSeries = connection.tsdbStatus?.headStats?.numSeries ?? 0;

  const parsed = useMemo(() => parseExportMatchBlock(rawText), [rawText]);

  // Persist + sync to context whenever rules / settings change.
  useEffect(() => {
    if (!connection.config) return;
    saveExportConfig(connection.config.baseUrl, { rawText, settings });
    setConnection({
      ...connection,
      exportRules: parsed.rules,
      exportRulesRaw: rawText,
      exportSettings: settings,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawText, settings, parsed.rules.length]);

  if (!connection.isConnected) return <Navigate to="/" replace />;

  const runAnalysis = async () => {
    if (!connection.config || parsed.rules.length === 0) return;
    setRunning(true);
    try {
      const cfg = connection.config;
      const perRule: RuleResult[] = await Promise.all(
        parsed.rules.map(async (rule) => {
          const sel = ruleToSelector(rule);
          try {
            const [countRes, topRes] = await Promise.all([
              queryInstant(cfg, `count(${sel})`),
              queryInstant(cfg, `topk(10, count by (__name__) (${sel}))`),
            ]);
            const count = Number(countRes?.result?.[0]?.value?.[1]) || 0;
            const top = (topRes?.result ?? [])
              .map((r: any) => ({
                name: r.metric?.__name__ ?? "(unknown)",
                count: Number(r.value?.[1]) || 0,
              }))
              .sort((a: any, b: any) => b.count - a.count);
            return { rule, count, topMetrics: top };
          } catch (e: any) {
            return { rule, count: 0, topMetrics: [], error: e?.message || "query failed" };
          }
        })
      );

      // Union total — deduplicates series across rules via PromQL `or` semantics.
      let exportedTotal = 0;
      try {
        const unionRes = await queryInstant(cfg, `count(${unionExpression(parsed.rules)})`);
        exportedTotal = Number(unionRes?.result?.[0]?.value?.[1]) || 0;
      } catch {
        // fall back to sum (will overcount overlap)
        exportedTotal = perRule.reduce((s, r) => s + r.count, 0);
      }

      setAnalysis({ perRule, exportedTotal, ranAt: Date.now() });
    } finally {
      setRunning(false);
    }
  };

  const pctExported =
    totalSeries > 0 && analysis ? (analysis.exportedTotal / totalSeries) * 100 : 0;
  const monthlyCost = analysis ? estimateMonthlyCost(analysis.exportedTotal, settings) : 0;

  const updateSetting = (k: keyof ExportSettings, v: number) => {
    if (!Number.isFinite(v) || v < 0) return;
    setSettings((s) => ({ ...s, [k]: v }));
  };

  const goSimulateMetric = (name: string) => {
    navigate(`/simulate?action=drop_metric&target=${encodeURIComponent(name)}`);
  };

  const fetchFromFlags = async () => {
    if (!connection.config) return;
    setFetchingFlags(true);
    setFlagsMessage(null);
    try {
      const flags = await getFlags(connection.config);
      const flagVal = flags?.["export.match"];
      if (!flagVal) {
        setFlagsMessage("No export.match flag found at /api/v1/status/flags.");
        return;
      }
      const generated = flagValueToRuleText(flagVal);
      if (!generated) {
        setFlagsMessage("Found export.match but couldn't parse any rules from it.");
        return;
      }
      setRawText(generated);
      setFlagsMessage(`Loaded ${generated.split("\n").length} rule(s) from /flags.`);
    } catch (e: any) {
      setFlagsMessage(`Failed to fetch /flags: ${e?.message || "unknown error"}`);
    } finally {
      setFetchingFlags(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Cloud className="h-6 w-6" />
            Exported Metrics (GMP)
          </h1>
          <p className="text-muted-foreground text-sm">
            Auto-loaded from <code className="text-xs bg-muted px-1 py-0.5 rounded">/api/v1/status/flags</code> on connect.
            Edit or paste <code className="text-xs bg-muted px-1 py-0.5 rounded">--export.match</code> rules below to override.
          </p>
        </div>
        <PageHelp {...exportedHelp} />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-2">
          <div>
            <CardTitle className="text-lg">Export Rules</CardTitle>
            <CardDescription>
              One rule per line. Matched with OR — a series is exported if it matches any rule.
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={fetchFromFlags} disabled={fetchingFlags}>
            {fetchingFlags ? (
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5 mr-1.5" />
            )}
            Fetch from /flags
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            placeholder={`- --export.match={__name__=~"kube_pod.*"}\n- --export.match={__name__=~".*cpu.*"}\n- --export.match={project_id=~"pr-inf-telemetry"}`}
            rows={8}
            className="font-mono text-xs"
          />
          {flagsMessage && (
            <p className="text-xs text-muted-foreground">{flagsMessage}</p>
          )}
          <div className="flex flex-wrap gap-2">
            {parsed.rules.map((r, i) => (
              <Badge key={i} variant="outline" className="font-mono text-xs">
                {ruleToSelector(r)}
              </Badge>
            ))}
          </div>
          {parsed.errors.length > 0 && (
            <div className="space-y-1 text-xs text-severity-warning">
              {parsed.errors.map((e, i) => (
                <div key={i} className="flex items-start gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  <span>
                    Line {e.line}: {e.message} —{" "}
                    <code className="font-mono">{e.raw.trim()}</code>
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Cost Settings</CardTitle>
          <CardDescription>
            GMP charges per million samples ingested. Override defaults to match your contract.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label className="text-xs">$ per million samples</Label>
              <Input
                type="number"
                step="0.01"
                value={settings.pricePerMillionSamples}
                onChange={(e) => updateSetting("pricePerMillionSamples", parseFloat(e.target.value))}
                className="font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Scrape interval (sec)</Label>
              <Input
                type="number"
                step="1"
                value={settings.scrapeIntervalSec}
                onChange={(e) => updateSetting("scrapeIntervalSec", parseFloat(e.target.value))}
                className="font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Samples / series multiplier</Label>
              <Input
                type="number"
                step="0.1"
                value={settings.samplesPerSeriesMultiplier}
                onChange={(e) =>
                  updateSetting("samplesPerSeriesMultiplier", parseFloat(e.target.value))
                }
                className="font-mono"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <Button onClick={runAnalysis} disabled={running || parsed.rules.length === 0}>
          {running ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Play className="h-4 w-4 mr-2" />
          )}
          {running ? "Running…" : "Run analysis"}
        </Button>
        {parsed.rules.length === 0 && (
          <span className="text-xs text-muted-foreground">Add at least one rule above.</span>
        )}
        {analysis && !running && (
          <span className="text-xs text-muted-foreground">
            Last run {new Date(analysis.ranAt).toLocaleTimeString()}
          </span>
        )}
      </div>

      {analysis && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Exported Footprint</CardTitle>
              <CardDescription>
                Estimated GMP ingestion cost based on current rules and settings.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <Stat label="Total Series" value={totalSeries.toLocaleString()} />
                <Stat
                  label="Exported Series"
                  value={analysis.exportedTotal.toLocaleString()}
                  accent="text-primary"
                />
                <Stat
                  label="% Exported"
                  value={`${pctExported.toFixed(1)}%`}
                  accent={
                    pctExported > 75
                      ? "text-severity-critical"
                      : pctExported > 40
                      ? "text-severity-warning"
                      : "text-severity-healthy"
                  }
                />
                <Stat
                  label="Est. $ / month"
                  value={formatUSD(monthlyCost)}
                  accent="text-severity-warning"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Per-Rule Breakdown</CardTitle>
              <CardDescription>
                Series counts may overlap across rules — the exported total above deduplicates them.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {analysis.perRule.map((r, i) => {
                const rulePct =
                  totalSeries > 0 ? ((r.count / totalSeries) * 100).toFixed(2) : "0";
                return (
                  <div key={i} className="border border-border rounded-md p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <code className="font-mono text-xs truncate">{ruleToSelector(r.rule)}</code>
                      <div className="flex items-center gap-3 text-xs">
                        <span className="text-muted-foreground">{rulePct}% of total</span>
                        <Badge variant="outline" className="font-mono">
                          {r.count.toLocaleString()} series
                        </Badge>
                      </div>
                    </div>
                    {r.error ? (
                      <p className="text-xs text-severity-critical">{r.error}</p>
                    ) : r.topMetrics.length > 0 ? (
                      <div className="space-y-1">
                        {r.topMetrics.map((m) => (
                          <button
                            key={m.name}
                            onClick={() => goSimulateMetric(m.name)}
                            className="w-full flex items-center justify-between text-xs px-2 py-1 rounded hover:bg-accent/50 transition-colors group"
                          >
                            <span className="font-mono truncate">{m.name}</span>
                            <span className="flex items-center gap-2 shrink-0">
                              <span className="text-muted-foreground">
                                {m.count.toLocaleString()}
                              </span>
                              <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground italic">No matching series.</p>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div>
      <span className="text-xs text-muted-foreground uppercase">{label}</span>
      <p className={`text-3xl font-bold font-mono ${accent ?? ""}`}>{value}</p>
    </div>
  );
}
