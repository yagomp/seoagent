import { useEffect, useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface TrackedKeyword {
  keyword: string;
  position: number | null;
  tracked?: number;
}

interface RankEntry {
  position: number;
  checkedAt: string;
}

export function RankTracker() {
  const [keywords, setKeywords] = useState<TrackedKeyword[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [history, setHistory] = useState<RankEntry[]>([]);

  useEffect(() => {
    fetch("/api/keywords?sort=keyword&order=ASC")
      .then((r) => r.json())
      .then((data: TrackedKeyword[]) => {
        const tracked = data.filter((k) => k.tracked === 1);
        setKeywords(tracked);
        if (tracked.length > 0) setSelected(tracked[0].keyword);
      });
  }, []);

  useEffect(() => {
    if (!selected) return;
    fetch(`/api/rank-history?keyword=${encodeURIComponent(selected)}`)
      .then((r) => r.json())
      .then(setHistory);
  }, [selected]);

  return (
    <div>
      <h2 className="text-xl font-bold mb-6">Rank Tracker</h2>
      <div className="flex gap-4 mb-6 flex-wrap">
        {keywords.map((k) => (
          <button
            key={k.keyword}
            onClick={() => setSelected(k.keyword)}
            className={`px-3 py-1 rounded text-sm ${
              selected === k.keyword
                ? "bg-blue-600 text-white"
                : "bg-gray-800 text-gray-400 hover:text-white"
            }`}
          >
            {k.keyword} {k.position !== null && `(#${k.position})`}
          </button>
        ))}
      </div>
      {history.length > 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4" style={{ height: 400 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={history}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="checkedAt" stroke="#9CA3AF" tick={{ fontSize: 12 }} />
              <YAxis reversed stroke="#9CA3AF" tick={{ fontSize: 12 }} />
              <Tooltip contentStyle={{ backgroundColor: "#1F2937", border: "1px solid #374151" }} />
              <Line type="monotone" dataKey="position" stroke="#3B82F6" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="text-gray-400">No rank history data yet. Run rank tracking first.</p>
      )}
    </div>
  );
}
