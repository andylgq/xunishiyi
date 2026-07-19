"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useSubmitFeedback } from "@/hooks/useFeedback";
import {
  HELPFUL_LEVEL_LABEL,
  FEEDBACK_REASON_LABEL,
  type HelpfulLevelUnion,
  type FeedbackReasonUnion,
} from "@/types/tryon";

const LEVELS: HelpfulLevelUnion[] = [
  "very_helpful",
  "somewhat_helpful",
  "not_helpful",
];
const REASONS: FeedbackReasonUnion[] = [
  "not_like_self",
  "garment_mismatch",
  "body_pose_change",
  "unnatural_wearing",
  "background_change",
  "unclear",
  "other",
];

interface Props {
  taskId: string;
  disabled?: boolean;
}

export function FeedbackForm({ taskId, disabled }: Props) {
  const [level, setLevel] = useState<HelpfulLevelUnion | null>(null);
  const [selected, setSelected] = useState<Set<FeedbackReasonUnion>>(new Set());
  const [comment, setComment] = useState("");
  const mutation = useSubmitFeedback();

  const showReasons = level === "somewhat_helpful" || level === "not_helpful";

  function toggle(r: FeedbackReasonUnion) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(r)) next.delete(r);
      else next.add(r);
      return next;
    });
  }

  function submit() {
    if (!level) return;
    mutation.mutate({
      taskId,
      helpfulLevel: level,
      reasons: Array.from(selected),
      comment: comment.trim() || undefined,
    });
  }

  return (
    <div className="rounded-lg border bg-card p-5">
      <p className="mb-3 text-sm font-medium">
        这次试衣是否能帮助你判断衣服是否适合？
      </p>
      <div className="flex flex-wrap gap-2">
        {LEVELS.map((lv) => (
          <button
            key={lv}
            type="button"
            disabled={disabled || mutation.isSuccess}
            onClick={() => setLevel(lv)}
            className={cn(
              "rounded-md border px-3 py-1.5 text-sm transition disabled:opacity-50",
              level === lv
                ? "border-primary bg-primary text-primary-foreground"
                : "hover:bg-accent"
            )}
          >
            {HELPFUL_LEVEL_LABEL[lv]}
          </button>
        ))}
      </div>

      {showReasons && (
        <div className="mt-4">
          <p className="mb-2 text-xs text-muted-foreground">问题原因（可多选）</p>
          <div className="flex flex-wrap gap-2">
            {REASONS.map((r) => (
              <button
                key={r}
                type="button"
                disabled={disabled || mutation.isSuccess}
                onClick={() => toggle(r)}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-xs transition disabled:opacity-50",
                  selected.has(r)
                    ? "border-primary bg-accent text-accent-foreground"
                    : "hover:bg-accent"
                )}
              >
                {FEEDBACK_REASON_LABEL[r]}
              </button>
            ))}
          </div>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            disabled={disabled || mutation.isSuccess}
            maxLength={500}
            placeholder="其他想说的（可选，最多 500 字）"
            className="mt-3 min-h-[64px] w-full resize-y rounded-md border border-input bg-background p-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
      )}

      <div className="mt-4 flex items-center gap-3">
        <Button
          onClick={submit}
          disabled={!level || mutation.isPending || mutation.isSuccess}
        >
          {mutation.isSuccess ? "已提交" : mutation.isPending ? "提交中…" : "提交反馈"}
        </Button>
        {mutation.isSuccess && (
          <span className="text-xs text-muted-foreground">感谢你的反馈</span>
        )}
      </div>
    </div>
  );
}
