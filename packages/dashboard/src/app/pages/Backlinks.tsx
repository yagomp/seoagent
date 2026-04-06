import { useEffect, useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { DataTable } from "../components/DataTable.js";

interface BacklinkData {
  backlinks: {
    source_domain: string;
    source_url: string;
    anchor_text: string;
    is_dofollow: number;
    domain_rating: number;
  }[];
  total: number;
}

interface DREntry {
  domainRating: number;
  referringDomains: number;
  checkedAt: string;
}

export function Backlinks() {
  const [data, setData] = useState<BacklinkData | null>(null);
  const [drHistory, setDrHistory] = useState<DREntry[]>([]);

  useEffect(() => {
    fetch("/api/backlinks").then((r) => r.json()).then(setData);
    fetch("/api/dr-history").then((r) => r.json()).then(setDrHistory);
  }, []);

  if (!data) return <p className="text-gray-400">Loading...</p>;

  return (
    <div>
      <h2 className="text-xl font-bold mb-6">Backlinks</h2>
      <p className="text-gray-400 mb-4">{data.total} total backlinks</p>

      {drHistory.length > 1 && (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 mb-6" style={{ height: 300 }}>
          <h3 className="text-sm font-semibold text-gray-400 mb-2">Domain Rating History</h3>
          <ResponsiveContainer width="100%" height="85%">
            <LineChart data={drHistory}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="checkedAt" stroke="#9CA3AF" tick={{ fontSize: 12 }} />
              <YAxis stroke="#9CA3AF" tick={{ fontSize: 12 }} />
              <Tooltip contentStyle={{ backgroundColor: "#1F2937", border: "1px solid #374151" }} />
              <Line type="monotone" dataKey="domainRating" stroke="#10B981" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <h3 className="text-lg font-semibold mb-2">Referring Domains</h3>
      <DataTable
        columns={[
          { key: "source_domain", label: "Domain", sortable: true },
          { key: "anchor_text", label: "Anchor", sortable: true },
          { key: "domain_rating", label: "DR", sortable: true },
          { key: "is_dofollow", label: "Type", sortable: true,
            render: (v) => (v as number) === 1 ? <span className="text-green-400">dofollow</span> : <span className="text-gray-500">nofollow</span>
          },
        ]}
        data={data.backlinks}
        defaultSort="domain_rating"
      />
    </div>
  );
}
