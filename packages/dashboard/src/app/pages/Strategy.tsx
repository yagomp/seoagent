import { useEffect, useState } from "react";

interface ActionItem {
  action: string;
  reason: string;
  impact: string;
  effort: string;
}

interface StrategyData {
  strategy: {
    overallScore: number;
    quickWins: ActionItem[];
    contentPlan: { title: string; reason: string }[];
    technicalFixes: { issue: string; fix: string; severity: string }[];
    linkBuilding: { tactic: string; reason: string }[];
    drPlan: { currentDR: number; targetDR: number; actions: string[] };
    competitorInsights: string[];
  };
  generatedAt: string;
}

export function Strategy() {
  const [data, setData] = useState<StrategyData | null | undefined>(undefined);

  useEffect(() => {
    fetch("/api/strategy").then((r) => r.json()).then((d) => setData(d));
  }, []);

  if (data === undefined) return <p className="text-gray-400">Loading...</p>;
  if (data === null) return <p className="text-gray-400">No strategy generated yet. Run `seoagent strategy generate` first.</p>;

  const s = data.strategy;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Strategy</h2>
        <span className="text-sm text-gray-400">Generated: {new Date(data.generatedAt).toLocaleDateString()}</span>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
        <p className="text-sm text-gray-400">Overall SEO Health</p>
        <p className="text-4xl font-bold mt-1">{s.overallScore}<span className="text-lg text-gray-500">/100</span></p>
      </div>

      {s.quickWins?.length > 0 && (
        <section>
          <h3 className="text-lg font-semibold mb-2">Quick Wins</h3>
          <div className="space-y-2">
            {s.quickWins.map((item, i) => (
              <div key={i} className="bg-gray-900 border border-gray-800 rounded p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs px-2 py-0.5 rounded ${item.impact === "high" ? "bg-green-900 text-green-300" : item.impact === "medium" ? "bg-yellow-900 text-yellow-300" : "bg-gray-700 text-gray-300"}`}>
                    {item.impact} impact
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded ${item.effort === "low" ? "bg-green-900 text-green-300" : item.effort === "medium" ? "bg-yellow-900 text-yellow-300" : "bg-red-900 text-red-300"}`}>
                    {item.effort} effort
                  </span>
                </div>
                <p className="text-sm text-white">{item.action}</p>
                <p className="text-sm text-gray-400 mt-1">{item.reason}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {s.technicalFixes?.length > 0 && (
        <section>
          <h3 className="text-lg font-semibold mb-2">Technical Fixes</h3>
          <div className="space-y-1">
            {s.technicalFixes.map((fix, i) => (
              <div key={i} className="bg-gray-900 border border-gray-800 rounded p-3">
                <p className="text-sm text-white">{fix.issue}</p>
                <p className="text-sm text-gray-400">{fix.fix}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {s.competitorInsights?.length > 0 && (
        <section>
          <h3 className="text-lg font-semibold mb-2">Competitor Insights</h3>
          <ul className="list-disc list-inside text-sm text-gray-300 space-y-1">
            {s.competitorInsights.map((insight, i) => <li key={i}>{insight}</li>)}
          </ul>
        </section>
      )}

      {s.drPlan && (
        <section>
          <h3 className="text-lg font-semibold mb-2">DR Growth Plan</h3>
          <p className="text-sm text-gray-400 mb-2">
            Current: {s.drPlan.currentDR} &rarr; Target: {s.drPlan.targetDR}
          </p>
          <ul className="list-disc list-inside text-sm text-gray-300 space-y-1">
            {s.drPlan.actions.map((action, i) => <li key={i}>{action}</li>)}
          </ul>
        </section>
      )}
    </div>
  );
}
