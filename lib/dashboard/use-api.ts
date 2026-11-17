"use client";

import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "./api";

/**
 * Loads `path` and keeps the last good result while reloading, so tables
 * don't flash empty after every save. Pass null to skip loading.
 */
export function useApi<T>(path: string | null) {
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(path !== null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (path === null) return;
    const controller = new AbortController();
    // Loading flags come from the fetch callbacks below, not from render.
    queueMicrotask(() => setLoading(true));
    api<T>(path, { signal: controller.signal })
      .then((result) => {
        setData(result);
        setError(null);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setError(err instanceof ApiError ? err : new ApiError(0, "Tidak bisa terhubung ke server."));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [path, version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  return { data, error, loading, reload };
}
