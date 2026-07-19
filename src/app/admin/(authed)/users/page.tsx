"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { DataTable, Pagination, type Column } from "@/components/admin/DataTable";

interface QuotaInfo {
  total: number;
  used: number;
  reserved: number;
  periodStartAt: string;
}
interface UserRow {
  id: string;
  anonUid: string;
  isAnonymous: boolean;
  email: string | null;
  createdAt: string;
  lastSeenAt: string;
  quota: QuotaInfo | null;
}

const PAGE_SIZE = 20;

export default function AdminUsersPage() {
  const [rows, setRows] = useState<UserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<"all" | "exhausted" | "active7d">("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Quota adjust dialog
  const [adjustUser, setAdjustUser] = useState<UserRow | null>(null);
  const [newTotal, setNewTotal] = useState("");
  const [adjusting, setAdjusting] = useState(false);
  const [adjustError, setAdjustError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
      });
      if (filter !== "all") params.set("filter", filter);
      const res = await fetch(`/api/admin/users?${params}`);
      if (!res.ok) throw new Error(`加载失败 (${res.status})`);
      const data = await res.json();
      setRows(data.rows);
      setTotal(data.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [page, filter]);

  useEffect(() => {
    load();
  }, [load]);

  function openAdjust(user: UserRow) {
    setAdjustUser(user);
    setNewTotal(String(user.quota?.total ?? 5));
    setAdjustError(null);
  }

  async function submitAdjust() {
    if (!adjustUser) return;
    const v = Number(newTotal);
    if (!Number.isInteger(v) || v < 1 || v > 100) {
      setAdjustError("额度必须是 1-100 的整数");
      return;
    }
    setAdjusting(true);
    setAdjustError(null);
    try {
      const res = await fetch(
        `/api/admin/users/${adjustUser.id}/quota`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "set_total", value: v }),
        }
      );
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d?.error?.message ?? `失败 (${res.status})`);
      }
      setAdjustUser(null);
      await load();
    } catch (e) {
      setAdjustError(e instanceof Error ? e.message : String(e));
    } finally {
      setAdjusting(false);
    }
  }

  async function resetPeriod(user: UserRow) {
    if (!confirm(`确认重置用户 ${user.anonUid.slice(0, 8)} 的额度周期？已用将归零。`)) return;
    try {
      const res = await fetch(`/api/admin/users/${user.id}/quota`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset_period" }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d?.error?.message ?? `失败 (${res.status})`);
      }
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    }
  }

  const columns: Column<UserRow>[] = [
    {
      key: "anonUid",
      header: "匿名 ID",
      render: (r) => (
        <span className="font-mono text-xs">
          {r.anonUid.slice(0, 12)}…
          <span className="ml-1 text-muted-foreground">
            {r.isAnonymous ? "(匿名)" : "(注册)"}
          </span>
        </span>
      ),
    },
    {
      key: "email",
      header: "邮箱",
      render: (r) => r.email ?? <span className="text-muted-foreground">—</span>,
    },
    {
      key: "quota",
      header: "额度",
      render: (r) =>
        r.quota ? (
          <span>
            <span className="font-medium">{r.quota.used}</span>
            <span className="text-muted-foreground"> / {r.quota.total}</span>
            {r.quota.reserved > 0 && (
              <span className="ml-1 text-amber-600">(+{r.quota.reserved}预占)</span>
            )}
          </span>
        ) : (
          <span className="text-muted-foreground">未初始化</span>
        ),
    },
    {
      key: "lastSeenAt",
      header: "最近活跃",
      render: (r) => formatTime(r.lastSeenAt),
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
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => openAdjust(r)}>
            调整额度
          </Button>
          <Button size="sm" variant="ghost" onClick={() => resetPeriod(r)}>
            重置周期
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">用户管理</h1>
        <div className="flex gap-2">
          {(["all", "exhausted", "active7d"] as const).map((f) => (
            <Button
              key={f}
              size="sm"
              variant={filter === f ? "default" : "outline"}
              onClick={() => {
                setFilter(f);
                setPage(1);
              }}
            >
              {f === "all" ? "全部" : f === "exhausted" ? "额度用尽" : "7 天活跃"}
            </Button>
          ))}
        </div>
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
            empty="暂无用户"
          />
          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            total={total}
            onPageChange={setPage}
          />
        </>
      )}

      {/* Quota adjust dialog */}
      <Dialog
        open={adjustUser !== null}
        onOpenChange={(o) => !o && setAdjustUser(null)}
      >
        <DialogContent className="max-w-md">
          <DialogTitle>调整用户额度</DialogTitle>
          <DialogDescription>
            用户 {adjustUser?.anonUid.slice(0, 12)}…
            <br />
            当前总额度：{adjustUser?.quota?.total ?? 0}，已用：
            {adjustUser?.quota?.used ?? 0}
          </DialogDescription>

          <div className="space-y-2 py-2">
            <Label htmlFor="newTotal">新的总额度（1-100）</Label>
            <Input
              id="newTotal"
              type="number"
              min={1}
              max={100}
              value={newTotal}
              onChange={(e) => setNewTotal(e.target.value)}
              disabled={adjusting}
            />
            {adjustError && (
              <p className="text-sm text-destructive">{adjustError}</p>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setAdjustUser(null)}
              disabled={adjusting}
            >
              取消
            </Button>
            <Button onClick={submitAdjust} disabled={adjusting}>
              {adjusting ? (
                <>
                  <Spinner className="mr-2" /> 提交中…
                </>
              ) : (
                "确认"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
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
  if (diff < 7 * 86400_000) return `${Math.floor(diff / 86400_000)} 天前`;
  return d.toLocaleDateString("zh-CN");
}
