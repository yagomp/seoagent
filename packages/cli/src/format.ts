export type OutputFormat = "table" | "json" | "markdown";

export interface Column {
  key: string;
  label: string;
  width: number;
  align?: "left" | "right";
}

function cellValue(row: Record<string, unknown>, key: string): string {
  const val = row[key];
  if (val === null || val === undefined) return "";
  if (Array.isArray(val)) return val.join(", ");
  return String(val);
}

function padCell(text: string, width: number, align: "left" | "right" = "left"): string {
  const truncated = text.length > width ? text.slice(0, width - 1) + "~" : text;
  if (align === "right") {
    return truncated.padStart(width);
  }
  return truncated.padEnd(width);
}

function renderTable(data: Record<string, unknown>[], columns: Column[]): string {
  if (data.length === 0) return "No data to display.";

  const header = columns.map((c) => padCell(c.label, c.width, c.align)).join("  ");
  const separator = columns.map((c) => "-".repeat(c.width)).join("  ");
  const rows = data.map((row) =>
    columns.map((c) => padCell(cellValue(row, c.key), c.width, c.align)).join("  ")
  );

  return [header, separator, ...rows].join("\n");
}

function renderMarkdown(data: Record<string, unknown>[], columns: Column[]): string {
  if (data.length === 0) return "No data to display.";

  const header = "| " + columns.map((c) => c.label).join(" | ") + " |";
  const separator =
    "| " +
    columns
      .map((c) => {
        if (c.align === "right") return "-".repeat(c.width) + ":";
        return "-".repeat(c.width);
      })
      .join(" | ") +
    " |";
  const rows = data.map(
    (row) => "| " + columns.map((c) => cellValue(row, c.key)).join(" | ") + " |"
  );

  return [header, separator, ...rows].join("\n");
}

function renderJson(data: Record<string, unknown>[]): string {
  return JSON.stringify(data, null, 2);
}

export function formatOutput(
  data: Record<string, unknown>[],
  columns: Column[],
  format?: OutputFormat
): string {
  const fmt = format ?? "table";

  switch (fmt) {
    case "json":
      return renderJson(data);
    case "markdown":
      return renderMarkdown(data, columns);
    case "table":
    default:
      return renderTable(data, columns);
  }
}

/**
 * Format a single key-value object for display (used for single-record outputs
 * like domain reputation or audit page).
 */
export function formatKeyValue(
  data: Record<string, unknown>,
  format?: OutputFormat
): string {
  const fmt = format ?? "table";

  if (fmt === "json") {
    return JSON.stringify(data, null, 2);
  }

  const entries = Object.entries(data);
  if (entries.length === 0) return "No data to display.";

  const maxKeyLen = Math.max(...entries.map(([k]) => k.length));

  if (fmt === "markdown") {
    const rows = entries.map(
      ([k, v]) => `| **${k}** | ${Array.isArray(v) ? v.join(", ") : String(v ?? "")} |`
    );
    return ["| Field | Value |", "| ----- | ----- |", ...rows].join("\n");
  }

  // table
  return entries
    .map(([k, v]) => {
      const label = k.padEnd(maxKeyLen);
      const val = Array.isArray(v) ? v.join(", ") : String(v ?? "");
      return `${label}  ${val}`;
    })
    .join("\n");
}
