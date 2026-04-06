import { useEffect, useState } from "react";
import { StatCard } from "../components/StatCard.js";

interface OverviewData {
  trackedKeywords: number;
  domainRating: number | null;
  crawledPages: number;
  pagesWithIssues: number;
}

export function Overview() {
  const [data, setData] = useState<OverviewData | null>(null);

  useEffect(() => {
    fetch("/api/overview")
      .then((r) => r.json())
      .then(setData);
  }, []);

  if (!data) return <p className="text-gray-400">Loading...</p>;

  return (
    <div>
      <h2 className="text-xl font-bold mb-6">Overview</h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Domain Rating" value={data.domainRating} />
        <StatCard label="Tracked Keywords" value={data.trackedKeywords} />
        <StatCard label="Crawled Pages" value={data.crawledPages} />
        <StatCard label="Pages with Issues" value={data.pagesWithIssues} />
      </div>
    </div>
  );
}
