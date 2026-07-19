"use client";

import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import {
  type InitiateUploadReq,
  type InitiateUploadRes,
  type UploadCheckRes,
} from "@/types/api";
import type { UploadView } from "@/stores/tryon-store";

type Status = "idle" | "uploading" | "checking" | "ready" | "error";

async function apiFetch<T>(
  url: string,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(url, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      (data as { error?: { message?: string } })?.error?.message ??
      `请求失败 (${res.status})`;
    throw new Error(msg);
  }
  return data as T;
}

/**
 * 上传流程：initiate → upload → check。
 * 返回最终 UploadView（含预检通过后由 check 接口附带的预览 URL）。
 */
export function useUploadFlow(role: "person" | "garment") {
  const [status, setStatus] = useState<Status>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<UploadView | null>(null);
  const xhrRef = useRef<XMLHttpRequest | null>(null);

  const reset = useCallback(() => {
    setStatus("idle");
    setProgress(0);
    setError(null);
    if (xhrRef.current) {
      xhrRef.current.abort();
      xhrRef.current = null;
    }
  }, []);

  const start = useCallback(
    async (file: File): Promise<UploadView | null> => {
      setError(null);
      try {
        // 1. initiate
        setStatus("uploading");
        setProgress(5);
        const initBody: InitiateUploadReq = {
          role,
          contentType: file.type as InitiateUploadReq["contentType"],
          sizeBytes: file.size,
        };
        const init = await apiFetch<InitiateUploadRes>("/api/uploads/initiate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(initBody),
        });

        // 2. upload（用 XHR 拿进度）
        await new Promise<void>((resolve, reject) => {
          const fd = new FormData();
          fd.append("file", file);
          fd.append("uploadId", init.uploadId);
          const xhr = new XMLHttpRequest();
          xhrRef.current = xhr;
          xhr.open("POST", "/api/uploads/upload");
          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
              setProgress(5 + Math.round((e.loaded / e.total) * 70));
            }
          };
          xhr.onload = () =>
            xhr.status >= 200 && xhr.status < 300
              ? resolve()
              : reject(new Error(`上传失败 (${xhr.status})`));
          xhr.onerror = () => reject(new Error("网络错误"));
          xhr.send(fd);
        });

        // 3. check
        setStatus("checking");
        setProgress(80);
        const check = await apiFetch<UploadCheckRes>("/api/uploads/check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ uploadId: init.uploadId }),
        });

        setProgress(100);
        if (!check.passed) {
          setStatus("error");
          setError(check.summary || "预检未通过");
          return null;
        }
        const next: UploadView = {
          uploadId: init.uploadId,
          previewUrl: check.previewUrl ?? null,
          thumbUrl: null,
          passed: true,
        };
        setView(next);
        setStatus("ready");
        return next;
      } catch (e) {
        const msg = e instanceof Error ? e.message : "上传失败";
        setStatus("error");
        setError(msg);
        toast.error(msg);
        return null;
      }
    },
    [role]
  );

  return { status, progress, error, view, start, reset };
}
