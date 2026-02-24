import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useAppContext } from "@/lib/store";
import {
  healthCheck,
  getTSDBStatus,
  getTargets,
  getConfig,
  getSavedConnections,
  saveConnection,
  removeConnection,
  type PrometheusConfig,
} from "@/lib/prometheus";
import { CheckCircle2, XCircle, Loader2, Link, Trash2, Skull } from "lucide-react";

export default function Connect() {
  const { setConnection } = useAppContext();
  const navigate = useNavigate();
  const [url, setUrl] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [health, setHealth] = useState<{ tsdb: boolean; targets: boolean; config: boolean } | null>(null);
  const saved = getSavedConnections();

  const handleConnect = async (config?: PrometheusConfig) => {
    const cfg = config || { baseUrl: url.trim(), username: username || undefined, password: password || undefined };
    if (!cfg.baseUrl) return;
    setLoading(true);
    setError(null);
    setHealth(null);

    try {
      const h = await healthCheck(cfg);
      setHealth(h);

      if (!h.tsdb && !h.targets && !h.config) {
        setError("Could not reach any Prometheus API endpoint. Check the URL and CORS settings.");
        setLoading(false);
        return;
      }

      const [tsdb, targets, promCfg] = await Promise.allSettled([
        getTSDBStatus(cfg),
        getTargets(cfg),
        getConfig(cfg),
      ]);

      saveConnection(cfg);
      setConnection({
        config: cfg,
        isConnected: true,
        tsdbStatus: tsdb.status === "fulfilled" ? tsdb.value : null,
        targets: targets.status === "fulfilled" ? targets.value : null,
        promConfig: promCfg.status === "fulfilled" ? promCfg.value.yaml : null,
      });
      navigate("/overview");
    } catch (e: any) {
      setError(e.message || "Connection failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          {/* Chalk outline body */}
          <div className="relative shrink-0">
            <svg width="56" height="56" viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg" className="opacity-60">
              <circle cx="28" cy="11" r="4" stroke="hsl(var(--muted-foreground))" strokeWidth="1.5" strokeDasharray="3 2" fill="none" />
              <path
                d="M28 15 L28 30 M20 22 L36 22 M28 30 L20 46 M28 30 L36 46"
                stroke="hsl(var(--muted-foreground))"
                strokeWidth="1.5"
                strokeDasharray="3 2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <Skull className="h-7 w-7 text-severity-critical" />
              Prometheus Autopsy
            </h1>
            <p className="text-muted-foreground mt-1">
              Forensic performance analyzer for Prometheus. Connect to your instance to begin the investigation.
            </p>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link className="h-5 w-5" />
            Connect to Prometheus
          </CardTitle>
          <CardDescription>
            Enter your Prometheus base URL. Ensure CORS is configured or access from the same network.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="url">Prometheus URL</Label>
            <Input
              id="url"
              placeholder="http://localhost:9090"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="font-mono text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username (optional)</Label>
              <Input
                id="username"
                placeholder="admin"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password (optional)</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          {health && (
            <div className="flex gap-4 text-sm">
              <StatusDot ok={health.tsdb} label="TSDB" />
              <StatusDot ok={health.targets} label="Targets" />
              <StatusDot ok={health.config} label="Config" />
            </div>
          )}

          {error && (
            <p className="text-sm text-severity-critical">{error}</p>
          )}

          <Button onClick={() => handleConnect()} disabled={loading || !url.trim()} className="w-full">
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            {loading ? "Connecting..." : "Connect & Analyze"}
          </Button>
        </CardContent>
      </Card>

      {saved.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recent Connections</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {saved.map((s) => (
              <div
                key={s.baseUrl}
                className="flex items-center justify-between p-3 rounded-md border border-border hover:bg-accent/50 transition-colors"
              >
                <button
                  onClick={() => handleConnect(s)}
                  className="font-mono text-sm text-left flex-1 hover:text-primary transition-colors"
                >
                  {s.baseUrl}
                </button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-severity-critical"
                  onClick={() => {
                    removeConnection(s.baseUrl);
                    window.location.reload();
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StatusDot({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      {ok ? (
        <CheckCircle2 className="h-4 w-4 text-severity-healthy" />
      ) : (
        <XCircle className="h-4 w-4 text-severity-critical" />
      )}
      <span className={ok ? "text-severity-healthy" : "text-severity-critical"}>{label}</span>
    </span>
  );
}
