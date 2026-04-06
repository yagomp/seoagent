import { useState, useMemo } from "react";

interface Column<T> {
  key: keyof T;
  label: string;
  sortable?: boolean;
  render?: (value: T[keyof T], row: T) => React.ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  defaultSort?: keyof T;
}

export function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  defaultSort,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<keyof T | undefined>(defaultSort);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [filter, setFilter] = useState("");

  const sorted = useMemo(() => {
    let result = [...data];
    if (filter) {
      const lower = filter.toLowerCase();
      result = result.filter((row) =>
        Object.values(row).some((v) =>
          String(v).toLowerCase().includes(lower)
        )
      );
    }
    if (sortKey) {
      result.sort((a, b) => {
        const av = a[sortKey];
        const bv = b[sortKey];
        if (av === bv) return 0;
        const cmp = av !== null && av !== undefined && bv !== null && bv !== undefined && av > bv ? 1 : -1;
        return sortDir === "asc" ? cmp : -cmp;
      });
    }
    return result;
  }, [data, sortKey, sortDir, filter]);

  function handleSort(key: keyof T) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  return (
    <div>
      <input
        type="text"
        placeholder="Filter..."
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className="mb-4 px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm text-white placeholder-gray-500 w-64"
      />
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800">
              {columns.map((col) => (
                <th
                  key={String(col.key)}
                  className={`px-3 py-2 text-left text-gray-400 font-medium ${col.sortable ? "cursor-pointer hover:text-white" : ""}`}
                  onClick={() => col.sortable && handleSort(col.key)}
                >
                  {col.label}
                  {sortKey === col.key && (sortDir === "asc" ? " \u2191" : " \u2193")}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, i) => (
              <tr key={i} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                {columns.map((col) => (
                  <td key={String(col.key)} className="px-3 py-2 text-gray-300">
                    {col.render ? col.render(row[col.key], row) : String(row[col.key] ?? "\u2014")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
