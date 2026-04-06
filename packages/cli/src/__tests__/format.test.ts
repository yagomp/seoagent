import { describe, it, expect } from "vitest";
import { formatOutput } from "../format.js";

const sampleData = [
  { keyword: "fpl tips", volume: 12100, difficulty: 45 },
  { keyword: "fantasy football", volume: 90500, difficulty: 78 },
];

const sampleColumns = [
  { key: "keyword", label: "Keyword", width: 20 },
  { key: "volume", label: "Volume", width: 10, align: "right" as const },
  { key: "difficulty", label: "Difficulty", width: 12, align: "right" as const },
];

describe("formatOutput", () => {
  it("renders JSON format", () => {
    const output = formatOutput(sampleData, sampleColumns, "json");
    const parsed = JSON.parse(output);
    expect(parsed).toEqual(sampleData);
    expect(parsed).toHaveLength(2);
  });

  it("renders markdown format", () => {
    const output = formatOutput(sampleData, sampleColumns, "markdown");
    const lines = output.split("\n");
    // Header row
    expect(lines[0]).toContain("Keyword");
    expect(lines[0]).toContain("Volume");
    expect(lines[0]).toContain("Difficulty");
    // Separator row
    expect(lines[1]).toMatch(/^[\s|:-]+$/);
    // Data rows
    expect(lines[2]).toContain("fpl tips");
    expect(lines[2]).toContain("12100");
    expect(lines[3]).toContain("fantasy football");
    expect(lines[3]).toContain("90500");
  });

  it("renders table format (default)", () => {
    const output = formatOutput(sampleData, sampleColumns, "table");
    const lines = output.split("\n");
    // Header
    expect(lines[0]).toContain("Keyword");
    expect(lines[0]).toContain("Volume");
    // Separator line with dashes
    expect(lines[1]).toMatch(/-+/);
    // Data rows
    expect(lines[2]).toContain("fpl tips");
    expect(lines[3]).toContain("fantasy football");
  });

  it("defaults to table format when no format specified", () => {
    const table = formatOutput(sampleData, sampleColumns, "table");
    const defaultOutput = formatOutput(sampleData, sampleColumns);
    expect(defaultOutput).toBe(table);
  });

  it("handles empty data array", () => {
    const output = formatOutput([], sampleColumns, "table");
    expect(output).toContain("No data");
  });
});

describe("formatOutput with nested/string values", () => {
  it("stringifies non-primitive values in JSON mode", () => {
    const data = [{ name: "test", tags: ["a", "b"] }];
    const cols = [
      { key: "name", label: "Name", width: 10 },
      { key: "tags", label: "Tags", width: 15 },
    ];
    const output = formatOutput(data, cols, "json");
    expect(JSON.parse(output)[0].tags).toEqual(["a", "b"]);
  });

  it("joins arrays with commas in table mode", () => {
    const data = [{ name: "test", tags: ["a", "b"] }];
    const cols = [
      { key: "name", label: "Name", width: 10 },
      { key: "tags", label: "Tags", width: 15 },
    ];
    const output = formatOutput(data, cols, "table");
    expect(output).toContain("a, b");
  });
});
