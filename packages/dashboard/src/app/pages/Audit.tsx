import { useEffect, useState } from "react";

interface AuditData {
  pages: {
    url: string;
    status_code: number;
    title: string;
    word_count: number;
    issues: string;
  }[];
  issuesByType: Record<string, number>;
  totalPages: number;
}

export function Audit() {
  const [data, setData] = useState<AuditData | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/audit").then((r) => r.json()).then(setData);
  }, []);

  if (!data) return <p className="text-gray-400">Loading...</p>;
  if (data.totalPages === 0) return <p className="text-gray-400">No crawl data. Run an audit first.</p>;

  const issueEntries = Object.entries(data.issuesByType).sort((a, b) => b[1] - a[1]);

  return (
    <div>
      <h2 className="text-xl font-bold mb-6">Site Audit</h2>
      <p className="text-gray-400 mb-4">{data.totalPages} pages crawled</p>

      {issueEntries.length > 0 && (
        <div className="mb-6 space-y-2">
          <h3 className="text-lg font-semibold">Issues by Type</h3>
          {issueEntries.map(([type, count]) => (
            <div key={type} className="flex items-center gap-3">
              <div className="w-48 text-sm text-gray-300">{type}</div>
              <div className="flex-1 bg-gray-800 rounded-full h-4">
                <div
                  className="bg-red-500 h-4 rounded-full"
                  style={{ width: `${Math.min(100, (count / data.totalPages) * 100)}%` }}
                />
              </div>
              <span className="text-sm text-gray-400 w-8">{count}</span>
            </div>
          ))}
        </div>
      )}

      <h3 className="text-lg font-semibold mb-2">Pages</h3>
      <div className="space-y-1">
        {data.pages.map((page) => {
          const issues = JSON.parse(page.issues || "[]") as string[];
          return (
            <div key={page.url} className="bg-gray-900 border border-gray-800 rounded">
              <button
                className="w-full text-left px-4 py-2 flex items-center justify-between hover:bg-gray-800/50"
                onClick={() => setExpanded(expanded === page.url ? null : page.url)}
              >
                <span className="text-sm text-gray-300 truncate">{page.url}</span>
                <span className={`text-xs px-2 py-0.5 rounded ${page.status_code === 200 ? "bg-green-900 text-green-300" : "bg-red-900 text-red-300"}`}>
                  {page.status_code}
                </span>
              </button>
              {expanded === page.url && (
                <div className="px-4 py-2 border-t border-gray-800 text-sm space-y-1">
                  <p><span className="text-gray-500">Title:</span> {page.title || "\u2014"}</p>
                  <p><span className="text-gray-500">Words:</span> {page.word_count}</p>
                  {issues.length > 0 && (
                    <div>
                      <span className="text-gray-500">Issues:</span>
                      <ul className="list-disc list-inside text-red-400 mt-1">
                        {issues.map((issue, i) => <li key={i}>{issue}</li>)}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
