"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { DataTable, Pagination, type Column } from "@/components/admin/DataTable";

interface TaskRow {
  id: string;
  userId: string;
  status: string;
  garmentType: string;
  providerName: string;
  attemptCount: number;
  lastErrorCode: string | null;
  createdAt: string;
  submittedAt: string | null;
  completedAt: string | null;
  resultCount: number;
}

const PAGE_SIZE = 20;

const STATUS_LABELS: Record<string, string> = {
  pending: "待处理",
  submitted: "已提交",
  processing: "处理中",
  succeeded: "成功",
  failed: "失败",
  timeout: "超时",
  cancelled: "已取消",
};

const STATUS_TONES: Record<string, string> = {
  pending: "bg-muted text-muted-foreground",
  submitted: "bg-blue-100 text-blue-700",
  processing: "bg-amber-100 text-amber-700",
  succeeded: "bg-emerald-100 text-emerald-700",
  failed: "bg-red-100 text-red-700",
  timeout: "bg-orange-100 text-orange-700",
  cancelled: "bg-gray-200 text-gray-700",
};

export default function AdminTasksPage() {
  const [rows, setRows] = useState<TaskRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
        status,
      });
      const res = await fetch(`/api/admin/tasks?${params}`);
      if (!res.ok) throw new Error(`加载失败 (${res.status})`);
      const data = await res.json();
      setRows(data.rows);
      setTotal(data.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [page, status]);

  useEffect(() => {
    load();
  }, [load]);

  const columns: Column<TaskRow>[] = [
    {
      key: "id",
      header: "任务 ID",
      render: (r) => (
        <Link
          href={`/admin/tasks/${r.id}`}
          className="font-mono text-xs text-primary hover:underline"
        >
          {r.id.slice(0, 8)}…
        </Link>
      ),
    },
    {
      key: "status",
      header: "状态",
      render: (r) => (
        <span
          className={`inline-block rounded px-2 py-0.5 text-xs ${STATUS_TONES[r.status] ?? ""}`}
        >
          {STATUS_LABELS[r.status] ?? r.status}
        </span>
      ),
    },
    {
      key: "garmentType",
      header: "类型",
      render: (r) => (r.garmentType === "upper" ? "上衣" : "外套"),
    },
    {
      key: "providerName",
      header: "Provider",
      render: (r) => <span className="font-mono text-xs">{r.providerName}</span>,
    },
    {
      key: "resultCount",
      header: "结果",
      render: (r) => r.resultCount,
    },
    {
      key: "lastErrorCode",
      header: "错误",
      render: (r) =>
        r.lastErrorCode ? (
          <span className="text-xs text-destructive" title={r.lastErrorCode}>
            {r.lastErrorCode}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: "createdAt",
      header: "创建时间",
      render: (r) => formatTime(r.createdAt),
    },
    {
      key: "actions",
      header: "操作",
      render: (r) => (
        <Link href={`/admin/tasks/${r.id}`}>
          <Button size="sm" variant="outline">
            详情
          </Button>
        </Link>
      ),
    },
  ];

  const statusFilters = [
    "all",
    "pending",
    "submitted",
    "processing",
    "succeeded",
    "failed",
    "timeout",
    "cancelled",
  ];

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">任务管理</h1>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {statusFilters.map((s) => (
          <Button
            key={s}
            size="sm"
            variant={status === s ? "default" : "outline"}
            onClick={() => {
              setStatus(s);
              setPage(1);
            }}
          >
            {s === "all" ? "全部" : STATUS_LABELS[s] ?? s}
          </Button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Spinner /> 加载中…
        </div>
      ) : error ? (
        <p className="text-destructive">{error}</p>
      ) : (
        <>
          <DataTable
            columns={columns}
            rows={rows}
            rowKey={(r) => r.id}
            empty="暂无任务"
          />
          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            total={total}
            onPageChange={setPage}
          />
        </>
      )}
    </div>
  );
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60_000) return "刚刚";
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)} 小时前`;
  return d.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
