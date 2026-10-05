import { useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";

import { apiErrorMessage } from "@/lib/api";

type Page<T, M> = { items: T[]; meta: M; nextCursor: string | null };

/**
 * A cursor-paged API feed: first page on focus, more on demand.
 *
 * `refreshing` belongs to the pull gesture only (same rule as gridgo-rider):
 * a re-read on focus happens quietly behind what is already on screen.
 */
export function usePagedFeed<T, M>(
  load: (before: string | null) => Promise<Page<T, M>>,
  enabled = true,
) {
  const [items, setItems] = useState<T[]>([]);
  const [meta, setMeta] = useState<M | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadRef = useRef(load);
  loadRef.current = load;
  const request = useRef(0);

  const readFirst = useCallback(async (pulled: boolean) => {
    const id = ++request.current;
    if (pulled) setRefreshing(true);
    try {
      const page = await loadRef.current(null);
      if (id !== request.current) return;
      setItems(page.items);
      setMeta(page.meta);
      setCursor(page.nextCursor);
      setError(null);
    } catch (caught) {
      if (id !== request.current) return;
      setError(apiErrorMessage(caught, "This list did not load. Pull down to try again."));
    } finally {
      if (id === request.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (enabled) void readFirst(false);
    }, [enabled, readFirst]),
  );

  const loadMore = useCallback(async () => {
    if (!cursor || loadingMore) return;
    const id = request.current;
    setLoadingMore(true);
    try {
      const page = await loadRef.current(cursor);
      if (id !== request.current) return;
      setItems((current) => [...current, ...page.items]);
      setCursor(page.nextCursor);
    } catch (caught) {
      setError(apiErrorMessage(caught, "More entries did not load. Try again."));
    } finally {
      setLoadingMore(false);
    }
  }, [cursor, loadingMore]);

  return {
    items,
    meta,
    loading,
    refreshing,
    loadingMore,
    error,
    hasMore: Boolean(cursor),
    refresh: () => readFirst(true),
    loadMore,
  };
}
