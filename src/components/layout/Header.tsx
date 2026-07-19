import Link from "next/link";
import { QuotaBadge } from "@/components/tryon/QuotaBadge";

export function Header() {
  return (
    <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-1.5 font-semibold">
          <span className="inline-block h-6 w-6 rounded-md bg-primary" />
          虚拟试衣
        </Link>
        <div className="flex items-center gap-4">
          <QuotaBadge />
          <Link
            href="/privacy"
            className="text-sm text-muted-foreground transition hover:text-foreground"
          >
            隐私说明
          </Link>
        </div>
      </div>
    </header>
  );
}
