"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="wrap section">
      <div className="state">
        <p className="eyebrow">Something went wrong</p>
        <h1 className="display">This page did not load</h1>
        <p>
          The error has been logged. Try again, and if it keeps happening let us know
          with your order reference.
        </p>
        <div className="state-actions">
          <button type="button" className="btn" onClick={reset}>
            Try again
          </button>
          <Link href="/" className="btn btn-ghost">
            Go to the homepage
          </Link>
        </div>
      </div>
    </div>
  );
}
