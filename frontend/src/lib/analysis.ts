import type { PolicyMetrics } from "./types";

/** Percentage cost reduction of `a` relative to `baseline` (positive = cheaper). */
export function savingsPct(a: PolicyMetrics, baseline: PolicyMetrics): number {
  return 100 * (1 - a.mean_cost / baseline.mean_cost);
}

export function pct(x: number, digits = 1): string {
  return `${(100 * x).toFixed(digits)}%`;
}

export function num(x: number, digits = 2): string {
  return x.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

const isNum = (c: string | undefined): c is string =>
  c !== undefined && c !== "" && Number.isFinite(Number(c));

/** First numeric column of a CSV (header row optional), as daily sales. */
export function parseSalesCsv(text: string): number[] {
  const rows = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => l.split(/[,;\t]/).map((c) => c.trim().replace(/^"|"$/g, "")));
  if (rows.length === 0) throw new Error("The CSV file is empty.");
  const width = Math.max(...rows.map((r) => r.length));
  for (let col = 0; col < width; col++) {
    const body = rows.slice(1).map((r) => r[col]);
    if (body.length >= 1 && body.every(isNum)) {
      const cells = isNum(rows[0][col]) ? rows.map((r) => r[col]) : body;
      if (cells.length >= 2) return cells.map(Number);
    }
  }
  throw new Error("No numeric sales column with at least 2 rows was found.");
}
