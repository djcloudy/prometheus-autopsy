import { HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";

interface HelpSection {
  title: string;
  content: string;
}

interface PageHelpProps {
  title: string;
  description: string;
  sections: HelpSection[];
}

export function PageHelp({ title, description, sections }: PageHelpProps) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground">
          <HelpCircle className="h-4 w-4" />
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[400px] sm:w-[540px]">
        <SheetHeader>
          <SheetTitle className="text-lg">{title}</SheetTitle>
        </SheetHeader>
        <ScrollArea className="h-[calc(100vh-80px)] pr-4 mt-4">
          <p className="text-sm text-muted-foreground mb-6">{description}</p>
          <div className="space-y-6">
            {sections.map((s, i) => (
              <div key={i}>
                <h3 className="text-sm font-semibold mb-1.5">{s.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">{s.content}</p>
              </div>
            ))}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

// ---- Per-page help content ----

export const connectHelp = {
  title: "Connect — Help",
  description: "This is your starting point. You'll connect to a running Prometheus instance so the tool can pull its internal data and analyze it.",
  sections: [
    {
      title: "Prometheus URL",
      content: "Enter the base URL of your Prometheus server (e.g. http://localhost:9090). This is the same URL you'd open in a browser to see the Prometheus web UI.\n\nIf your Prometheus is behind a reverse proxy or requires authentication, fill in the optional username and password fields.",
    },
    {
      title: "What happens when you connect?",
      content: "The tool makes three API calls to your Prometheus instance:\n\n• TSDB Status — fetches internal statistics about how many time series, labels, and label-value pairs exist. This is the foundation for cardinality analysis.\n• Targets — retrieves the list of scrape targets (the things Prometheus is monitoring) and their health status.\n• Config — pulls the running Prometheus configuration.\n\nThe three status dots (TSDB, Targets, Config) show which endpoints responded successfully.",
    },
    {
      title: "Recent Connections",
      content: "Previously used URLs are saved in your browser's local storage for quick reconnection. Click any saved connection to reconnect instantly, or use the trash icon to remove it.",
    },
    {
      title: "CORS Issues",
      content: "If you're running this tool from a different domain than your Prometheus server, you may hit CORS (Cross-Origin Resource Sharing) errors. You'll need to configure your Prometheus or reverse proxy to allow cross-origin requests, or run both on the same host.",
    },
  ],
};

export const overviewHelp = {
  title: "Overview — Help",
  description: "A bird's-eye view of your Prometheus instance's health. Think of this as the 'vital signs' dashboard.",
  sections: [
    {
      title: "Total Series",
      content: "The total number of active time series in Prometheus's head block (in-memory). This is the single most important number for understanding resource usage.\n\n• Under 500K — typically healthy\n• 500K–1M — moderate; keep an eye on it\n• Over 1M — high; you may experience memory pressure and slow queries\n\nIn plain terms: each unique combination of a metric name + its label values creates one series. More series = more RAM and CPU.",
    },
    {
      title: "Active Targets",
      content: "Shows how many scrape targets are healthy ('up') vs total. If these numbers don't match, some targets are failing to respond, which could indicate network issues, crashed services, or misconfigured endpoints.\n\nFor example, '45 / 50' means 5 targets are currently down.",
    },
    {
      title: "Label Pairs",
      content: "The total number of unique label name + value combinations stored. A sudden spike here often correlates with a cardinality explosion — some label is taking on too many unique values (like user IDs or request paths).",
    },
    {
      title: "Scrape Intervals",
      content: "Lists the distinct scrape intervals configured across all targets. Ideally you'll see consistent intervals (e.g. just '30s'). Mixed intervals (e.g. '10s, 15s, 30s, 60s') may indicate inconsistent configuration.",
    },
    {
      title: "Top Metrics by Series Count",
      content: "The 15 most 'expensive' metrics ranked by how many time series they create. These are your biggest contributors to cardinality.\n\nColor coding:\n• Red — over 10,000 series (critical)\n• Amber — over 5,000 series (moderate)\n• Green — under 5,000 series (healthy)\n\nTip: If a metric ending in '_bucket' appears high on this list, check the Histograms page — you may be able to drop bucket series and save significant resources.",
    },
    {
      title: "Top Labels by Value Count",
      content: "Shows which label names have the most unique values. Labels like 'instance' or 'job' typically have few values and are fine. Labels like 'request_id' or 'user_id' with thousands of values are red flags — they multiply every metric they touch.",
    },
  ],
};

export const cardinalityHelp = {
  title: "Cardinality Analysis — Help",
  description: "Cardinality is the #1 cost driver in Prometheus. This page helps you find which metrics and labels are creating the most time series.",
  sections: [
    {
      title: "What is cardinality?",
      content: "Cardinality = the number of unique time series. Every unique combination of metric name + label key-value pairs creates a new series. For example, if you have a metric 'http_requests_total' with labels {method, status, path}, and 'path' has 10,000 unique values, you could end up with tens of thousands of series from just one metric.\n\nHigh cardinality causes:\n• Increased memory usage (RAM)\n• Slower queries\n• Longer compaction times\n• Higher storage costs",
    },
    {
      title: "Metric Family Impact (Treemap)",
      content: "The colored blocks show the relative 'size' of each metric family. Bigger blocks = more series. The color indicates severity:\n\n• Red — critical (over 10K series)\n• Amber — moderate (over 5K)\n• Blue — informational (over 1K)\n• Green — healthy\n\nHover over any block to see the exact series count. This visualization makes it easy to spot the 'elephant in the room' at a glance.",
    },
    {
      title: "Multiplier Tree",
      content: "This is a unique diagnostic tool. It shows how labels 'multiply' series for each metric. For instance, if metric X has labels A (10 values) × B (5 values) × C (2 values), you get up to 100 series.\n\nUse this to identify which specific label is causing the explosion. Often, removing or aggregating just one high-cardinality label can dramatically reduce your series count.",
    },
    {
      title: "Top Metrics by Series Count",
      content: "A ranked list of metrics with severity badges. Focus on anything marked 'Critical' or 'High' first — these are your biggest wins.\n\nFor each metric, consider:\n• Is this metric actually being used in dashboards or alerts?\n• Can high-cardinality labels be dropped via relabeling?\n• Is it a histogram that could be simplified?",
    },
    {
      title: "Top Labels & Label-Value Pairs",
      content: "These tables help you identify exactly which labels and specific label=value combinations contribute the most series. For example, if you see 'pod' with 5,000 values, that label is multiplying every metric it appears on by up to 5,000×.",
    },
    {
      title: "What to do about it",
      content: "1. Go to the Simulate page to model the impact of dropping a metric or label\n2. Use metric_relabel_configs in your Prometheus config to drop or aggregate\n3. Check the Recommendations page for automated suggestions with copy-paste YAML configs",
    },
  ],
};

export const churnHelp = {
  title: "Churn & Memory Pressure — Help",
  description: "Cardinality tells you how many series exist. Churn tells you how fast they're being created and destroyed — which is what actually causes memory spikes and OOM kills.",
  sections: [
    {
      title: "Why churn matters",
      content: "When containers restart, pods reschedule, or deployments roll out, old series get abandoned and new ones are created. Prometheus keeps these in the 'head block' (RAM) for ~2 hours.\n\nHigh churn means Prometheus is constantly allocating memory for new series while waiting for old ones to be garbage collected. This is the #1 cause of memory spikes and OOM restarts.\n\nEven if your total series count looks 'fine', high churn can cause problems because the head block temporarily holds both old AND new series.",
    },
    {
      title: "Head Series & Head Chunks",
      content: "• Head Series — total active series in memory. This should roughly match the 'Total Series' on the Overview page.\n• Head Chunks — memory chunks backing those series. A high chunks-to-series ratio suggests many samples per series or retention issues.\n• Chunk Creation Rate — how fast new chunks are being created. Spikes here correlate with write pressure.",
    },
    {
      title: "Series Churn Rates",
      content: "These are the most critical numbers on this page:\n\n• Created / sec — how many new series are being created per second\n• Removed / sec — how many series are being garbage collected per second\n• Net Churn / sec — created minus removed. Positive = your head block is growing. Negative = GC is keeping up.\n\nSeverity:\n• Net churn > 10/sec — Critical: your memory usage will climb steadily\n• Net churn 1–10/sec — Moderate: worth investigating\n• Net churn < 1/sec — Healthy: system is stable",
    },
    {
      title: "Top Churny Targets — scrape_series_added",
      content: "This table shows which scrape targets are adding the most new series. High values here mean that target is producing a constant stream of new, never-before-seen label combinations.\n\nCommon culprits:\n• Kubernetes pod metrics (pod names change on restart)\n• Application metrics with request IDs or session IDs in labels\n• Dynamic service discovery with frequent changes\n\nClick 'Simulate' to model the impact of dropping that target's metrics.",
    },
    {
      title: "Top Targets — scrape_samples_post_metric_relabeling",
      content: "Shows the actual number of samples being ingested per target after any relabeling rules are applied. This tells you which targets are the heaviest producers.\n\nIf a target shows high values here but NOT in scrape_series_added, it's producing lots of samples for stable series (which is normal). If it's high in both, that's a churn problem.",
    },
    {
      title: "Drill into Cardinality",
      content: "Use the link at the bottom to jump to the Multiplier Tree on the Cardinality page. This lets you trace exactly which labels on a churny metric are causing the explosion, so you can write targeted relabeling rules.",
    },
  ],
};

export const histogramsHelp = {
  title: "Histogram Abuse Detection — Help",
  description: "Histograms are one of the most powerful Prometheus metric types — but they're also the most expensive. Each histogram can create dozens of time series. This page helps you find the costly ones.",
  sections: [
    {
      title: "How histograms work",
      content: "A Prometheus histogram metric (e.g. http_request_duration_seconds) actually creates three sets of series:\n\n• _bucket — one series per bucket boundary (e.g. le='0.1', le='0.5', le='1'). Default is 11 buckets, but some libraries use 20+.\n• _sum — total sum of observed values (1 series)\n• _count — total number of observations (1 series)\n\nSo a single histogram with default buckets and 100 label combinations creates 100 × 13 = 1,300 series. With custom buckets (say 25), that's 100 × 27 = 2,700 series.",
    },
    {
      title: "Risk Score",
      content: "Each histogram gets a risk score from 0–100 based on the number of bucket series and estimated bucket count. Higher scores mean more potential for savings.\n\n• Red (>70) — Critical: this histogram is a major cost driver\n• Amber (40–70) — Moderate: worth reviewing\n• Green (<40) — Low risk",
    },
    {
      title: "Bucket Series",
      content: "The total number of _bucket series for this histogram. This is the 'cost' of keeping full histogram resolution. If this number is high, you're paying a lot for percentile accuracy.",
    },
    {
      title: "Estimated Buckets",
      content: "How many bucket boundaries (le values) this histogram uses per label combination. The default is ~11. If you see 20+ buckets, someone configured custom boundaries — do you actually need that much resolution?",
    },
    {
      title: "Savings if Dropped",
      content: "The percentage of series you'd save by dropping _bucket series and keeping only _sum and _count. This lets you still calculate rates and averages, but you lose percentile queries (p50, p99, etc.).\n\nIf you don't use percentile queries for this metric, dropping buckets is a safe and dramatic optimization.",
    },
    {
      title: "Drop Relabeling Config",
      content: "A ready-to-use metric_relabel_configs YAML snippet that drops the _bucket series. Copy this into your Prometheus configuration or your scrape job config to apply the change.\n\nBefore applying, verify:\n1. Are p50/p90/p99 dashboards using this histogram? If yes, you'll lose those panels.\n2. Can you switch to a summary metric instead?\n3. Test in a staging environment first.",
    },
  ],
};

export const labelsHelp = {
  title: "Label Churn & Explosion — Help",
  description: "Labels are the dimensions of your metrics. Great labels help you filter and aggregate. Bad labels explode your series count. This page identifies problematic labels.",
  sections: [
    {
      title: "What makes a label 'bad'?",
      content: "A label is problematic when it has high cardinality (many unique values) or is 'dynamic' (values change frequently, like request IDs or timestamps).\n\nEvery unique label value creates a new time series. A label with 10,000 values on a metric will multiply that metric's series by up to 10,000×.\n\nCommon offenders: url, path, request_id, user_id, pod, container_id, session, trace_id, span_id.",
    },
    {
      title: "Dynamic Pattern Matches",
      content: "The tool scans label names for patterns that suggest dynamic content (url, path, id, uuid, session, etc.). Labels matching these patterns are flagged with a 'Dynamic' badge.\n\nDynamic labels are especially dangerous because they cause churn — new series are constantly created as new values appear, and old ones become stale.",
    },
    {
      title: "High Cardinality",
      content: "Labels with more than 1,000 unique values are flagged as 'High Card' (high cardinality). These are your biggest multipliers.\n\nNot all high-cardinality labels are bad — 'instance' might legitimately have 1,000 values if you have 1,000 servers. But 'request_path' with 10,000 values usually means unbounded URL patterns are leaking into labels.",
    },
    {
      title: "Churn Risk Levels",
      content: "Each label gets a risk assessment:\n\n• Critical — dynamic pattern + high cardinality. This label is almost certainly causing problems.\n• High — dynamic pattern but not yet high cardinality. It may grow over time.\n• Moderate — high cardinality but not a dynamic pattern. Review whether the values are truly bounded.\n• Low — neither dynamic nor high cardinality. Probably fine.",
    },
    {
      title: "Copy labeldrop config",
      content: "For problematic labels, click the copy button to get a metric_relabel_configs snippet that drops the label entirely. This collapses all series that differ only by that label into a single series.\n\n⚠️ Before dropping: make sure no dashboards or alerts filter by this label. Dropping a label is irreversible at ingestion time.",
    },
    {
      title: "What to do next",
      content: "1. Review labels marked 'Critical' first\n2. Check if those labels are used in any dashboard or alert queries\n3. If not needed, apply the labeldrop config to your Prometheus scrape configuration\n4. Use the Simulate page to estimate the series reduction before applying changes",
    },
  ],
};

export const scrapesHelp = {
  title: "Scrape Efficiency — Help",
  description: "Every Prometheus scrape target contributes to resource usage. This page helps you understand how targets are configured and performing.",
  sections: [
    {
      title: "What is a scrape target?",
      content: "A scrape target is an HTTP endpoint that Prometheus periodically pulls metrics from (e.g. http://myapp:8080/metrics). Each target is part of a 'job' — a group of similar targets.\n\nFor example, if you have 10 instances of a web server, they'd typically be 10 targets in one 'web-server' job.",
    },
    {
      title: "Total Targets, Jobs, Unhealthy",
      content: "• Total Targets — the total number of endpoints Prometheus is scraping\n• Jobs — how many distinct job groups exist\n• Unhealthy — targets that are currently failing (responding with errors or timing out). These need attention — they may indicate crashed services.",
    },
    {
      title: "Jobs Overview Table",
      content: "For each job, you can see:\n\n• Targets — how many instances are in this job\n• Interval — how often Prometheus scrapes them. Shorter intervals (under 15s) are flagged as 'Fast' because they increase CPU and disk usage proportionally.\n• Avg Duration — average time to complete a scrape. If this is close to your interval, scrapes may overlap, causing missed data.\n• Health — how many targets are up vs total. Anything less than 100% needs investigation.",
    },
    {
      title: "Fast Scrape Warning",
      content: "Intervals under 15 seconds are flagged because they:\n• Double (or more) your sample ingestion rate vs 30s\n• Increase CPU usage for both Prometheus and the targets\n• Rarely provide meaningful additional insight for most use cases\n\nUnless you have a specific need for sub-15s resolution (e.g. real-time trading systems), consider increasing to 30s or 60s.",
    },
    {
      title: "All Targets Table",
      content: "A detailed list of every individual target showing:\n\n• Endpoint — the full scrape URL\n• Job — which job group it belongs to\n• Interval — per-target scrape interval\n• Duration — how long the last scrape took\n• Status — 'up' (healthy) or 'down' (failing)\n\nUse this to identify individual problematic instances — slow scrapes, failed targets, or misconfigured endpoints.",
    },
  ],
};

export const simulateHelp = {
  title: "What-If Simulation — Help",
  description: "Before making changes to your Prometheus config, use this page to estimate the impact. Stack multiple actions to model a full optimization plan.",
  sections: [
    {
      title: "How it works",
      content: "You add simulated actions (like 'drop this metric' or 'drop this label') and the tool estimates how many series would be removed. The estimates are directional — they give you a rough idea of impact, not exact numbers.\n\nSimulations are saved in your browser so you can come back to them later.",
    },
    {
      title: "Actions",
      content: "• Drop Metric — removes all series for a specific metric name. Use this when a metric isn't needed at all.\n• Drop Buckets — removes _bucket series for a histogram while keeping _sum and _count. Use this when you don't need percentile queries.\n• Drop Label — removes a label, collapsing series that differ only by that label. Use this for high-cardinality labels.\n• Increase Interval — models the effect of scraping less frequently. Note: this doesn't reduce series count, but reduces sample ingestion rate and CPU usage.",
    },
    {
      title: "Target (Autocomplete)",
      content: "Start typing to search through your actual metric names or label names (depending on the action). The suggestions come from your live TSDB data.\n\nYou can also arrive here pre-filled from other pages — for example, clicking 'Simulate' on the Churn page will link directly here with the metric pre-selected.",
    },
    {
      title: "Estimated Impact",
      content: "After adding simulations, you'll see three numbers:\n\n• Series Reduction % — the estimated percentage decrease in total series\n• Series Removed — the absolute number of series that would be eliminated\n• Remaining Series — what your total series count would be after the changes\n\n⚠️ These are estimates. Actual results may vary because:\n• Label drops are estimated conservatively\n• Overlapping label combinations aren't fully modeled\n• TSDB stats may be slightly stale",
    },
    {
      title: "Stacking simulations",
      content: "You can add multiple actions to build a comprehensive optimization plan. For example:\n1. Drop an unused histogram's buckets\n2. Drop a high-cardinality label\n3. Drop a metric that nobody queries\n\nThe combined impact is calculated cumulatively, giving you a preview of your total savings before touching any config.",
    },
  ],
};

export const exportedHelp = {
  title: "Exported Metrics — Help",
  description: "Google Managed Prometheus (GMP) lets you ship a subset of your local Prometheus series to Google Cloud for long-term storage. You pay per sample ingested, so knowing which metrics are exported is critical for cost control.",
  sections: [
    {
      title: "Export rules",
      content: "Paste your --export.match flags directly from your Prometheus container args. Each line should look like:\n\n  - --export.match={__name__=~\"kube_pod.*\"}\n  - --export.match={project_id=~\"pr-inf-telemetry\"}\n\nLines without --export.match= are ignored. Comments starting with # are skipped. Quoted and unquoted values are both supported. Parse errors are shown inline and don't stop the rest of the rules from working.",
    },
    {
      title: "How matching works (OR semantics)",
      content: "GMP exports a series if it matches ANY of the rules — the same as the Prometheus flag behavior. So a series matching one or more rules is counted exactly once toward the exported total (we use PromQL `or` which deduplicates by label set).",
    },
    {
      title: "Cost settings",
      content: "GMP charges per million samples ingested. The defaults assume:\n• $0.06 per million samples (GMP public pricing — verify against your contract)\n• 30s scrape interval (override if your global interval differs)\n• 1.0 samples per series per scrape (counters/gauges = 1; histograms inflate this — bump to 1.5–3 if you ship many histograms)\n\nMonthly cost = exported_series × multiplier ÷ interval × 86400 × 30 × ($/M ÷ 1,000,000)",
    },
    {
      title: "Run analysis",
      content: "Counts are queried live against Prometheus and can be heavy with broad regexes (e.g. .*cpu.*). Click 'Run analysis' to execute, and re-run after changing rules. Results are cached in the page until you refresh or change rules.",
    },
    {
      title: "Top exported metrics",
      content: "For each rule, we show the metrics with the most matched series. Click a metric to deep-link into Simulate with 'Drop Metric' pre-filled — useful for modeling how much you'd save by stopping a metric from being exported.",
    },
    {
      title: "Tied into Simulate",
      content: "Once rules are configured, every simulation on the Simulate page also computes its delta against the exported set, plus an estimated monthly $ savings. The aggregate impact card shows the total exported reduction and combined savings.",
    },
  ],
};


  title: "Smart Recommendations — Help",
  description: "This page automatically analyzes your TSDB data and generates prioritized, actionable findings. Think of it as an automated SRE review of your Prometheus setup.",
  sections: [
    {
      title: "How findings are generated",
      content: "The tool scans your data for common anti-patterns:\n\n• Metrics with over 10,000 series (high cardinality)\n• Histogram _bucket metrics with over 5,000 series\n• Labels matching dynamic patterns (url, id, session, etc.) with many unique values\n• Scrape jobs with intervals under 15 seconds\n\nEach finding includes a severity rating, impact description, suggested fix, and often a ready-to-use YAML config snippet.",
    },
    {
      title: "Severity Levels",
      content: "• Critical — major impact on resource usage, should be addressed urgently\n• High — significant impact, plan to address soon\n• Moderate — noticeable impact, address when convenient\n• Low — minor impact, consider for optimization\n\nFindings are sorted by severity so the most impactful items appear first.",
    },
    {
      title: "Category Filters",
      content: "Use the filter buttons at the top to focus on specific categories:\n\n• Cardinality — high series count metrics\n• Histograms — expensive histogram metrics\n• Labels — dynamic or high-cardinality labels\n• Scrapes — suboptimal scrape configurations",
    },
    {
      title: "Remediation Config",
      content: "Many findings include a YAML snippet you can copy directly into your Prometheus metric_relabel_configs. Click 'Copy' to copy the snippet to your clipboard.\n\nBefore applying:\n1. Verify the metric/label isn't used in critical dashboards or alerts\n2. Test in a staging environment if possible\n3. Apply changes incrementally — one at a time — and monitor the impact\n4. Use the Simulate page to preview the estimated series reduction",
    },
    {
      title: "No findings?",
      content: "If you see 'No findings detected' — congratulations! Your Prometheus instance looks well-optimized. The tool checks against common thresholds, so very small or well-tuned instances may not trigger any findings.\n\nYou can still explore the other pages for detailed analysis.",
    },
  ],
};
