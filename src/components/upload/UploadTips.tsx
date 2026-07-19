import { Info } from "lucide-react";

export function UploadTips() {
  return (
    <div className="rounded-lg border border-primary/20 bg-accent/40 p-4 text-sm">
      <div className="mb-2 flex items-center gap-1.5 font-medium text-accent-foreground">
        <Info className="h-4 w-4" />
        上传建议
      </div>
      <div className="grid gap-3 text-xs text-muted-foreground sm:grid-cols-2">
        <div>
          <p className="mb-1 font-medium text-foreground">本人照片</p>
          <ul className="space-y-0.5">
            <li>· 单人正面或接近正面，半身或全身</li>
            <li>· 人脸清晰，上半身完整</li>
            <li>· 双手和头发不大面积遮挡服装</li>
            <li>· 光线充足、图片清晰，无严重滤镜</li>
          </ul>
        </div>
        <div>
          <p className="mb-1 font-medium text-foreground">服装图片</p>
          <ul className="space-y-0.5">
            <li>· 仅一件上衣或外套，正面完整展示</li>
            <li>· 背景干净，无模特穿着</li>
            <li>· 无明显遮挡、贴纸或大面积文字</li>
            <li>· 不支持裤子、裙子、鞋包、配饰</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
