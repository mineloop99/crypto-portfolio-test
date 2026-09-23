"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ErrorResponseSchema,
  MAX_UPLOAD_BYTES,
  PortfolioResponseSchema,
  type IssueDto,
  type PortfolioResponse,
} from "@/contracts/portfolio";

export type LoadState =
  | { status: "loading" }
  | { status: "ready"; data: PortfolioResponse }
  | { status: "error"; message: string; requestId: string | null };

export type ImportState =
  | { status: "idle" }
  | { status: "importing"; fileName: string }
  | { status: "imported"; fileName: string; tradeCount: number }
  | { status: "rejected"; fileName: string; message: string; issues: IssueDto[]; issueCount: number };

type ApiResult =
  | { ok: true; data: PortfolioResponse }
  | { ok: false; message: string; issues: IssueDto[]; issueCount: number; requestId: string | null };

async function callApi(init?: RequestInit): Promise<ApiResult> {
  let response: Response;
  try {
    response = await fetch("/api/portfolio", { cache: "no-store", ...init });
  } catch {
    return { ok: false, message: "Could not reach the server. Check your connection and try again.", issues: [], issueCount: 0, requestId: null };
  }
  const requestId = response.headers.get("x-request-id");
  const body: unknown = await response.json().catch(() => null);

  if (response.ok) {
    const parsed = PortfolioResponseSchema.safeParse(body);
    if (parsed.success) return { ok: true, data: parsed.data };
    console.error("Portfolio response failed contract validation", parsed.error);
    return { ok: false, message: "The server sent data in an unexpected format.", issues: [], issueCount: 0, requestId };
  }
  const error = ErrorResponseSchema.safeParse(body);
  if (error.success) {
    const { message, issues, issueCount } = error.data.error;
    return { ok: false, message, issues, issueCount, requestId };
  }
  return { ok: false, message: `The server returned HTTP ${response.status}.`, issues: [], issueCount: 0, requestId };
}

/**
 * Client state for the dashboard. The current portfolio is replaced only by a successful response, so a rejected
 * import leaves the previous numbers on screen untouched. Imported data lives in memory only (never persisted):
 * a reload or "Reset to sample data" goes back to the supplied files.
 */
export function usePortfolio() {
  const [load, setLoad] = useState<LoadState>({ status: "loading" });
  const [importState, setImportState] = useState<ImportState>({ status: "idle" });
  const latestRequest = useRef(0);

  const applySample = useCallback((result: ApiResult) => {
    if (result.ok) {
      setLoad({ status: "ready", data: result.data });
      setImportState({ status: "idle" });
    } else {
      setLoad({ status: "error", message: result.message, requestId: result.requestId });
    }
  }, []);

  /** Retry after a failed load, or "Reset to sample data" — keeps the current numbers visible while it runs. */
  const loadSample = useCallback(async () => {
    const request = ++latestRequest.current;
    setLoad((current) => (current.status === "ready" ? current : { status: "loading" }));
    const result = await callApi();
    if (request === latestRequest.current) applySample(result);
  }, [applySample]);

  const importFile = useCallback(async (file: File) => {
    if (file.size > MAX_UPLOAD_BYTES) {
      setImportState({
        status: "rejected",
        fileName: file.name,
        message: `${file.name} is larger than ${MAX_UPLOAD_BYTES / 1024 / 1024} MB.`,
        issues: [],
        issueCount: 0,
      });
      return;
    }
    const request = ++latestRequest.current;
    setImportState({ status: "importing", fileName: file.name });
    const result = await callApi({
      method: "POST",
      body: await file.text(),
      headers: { "content-type": "text/csv", "x-file-name": encodeURIComponent(file.name) },
    });
    if (request !== latestRequest.current) return;
    if (result.ok) {
      setLoad({ status: "ready", data: result.data });
      setImportState({ status: "imported", fileName: file.name, tradeCount: result.data.source.tradeCount });
    } else {
      setImportState({
        status: "rejected",
        fileName: file.name,
        message: result.message + (result.requestId && result.issueCount === 0 ? ` (reference ${result.requestId})` : ""),
        issues: result.issues,
        issueCount: result.issueCount,
      });
    }
  }, []);

  const dismissImport = useCallback(() => setImportState({ status: "idle" }), []);

  useEffect(() => {
    // Initial load: state is only set when the response arrives; a stale response (unmount, newer request) is dropped.
    let cancelled = false;
    const request = ++latestRequest.current;
    void callApi().then((result) => {
      if (!cancelled && request === latestRequest.current) applySample(result);
    });
    return () => {
      cancelled = true;
    };
  }, [applySample]);

  return { load, importState, loadSample, importFile, dismissImport };
}
