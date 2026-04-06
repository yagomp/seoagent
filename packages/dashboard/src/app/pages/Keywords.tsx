import { useEffect, useState } from "react";
import { DataTable } from "../components/DataTable.js";

interface Keyword {
  keyword: string;
  volume: number;
  difficulty: number;
  position: number | null;
  tracked: number;
}

export function Keywords() {
  const [data, setData] = useState<Keyword[]>([]);

  useEffect(() => {
    fetch("/api/keywords").then((r) => r.json()).then(setData);
  }, []);

  return (
    <div>
      <h2 className="text-xl font-bold mb-6">Keywords</h2>
      <DataTable
        columns={[
          { key: "keyword", label: "Keyword", sortable: true },
          { key: "volume", label: "Volume", sortable: true },
          { key: "difficulty", label: "Difficulty", sortable: true,
            render: (v) => {
              const d = v as number;
              const color = d > 70 ? "text-red-400" : d > 40 ? "text-yellow-400" : "text-green-400";
              return <span className={color}>{d}</span>;
            }
          },
          { key: "position", label: "Position", sortable: true },
          { key: "tracked", label: "Tracked", sortable: false,
            render: (v) => (v as number) === 1 ? "Yes" : "No"
          },
        ]}
        data={data}
        defaultSort="volume"
      />
    </div>
  );
}
