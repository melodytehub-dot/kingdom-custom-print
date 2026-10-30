"use client";

import { useEffect, useState } from "react";

interface LibraryManifest<T> {
  categories: string[];
  items: T[];
}

const EMPTY_MANIFEST = { categories: [], items: [] };

export function useLumiseLibrary<T>(url: string) {
  const [manifest, setManifest] = useState<LibraryManifest<T>>(EMPTY_MANIFEST);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    fetch(url, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Could not load ${url}`);
        return response.json() as Promise<LibraryManifest<T>>;
      })
      .then((payload) => {
        if (!Array.isArray(payload.items) || !Array.isArray(payload.categories)) {
          throw new Error(`Invalid library manifest at ${url}`);
        }
        setManifest(payload);
      })
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        setError(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [url]);

  return { ...manifest, loading, error };
}
