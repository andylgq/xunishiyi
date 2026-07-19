"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { type FeedbackReq } from "@/types/api";

export function useSubmitFeedback() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: FeedbackReq) => {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          (data as { error?: { message?: string } })?.error?.message ??
            `提交失败 (${res.status})`
        );
      }
      return data;
    },
    onSuccess: () => {
      toast.success("感谢反馈！");
      qc.invalidateQueries({ queryKey: ["task"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
