import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';

interface UseRealtimeOptions {
  queryKeys: string[][];
  interval?: number;
  enabled?: boolean;
}

export function useRealtime({ queryKeys, interval = 30000, enabled = true }: UseRealtimeOptions) {
  const queryClient = useQueryClient();
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!enabled) return;
    timerRef.current = setInterval(() => {
      queryKeys.forEach((key) => {
        queryClient.invalidateQueries({ queryKey: key });
      });
    }, interval);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, interval]);
}

export function usePolling(callback: () => void, interval = 30000, enabled = true) {
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (!enabled) return;
    timerRef.current = setInterval(callback, interval);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [callback, interval, enabled]);
}
