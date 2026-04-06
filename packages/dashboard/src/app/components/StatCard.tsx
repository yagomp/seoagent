interface StatCardProps {
  label: string;
  value: string | number | null;
  change?: string;
}

export function StatCard({ label, value, change }: StatCardProps) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
      <p className="text-sm text-gray-400">{label}</p>
      <p className="text-2xl font-bold text-white mt-1">
        {value ?? "\u2014"}
      </p>
      {change && (
        <p className={`text-sm mt-1 ${change.startsWith("+") ? "text-green-400" : change.startsWith("-") ? "text-red-400" : "text-gray-400"}`}>
          {change}
        </p>
      )}
    </div>
  );
}
