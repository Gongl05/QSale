import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { useToast } from './ui';
import { ApiError, isCanceledRequest } from '@qsale/api-client';

export function useDebounced<T>(value: T, delay = 350) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}
export function usePagination() {
  const [params, setParams] = useSearchParams();
  const rawPage = Number(params.get('page') ?? 1);
  const rawSize = Number(params.get('size') ?? 10);
  const page = Number.isInteger(rawPage) && rawPage > 0 ? rawPage - 1 : 0;
  const size = [10, 25, 50, 100].includes(rawSize) ? rawSize : 10;
  const update = (values: Record<string, string | undefined>, replace = false) =>
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        Object.entries(values).forEach(([key, value]) => {
          if (value) next.set(key, value);
          else next.delete(key);
        });
        return next;
      },
      { replace },
    );
  return {
    params,
    page,
    size,
    update,
    onChange: (page: number, size: number) =>
      update({ page: String(page + 1), size: String(size) }),
  };
}
export function useAction<T>(
  action: (input: T) => Promise<unknown>,
  message: string,
  after?: () => void,
) {
  const client = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: action,
    onSuccess: async () => {
      await client.invalidateQueries();
      toast(message);
      after?.();
    },
    onError: (error: Error) => {
      if (isCanceledRequest(error)) return;
      if (error instanceof ApiError && [403, 404, 409].includes(error.status))
        void client.invalidateQueries();
      toast(error.message, true);
    },
  });
}
export function useOnline() {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true),
      off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return online;
}
