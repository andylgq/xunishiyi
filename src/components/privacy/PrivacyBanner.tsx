import { AlertTriangle } from "lucide-react";

export function PrivacyBanner() {
  return (
    <div className="mt-6 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>
        结果仅供视觉参考，不代表真实尺码和合身度。颜色、图案、Logo 可能存在细微差异。
      </span>
    </div>
  );
}
