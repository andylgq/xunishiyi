"use client";

import { useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import type { TaskView } from "@/types/api";
import { isTerminalStatus } from "@/types/tryon";
import {
  POLL_FAST_WINDOW_MS,
  POLL_INTERVAL_FAST_MS,
  POLL_INTERVAL_SLOW_MS,
} from "@/lib/constants";

async function fetchTask(taskId: string): Promise<TaskView> {
  const res = await fetch(`/api/tryon/${taskId}`, { cache: "no-store" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      (data as { error?: { message?: string } })?.error?.message ??
        `查询失败 (${res.status})`
    );
  }
  return data as TaskView;
}

/**
 * 任务轮询：前 10s 每 2s 一次，之后每 5s；终态停止。
 * 后端 GET 接口会顺带推进在途任务，本地 dev 无需 cron。
 */
export function useTaskPolling(taskId: string | null | undefined) {
  const startedAtRef = useRef<number>(0);
  return useQuery({
    queryKey: ["task", taskId],
    queryFn: () => {
      if (!startedAtRef.current) startedAtRef.current = Date.now();
      return fetchTask(taskId as string);
    },
    enabled: !!taskId,
    refetchInterval: (query) => {
      const s = query.state.data?.status;
      if (s && isTerminalStatus(s)) return false;
      const elapsed = Date.now() - (startedAtRef.current || Date.now());
      return elapsed < POLL_FAST_WINDOW_MS
        ? POLL_INTERVAL_FAST_MS
        : POLL_INTERVAL_SLOW_MS;
    },
    refetchOnWindowFocus: false,
    retry: 1,
  });
}
