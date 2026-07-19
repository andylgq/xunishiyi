"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";
import { useTryonStore } from "@/stores/tryon-store";
import { ImageUploader } from "@/components/upload/ImageUploader";
import { GarmentTypeSelect } from "@/components/upload/GarmentTypeSelect";
import { UploadTips } from "@/components/upload/UploadTips";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import type { CreateTaskRes } from "@/types/api";

const PERSON_TIPS = [
  "单人正面，半身或全身",
  "人脸清晰，上半身完整",
  "光线充足，无严重滤镜",
];
const GARMENT_TIPS = [
  "仅一件上衣或外套，正面完整",
  "背景干净，无模特穿着",
  "无遮挡、贴纸或大面积文字",
];

export default function TryonPage() {
  const router = useRouter();
  const {
    personUpload,
    garmentUpload,
    garmentType,
    setPerson,
    setGarment,
    setGarmentType,
    defaultPerson,
    setDefaultPerson,
    clearAll,
  } = useTryonStore();
  const [submitting, setSubmitting] = useState(false);
  const [useDefault, setUseDefault] = useState(false);

  // 进入页面时，若有默认试衣照则预填
  useEffect(() => {
    if (!personUpload && defaultPerson) {
      setPerson(defaultPerson);
      setUseDefault(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const canSubmit = !!personUpload && !!garmentUpload && !submitting;

  async function handleSubmit() {
    if (!personUpload || !garmentUpload) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/tryon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          personUploadId: personUpload.uploadId,
          garmentUploadId: garmentUpload.uploadId,
          garmentType,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          (data as { error?: { message?: string } })?.error?.message ??
            `创建任务失败 (${res.status})`
        );
      }
      const { taskId } = data as CreateTaskRes;
      // 清理服装图（保留 person 以便继续试穿）
      setGarment(null);
      router.push(`/tryon/${taskId}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "创建任务失败");
    } finally {
      setSubmitting(false);
    }
  }

  function handleReset() {
    clearAll();
    setUseDefault(false);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">开始试衣</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          上传你的照片和一件上衣或外套，AI 将生成多张试衣效果图。
        </p>
      </div>

      <UploadTips />

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-3">
          <ImageUploader
            role="person"
            title="本人照片"
            tips={PERSON_TIPS}
            value={personUpload}
            onChange={(v) => {
              setPerson(v);
              if (v && useDefault) setUseDefault(false);
            }}
          />
          {personUpload && (
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={useDefault}
                onChange={(e) => {
                  setUseDefault(e.target.checked);
                  setDefaultPerson(e.target.checked ? personUpload : null);
                }}
              />
              设为默认试衣照（后续可复用）
            </label>
          )}
        </div>

        <div className="space-y-3">
          <div>
            <h3 className="mb-2 text-sm font-medium">服装类型</h3>
            <GarmentTypeSelect
              value={garmentType}
              onChange={setGarmentType}
              disabled={submitting}
            />
          </div>
          <ImageUploader
            role="garment"
            title="服装图片"
            tips={GARMENT_TIPS}
            value={garmentUpload}
            onChange={setGarment}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button size="lg" onClick={handleSubmit} disabled={!canSubmit}>
          {submitting ? (
            <>
              <Spinner className="mr-1.5 h-4 w-4" /> 提交中…
            </>
          ) : (
            <>
              <Sparkles className="mr-1.5 h-4 w-4" /> 开始试穿
            </>
          )}
        </Button>
        {(personUpload || garmentUpload) && (
          <Button variant="ghost" onClick={handleReset} disabled={submitting}>
            清空重选
          </Button>
        )}
      </div>
    </div>
  );
}
