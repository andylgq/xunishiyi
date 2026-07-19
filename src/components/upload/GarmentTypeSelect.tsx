"use client";

import { cn } from "@/lib/utils";
import { GARMENT_TYPE_LABEL, type GarmentTypeUnion } from "@/types/tryon";

interface Props {
  value: GarmentTypeUnion;
  onChange: (v: GarmentTypeUnion) => void;
  disabled?: boolean;
}

const OPTIONS: GarmentTypeUnion[] = ["upper", "outer"];

export function GarmentTypeSelect({ value, onChange, disabled }: Props) {
  return (
    <div className="inline-flex rounded-md border bg-muted/30 p-1">
      {OPTIONS.map((opt) => (
        <button
          key={opt}
          type="button"
          disabled={disabled}
          onClick={() => onChange(opt)}
          className={cn(
            "rounded-sm px-4 py-1.5 text-sm font-medium transition disabled:opacity-50",
            value === opt
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {GARMENT_TYPE_LABEL[opt]}
        </button>
      ))}
    </div>
  );
}
