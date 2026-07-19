"use client";

import type { TaskViewResult } from "@/types/api";
import { ResultImage } from "./ResultImage";

interface Props {
  results: TaskViewResult[];
  onDeleted?: (id: string) => void;
}

export function ResultGrid({ results, onDeleted }: Props) {
  if (results.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
        暂无结果
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {results.map((r) => (
        <div key={r.id} className="aspect-[3/4]">
          <ResultImage result={r} onDelete={onDeleted} />
        </div>
      ))}
    </div>
  );
}
