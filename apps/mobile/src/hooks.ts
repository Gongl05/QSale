import { useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
export function useDebounced<T>(value: T, delay = 350) {
  const [result, setResult] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setResult(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return result;
}
export function usePagination() {
  const params = useLocalSearchParams<Record<string, string>>();
  const router = useRouter();
  const raw = Number(params.page ?? 1);
  const page = Number.isInteger(raw) && raw > 0 ? raw - 1 : 0;
  const size = [10, 25, 50, 100].includes(Number(params.size)) ? Number(params.size) : 10;
  return {
    params,
    page,
    size,
    update: (values: Record<string, string>) => router.setParams(values),
    onChange: (page: number, size: number) =>
      router.setParams({ page: String(page + 1), size: String(size) }),
  };
}
