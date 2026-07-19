"use client";

import { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, CheckCircle2, AlertCircle, RefreshCw } from "lucide-react";
import { useUploadFlow } from "@/hooks/useUpload";
import { useTryonStore, type UploadView } from "@/stores/tryon-store";
import { ACCEPTED_MIME, LIMITS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

interface Props {
  role: "person" | "garment";
  title: string;
  tips: string[];
  /** 受控值（来自 store） */
  value: UploadView | null;
  onChange: (v: UploadView | null) => void;
}

export function ImageUploader({ role, title, tips, value, onChange }: Props) {
  const flow = useUploadFlow(role);

  const onDrop = useCallback(
    async (files: File[]) => {
      const file = files[0];
      if (!file) return;
      const next = await flow.start(file);
      if (next) onChange(next);
    },
    [flow, onChange]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED_MIME.reduce(
      (acc, t) => ({ ...acc, [t]: [] }),
      {} as Record<string, string[]>
    ),
    maxFiles: 1,
    maxSize: LIMITS.MAX_UPLOAD_BYTES,
    disabled: flow.status === "uploading" || flow.status === "checking",
  });

  const display = value ?? flow.view;
  const busy = flow.status === "uploading" || flow.status === "checking";
  const previewUrl = display?.previewUrl;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">{title}</h3>
        {display && (
          <Button
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={() => {
              flow.reset();
              onChange(null);
            }}
          >
            <RefreshCw className="mr-1 h-3 w-3" /> 重新上传
          </Button>
        )}
      </div>

      {!display ? (
        <div
          {...getRootProps()}
          className={cn(
            "flex min-h-[220px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-input bg-muted/30 p-6 text-center transition hover:border-primary hover:bg-accent/40",
            isDragActive && "border-primary bg-accent/60",
            busy && "pointer-events-none opacity-60"
          )}
        >
          <input {...getInputProps()} />
          <Upload className="mb-3 h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium">
            {busy ? "处理中…" : "点击或拖拽上传图片"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            JPG / PNG / WebP，单张 ≤ {LIMITS.MAX_UPLOAD_BYTES / 1024 / 1024}MB，短边 ≥ {LIMITS.MIN_SHORT_SIDE}px
          </p>
          {busy && (
            <div className="mt-4 w-full max-w-[200px]">
              <Progress value={flow.progress} />
            </div>
          )}
        </div>
      ) : (
        <div className="relative overflow-hidden rounded-lg border bg-muted/20">
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt={title}
              className="h-[260px] w-full object-contain"
            />
          ) : (
            <div className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">
              预览不可用
            </div>
          )}
          <div className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-background/90 px-2 py-0.5 text-xs">
            <CheckCircle2 className="h-3 w-3 text-green-600" />
            预检通过
          </div>
        </div>
      )}

      {flow.status === "error" && flow.error && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{flow.error}</span>
        </div>
      )}

      <ul className="space-y-0.5 text-xs text-muted-foreground">
        {tips.map((t) => (
          <li key={t} className="flex gap-1.5">
            <span className="text-primary">·</span>
            <span>{t}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
