"use client";

import { useState } from "react";
import { Download, Share2, Trash2, ZoomIn } from "lucide-react";
import { toast } from "sonner";
import type { TaskViewResult } from "@/types/api";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface Props {
  result: TaskViewResult;
  onDelete?: (id: string) => void;
}

export function ResultImage({ result, onDelete }: Props) {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);

  async function handleSave() {
    try {
      const res = await fetch(result.url);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `tryon-${result.index + 1}.png`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("已保存到本地");
    } catch {
      toast.error("保存失败");
    }
  }

  async function handleShare() {
    try {
      if (navigator.share) {
        await navigator.share({
          title: "虚拟试衣效果",
          text: "看看我穿上这件衣服的效果",
          url: result.url,
        });
      } else {
        await navigator.clipboard.writeText(result.url);
        toast.success("图片链接已复制");
      }
    } catch {
      /* 用户取消分享，忽略 */
    }
  }

  async function handleDelete() {
    if (!onDelete) return;
    onDelete(result.id);
  }

  return (
    <>
      <div className="group relative overflow-hidden rounded-lg border bg-muted/20">
        {!loaded && (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
            加载中…
          </div>
        )}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={result.url}
          alt={`试衣结果 ${result.index + 1}`}
          onLoad={() => setLoaded(true)}
          className={`h-full w-full object-contain transition-opacity ${
            loaded ? "opacity-100" : "opacity-0"
          }`}
        />
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="absolute right-2 top-2 rounded-full bg-background/80 p-1.5 opacity-0 transition group-hover:opacity-100"
          aria-label="放大查看"
        >
          <ZoomIn className="h-4 w-4" />
        </button>
        <div className="absolute bottom-0 left-0 right-0 flex justify-end gap-1 bg-gradient-to-t from-black/50 to-transparent p-2 opacity-0 transition group-hover:opacity-100">
          <Button size="icon" variant="ghost" className="h-8 w-8 text-white hover:bg-white/20" onClick={handleSave} aria-label="保存">
            <Download className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" className="h-8 w-8 text-white hover:bg-white/20" onClick={handleShare} aria-label="分享">
            <Share2 className="h-4 w-4" />
          </Button>
          {onDelete && (
            <Button size="icon" variant="ghost" className="h-8 w-8 text-white hover:bg-white/20" onClick={handleDelete} aria-label="删除">
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl">
          <DialogTitle className="sr-only">试衣结果放大查看</DialogTitle>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={result.url}
            alt={`试衣结果 ${result.index + 1}`}
            className="max-h-[80vh] w-full object-contain"
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
