import { useState, useEffect, useCallback } from "react";
import type { AlphaSnapshot, ValidationResult } from "@/types/alphaSnapshot";
import { validateSnapshot } from "@/lib/validateSnapshot";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  TrendingDown,
  Minus,
  Eye,
  Clock,
  Server,
  AlertTriangle,
  XCircle,
  CheckCircle2,
  Loader2,
} from "lucide-react";

const SNAPSHOT_OPTIONS = [
  { label: "✅ Valid Mock Snapshot", value: "data/mock-alpha-snapshot.json" },
  { label: "❌ Missing Provenance Fields", value: "data/fixtures/missing-provenance.json" },
  { label: "❌ Invalid Score (999)", value: "data/fixtures/invalid-score-range.json" },
  { label: "❌ Invalid Provider Status", value: "data/fixtures/invalid-provider-status.json" },
  { label: "⚠️ Stale Snapshot (>24h)", value: "data/fixtures/stale-snapshot.json" },
  { label: "❌ Confidence Out of Range", value: "data/fixtures/invalid-confidence.json" },
];

const REGIME_COLORS: Record<string, string> = {
  flight_to_safety: "bg-blue-500",
  risk_on: "bg-green-500",
  inflation_hedge: "bg-orange-500",
  barbell_core: "bg-purple-500",
  uncategorized: "bg-gray-500",
};

const CLASSIFICATION_COLORS: Record<string, string> = {
  long_bias: "text-green-400",
  short_bias: "text-red-400",
  neutral: "text-yellow-400",
  watch: "text-blue-400",
};

const SIGNAL_COLORS: Record<string, string> = {
  constructive: "bg-green-600",
  cautious: "bg-yellow-600",
  defensive: "bg-red-600",
  unclear: "bg-gray-600",
};

export default function App() {
  const [snapshot, setSnapshot] = useState<AlphaSnapshot | null>(null);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [selectedFixture, setSelectedFixture] = useState("data/mock-alpha-snapshot.json");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timestamp, setTimestamp] = useState<string>("");

  const loadSnapshot = useCallback(async (path: string) => {
    setLoading(true);
    setError(null);
    setTimestamp(new Date().toISOString());
    try {
      const res = await fetch(path);
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      const data = (await res.json()) as AlphaSnapshot;
      const v = validateSnapshot(data);
      setSnapshot(data);
      setValidation(v);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error loading snapshot");
      setSnapshot(null);
      setValidation(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSnapshot(selectedFixture);
  }, [selectedFixture, loadSnapshot]);

  const isBlocked = !validation?.valid || validation.errors.length > 0;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="w-6 h-6 text-emerald-400" />
            <div>
              <h1 className="text-lg font-bold tracking-tight">
                SFA Barbell Alpha Dashboard
              </h1>
              <p className="text-xs text-slate-400">v5.1 — Contract Lock + Deployment Proof</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="text-xs border-slate-700 text-slate-400">
              <Clock className="w-3 h-3 mr-1" />
              {timestamp ? new Date(timestamp).toLocaleTimeString() : "--"}
            </Badge>
            {!loading && (
              <Badge
                className={`text-xs ${isBlocked ? "bg-red-600" : validation?.stale ? "bg-yellow-600" : "bg-emerald-600"}`}
              >
                {isBlocked ? (
                  <ShieldAlert className="w-3 h-3 mr-1" />
                ) : validation?.stale ? (
                  <AlertTriangle className="w-3 h-3 mr-1" />
                ) : (
                  <ShieldCheck className="w-3 h-3 mr-1" />
                )}
                {isBlocked ? "SNAPSHOT INVALID" : validation?.stale ? "STALE" : "HEALTHY"}
              </Badge>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Fixture Selector */}
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="pt-4 pb-4">
            <label className="text-sm font-medium text-slate-300 mb-2 block">
              Load Snapshot Fixture (for testing fail-closed behavior)
            </label>
            <Select value={selectedFixture} onValueChange={setSelectedFixture}>
              <SelectTrigger className="w-full bg-slate-800 border-slate-700 text-slate-100">
                <SelectValue placeholder="Select a snapshot fixture..." />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                {SNAPSHOT_OPTIONS.map((opt) => (
                  <SelectItem
                    key={opt.value}
                    value={opt.value}
                    className="text-slate-100 focus:bg-slate-700 focus:text-white"
                  >
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-400 mr-3" />
            <span className="text-slate-400">Loading and validating snapshot...</span>
          </div>
        )}

        {/* Fetch Error */}
        {!loading && error && (
          <Alert className="bg-red-900/30 border-red-700 text-red-200">
            <XCircle className="w-5 h-5 text-red-400" />
            <AlertTitle>Failed to Load Snapshot</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Validation Errors */}
        {!loading && validation && validation.errors.length > 0 && (
          <Alert className="bg-red-900/30 border-red-700 text-red-200">
            <ShieldAlert className="w-5 h-5 text-red-400" />
            <AlertTitle>Snapshot Invalid — Dashboard in Fail-Closed Mode</AlertTitle>
            <AlertDescription className="mt-2 space-y-1">
              {validation.errors.map((e, i) => (
                <div key={i} className="text-sm flex items-start gap-2">
                  <XCircle className="w-4 h-4 mt-0.5 shrink-0 text-red-400" />
                  <span>
                    <code className="bg-red-950 px-1 rounded text-xs">{e.path || "root"}</code>: {e.message}
                  </span>
                </div>
              ))}
            </AlertDescription>
          </Alert>
        )}

        {/* Validation Warnings */}
        {!loading && validation && validation.warnings.length > 0 && (
          <Alert className="bg-yellow-900/20 border-yellow-700/50 text-yellow-200">
            <AlertTriangle className="w-5 h-5 text-yellow-400" />
            <AlertTitle>Warnings ({validation.warnings.length})</AlertTitle>
            <AlertDescription className="mt-2 space-y-1">
              {validation.warnings.map((w, i) => (
                <div key={i} className="text-sm flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-yellow-400" />
                  <span>
                    <code className="bg-yellow-950 px-1 rounded text-xs">{w.path || "root"}</code>: {w.message}
                  </span>
                </div>
              ))}
            </AlertDescription>
          </Alert>
        )}

        {/* Valid State */}
        {!loading && snapshot && validation?.valid && (
          <>
            {/* Provenance */}
            <Card className="bg-slate-900 border-slate-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-slate-400 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  Provenance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <div className="text-xs text-slate-500">Schema</div>
                    <div className="font-mono text-emerald-400">{snapshot.provenance.schemaVersion}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">Generated</div>
                    <div className="font-mono">{new Date(snapshot.provenance.generatedAt).toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">Source</div>
                    <div className="font-mono">{snapshot.provenance.source}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">Commit</div>
                    <div className="font-mono text-xs">{snapshot.provenance.generatorCommit || "N/A"}</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Composite Signal */}
            <Card className="bg-slate-900 border-slate-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-slate-400">
                  Composite Signal
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4 mb-3">
                  <Badge className={`text-sm px-4 py-2 ${SIGNAL_COLORS[snapshot.composite.signal] || "bg-gray-600"}`}>
                    {snapshot.composite.signal.toUpperCase()}
                  </Badge>
                  <div className="flex-1">
                    <div className="flex justify-between text-xs text-slate-400 mb-1">
                      <span>Confidence</span>
                      <span>{Math.round(snapshot.composite.confidence * 100)}%</span>
                    </div>
                    <Progress value={snapshot.composite.confidence * 100} className="h-2" />
                  </div>
                </div>
                <div className="space-y-1">
                  {snapshot.composite.contributingFactors.map((f, i) => (
                    <div key={i} className="text-sm text-slate-300 flex items-center gap-2">
                      <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                      {f}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Regime */}
            <Card className="bg-slate-900 border-slate-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-slate-400">
                  Market Regime
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3 mb-3">
                  <div className={`w-3 h-3 rounded-full ${REGIME_COLORS[snapshot.regime.currentRegime] || "bg-gray-500"}`} />
                  <span className="font-semibold capitalize">{snapshot.regime.currentRegime.replace(/_/g, " ")}</span>
                  <span className="text-slate-500 text-sm">← {snapshot.regime.priorRegime.replace(/_/g, " ")}</span>
                </div>
                <p className="text-sm text-slate-300 mb-2">{snapshot.regime.description}</p>
                <div className="flex gap-4 text-xs text-slate-400">
                  <span>Transition confidence: {Math.round(snapshot.regime.transitionConfidence * 100)}%</span>
                  <span>Since: {new Date(snapshot.regime.regimeDate).toLocaleDateString()}</span>
                </div>
              </CardContent>
            </Card>

            {/* Providers */}
            <Card className="bg-slate-900 border-slate-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-slate-400 flex items-center gap-2">
                  <Server className="w-4 h-4" />
                  Provider Status
                  {validation.staleProviders.length > 0 && (
                    <Badge variant="outline" className="border-yellow-600 text-yellow-400 text-xs">
                      {validation.staleProviders.length} stale
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {snapshot.providers.map((p, i) => (
                    <div
                      key={i}
                      className={`p-3 rounded-lg border ${p.status === "active" ? "border-emerald-800 bg-emerald-900/20" : "border-yellow-800 bg-yellow-900/20"}`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <div className={`w-2 h-2 rounded-full ${p.status === "active" ? "bg-emerald-400" : "bg-yellow-400"}`} />
                        <span className="text-sm font-medium">{p.name}</span>
                      </div>
                      <div className="text-xs text-slate-400">
                        {p.latencyMs ? `${p.latencyMs}ms` : ""} {" "}
                        <span className={p.status === "active" ? "text-emerald-400" : "text-yellow-400"}>
                          {p.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Assets */}
            <Card className="bg-slate-900 border-slate-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-slate-400 flex items-center gap-2">
                  <Eye className="w-4 h-4" />
                  Asset Scores
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {snapshot.assets.map((asset, i) => (
                    <div key={i} className="p-3 rounded-lg border border-slate-800 bg-slate-800/50">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-lg">{asset.symbol}</span>
                          <span className="text-sm text-slate-400">{asset.name}</span>
                          <Badge
                            variant="outline"
                            className={`text-xs border-slate-700 ${CLASSIFICATION_COLORS[asset.classification] || "text-slate-400"}`}
                          >
                            {asset.classification.replace(/_/g, " ")}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-1">
                          {asset.score > 0 ? (
                            <TrendingUp className="w-4 h-4 text-green-400" />
                          ) : asset.score < 0 ? (
                            <TrendingDown className="w-4 h-4 text-red-400" />
                          ) : (
                            <Minus className="w-4 h-4 text-yellow-400" />
                          )}
                          <span
                            className={`font-mono font-bold ${asset.score > 0 ? "text-green-400" : asset.score < 0 ? "text-red-400" : "text-yellow-400"}`}
                          >
                            {asset.score > 0 ? "+" : ""}
                            {asset.score}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="flex-1">
                          <div className="flex justify-between text-xs text-slate-400 mb-1">
                            <span>Score</span>
                            <span>{asset.score}/100</span>
                          </div>
                          <Progress
                            value={((asset.score + 100) / 200) * 100}
                            className="h-1.5"
                          />
                        </div>
                        <div className="w-24">
                          <div className="flex justify-between text-xs text-slate-400 mb-1">
                            <span>Conf</span>
                            <span>{Math.round(asset.confidence * 100)}%</span>
                          </div>
                          <Progress value={asset.confidence * 100} className="h-1.5" />
                        </div>
                      </div>
                      <div className="mt-2 flex gap-2">
                        {Object.entries(asset.providerContributions).map(([provider, weight]) => (
                          <span key={provider} className="text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded">
                            {provider}: {Math.round(weight * 100)}%
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Stale Providers Warning */}
            {validation.staleProviders.length > 0 && (
              <Alert className="bg-yellow-900/20 border-yellow-700/50 text-yellow-200">
                <AlertTriangle className="w-5 h-5 text-yellow-400" />
                <AlertTitle>Stale Providers Detected</AlertTitle>
                <AlertDescription>
                  The following providers have not updated within the stale threshold: {" "}
                  <strong>{validation.staleProviders.join(", ")}</strong>.
                  Confidence in composite signal may be reduced.
                </AlertDescription>
              </Alert>
            )}
          </>
        )}

        {/* Footer */}
        <footer className="text-center text-xs text-slate-600 pt-6 pb-4">
          <p>SFA Barbell Alpha Dashboard v5.1 — Manual Research & Governance Only</p>
          <p className="mt-1">
            No execution / No wallet / No trading / telemetry_and_simulation_only_no_execution
          </p>
          <p className="mt-1">Open Brain integration is NOT part of v5.1</p>
        </footer>
      </main>
    </div>
  );
}
