"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

interface CleanupResult {
  removedUploads: number;
  removedResults: number;
  total: number;
}

export function CleanupCard() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CleanupResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runCleanup() {
    if (
      !confirm(
        "确认手动清理过期数据？\n\n将软删除所有已过期的 uploads 和 results（含文件）。此操作不可逆。"
      )
    ) {
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/admin/cleanup", { method: "POST" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d?.error?.message ?? `失败 (${res.status})`);
      }
      const data = await res.json();
      setResult({
        removedUploads: data.removedUploads,
        removedResults: data.removedResults,
        total: data.total,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>手动清理过期数据</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-3 text-sm text-muted-foreground">
          软删除所有已过期的 uploads 和 results（含本地文件）。正常情况下 cron
          会自动执行；此按钮用于手动触发。
        </p>
        <Button onClick={runCleanup} disabled={loading} variant="outline">
          {loading ? (
            <>
              <Spinner className="mr-2" /> 清理中…
            </>
          ) : (
            "执行清理"
          )}
        </Button>
        {error && (
          <p className="mt-2 text-sm text-destructive">{error}</p>
        )}
        {result && (
          <p className="mt-2 text-sm text-emerald-600">
            ✅ 清理完成：{result.removedUploads} 个上传 +{" "}
            {result.removedResults} 个结果（共 {result.total} 项）
          </p>
        )}
      </CardContent>
    </Card>
  );
}
