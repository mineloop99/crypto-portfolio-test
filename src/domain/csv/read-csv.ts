import Papa from "papaparse";
import { issue, type ValidationIssue } from "../model";

export interface CsvRow<C extends string> {
  line: number;
  get(column: C): string;
}

export type CsvTable<C extends string> = { ok: true; rows: CsvRow<C>[] } | { ok: false; issues: ValidationIssue[] };

/**
 * Reads a comma-separated file with a header row and checks its shape: required columns present (in any order),
 * no duplicate header names, same number of fields on every row. Cells are trimmed; blank lines are skipped.
 * Extra columns are allowed and ignored. Line numbers assume no field contains a line break.
 */
export function readCsv<C extends string>(text: string, requiredColumns: readonly C[]): CsvTable<C> {
  const source = text.replace(/^﻿/, "");
  if (source.trim() === "") return { ok: false, issues: [issue("The file is empty.")] };

  const parsed = Papa.parse<string[]>(source, { delimiter: ",", skipEmptyLines: false });
  const issues: ValidationIssue[] = parsed.errors.map((e) =>
    issue(`CSV syntax error: ${e.message}.`, { line: e.row === undefined ? null : e.row + 1 }),
  );
  if (issues.length > 0) return { ok: false, issues };

  const [headerCells, ...body] = parsed.data;
  const header = headerCells.map((h) => h.trim());

  const duplicates = header.filter((h, i) => h !== "" && header.indexOf(h) !== i);
  if (duplicates.length > 0) {
    issues.push(issue(`Duplicate column name(s) in header: ${[...new Set(duplicates)].join(", ")}.`, { line: 1 }));
  }
  const missing = requiredColumns.filter((c) => !header.includes(c));
  if (missing.length > 0) {
    issues.push(
      issue(`Missing required column(s): ${missing.join(", ")}. Expected header: ${requiredColumns.join(",")}.`, {
        line: 1,
      }),
    );
  }
  if (issues.length > 0) return { ok: false, issues };

  const index = new Map(requiredColumns.map((c) => [c, header.indexOf(c)]));
  const rows: CsvRow<C>[] = [];
  body.forEach((cells, i) => {
    const line = i + 2;
    if (cells.every((c) => c.trim() === "")) return;
    if (cells.length !== header.length) {
      issues.push(issue(`Expected ${header.length} fields but found ${cells.length}.`, { line }));
      return;
    }
    const trimmed = cells.map((c) => c.trim());
    rows.push({ line, get: (column) => trimmed[index.get(column)!] });
  });

  if (issues.length > 0) return { ok: false, issues };
  if (rows.length === 0) return { ok: false, issues: [issue("The file has a header but no data rows.")] };
  return { ok: true, rows };
}

const ISO_UTC = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?(?:Z|\+00:00)$/;

/**
 * Parses a UTC ISO-8601 timestamp such as "2025-10-01T09:00:00Z" (fractional seconds and "+00:00" allowed).
 * Returns epoch milliseconds, or null when the format is wrong or the date does not exist (e.g. Feb 30).
 */
export function parseUtcTimestamp(raw: string): number | null {
  const m = ISO_UTC.exec(raw);
  if (!m) return null;
  const [year, month, day, hour, minute, second] = m.slice(1, 7).map(Number);
  const millis = Number((m[7] ?? "0").padEnd(3, "0").slice(0, 3));
  const time = Date.UTC(year, month - 1, day, hour, minute, second, millis);
  const d = new Date(time);
  const valid =
    d.getUTCFullYear() === year &&
    d.getUTCMonth() === month - 1 &&
    d.getUTCDate() === day &&
    d.getUTCHours() === hour &&
    d.getUTCMinutes() === minute &&
    d.getUTCSeconds() === second;
  return valid ? time : null;
}
