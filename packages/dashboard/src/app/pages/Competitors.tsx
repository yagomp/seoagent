import { useEffect, useState } from "react";
import { DataTable } from "../components/DataTable.js";

interface CompData {
  keywords: {
    keyword: string;
    volume: number;
    difficulty: number;
    current_position: number | null;
  }[];
}

export function Competitors() {
  const [data, setData] = useState<CompData | null>(null);

  useEffect(() => {
    fetch("/api/competitors").then((r) => r.json()).then(setData);
  }, []);

  if (!data) return <p className="text-gray-400">Loading...</p>;

  return (
    <div>
      <h2 className="text-xl font-bold mb-6">Competitors</h2>
      <p className="text-gray-400 mb-4">Keyword landscape -- run competitor analysis via CLI/MCP to populate this data.</p>
      <DataTable
        columns={[
          { key: "keyword", label: "Keyword", sortable: true },
          { key: "volume", label: "Volume", sortable: true },
          { key: "difficulty", label: "Difficulty", sortable: true },
          { key: "current_position", label: "Your Position", sortable: true },
        ]}
        data={data.keywords}
        defaultSort="volume"
      />
    </div>
  );
}
