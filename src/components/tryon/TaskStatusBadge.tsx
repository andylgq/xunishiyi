import { cn } from "@/lib/utils";
import { TASK_STATUS_LABEL, type TaskStatusUnion } from "@/types/tryon";

const STYLES: Record<TaskStatusUnion, string> = {
  pending: "bg-blue-100 text-blue-700",
  submitted: "bg-blue-100 text-blue-700",
  processing: "bg-blue-100 text-blue-700",
  succeeded: "bg-green-100 text-green-700",
  failed: "bg-red-100 text-red-700",
  timeout: "bg-red-100 text-red-700",
  cancelled: "bg-gray-100 text-gray-600",
};

export function TaskStatusBadge({ status }: { status: string }) {
  const label = TASK_STATUS_LABEL[status as TaskStatusUnion] ?? status;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        STYLES[status as TaskStatusUnion] ?? "bg-gray-100 text-gray-600"
      )}
    >
      {label}
    </span>
  );
}
