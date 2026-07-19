"use client";

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import type { QuotaView } from "@/types/api";

export function QuotaBadge() {
  const [q, setQ] = useState<QuotaView | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/quota")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (alive && d) setQ(d as QuotaView);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  if (!q) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">
      <Sparkles className="h-3 w-3" />
      今日剩余 {q.remaining}/{q.total}
    </span>
  );
}
