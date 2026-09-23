"use client";

import { useEffect } from "react";

/** Last-resort boundary for unexpected rendering failures; expected errors are handled inside the dashboard. */
export default function Error({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto max-w-xl px-4 py-16">
      <div role="alert" className="rounded-lg border border-line bg-danger-bg p-6">
        <h1 className="text-lg font-semibold">Something went wrong while showing the portfolio.</h1>
        <p className="mt-2 text-sm text-ink-2">
          {error.digest ? `Reference: ${error.digest}. ` : ""}Try again; if it keeps failing, reload the page.
        </p>
        <button
          type="button"
          onClick={() => retry()}
          className="mt-4 rounded-md bg-action px-4 py-2 text-sm font-medium text-white hover:bg-action-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action"
        >
          Try again
        </button>
      </div>
    </main>
  );
}
