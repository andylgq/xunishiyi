import Link from "next/link";
import { TeamSection } from "@/components/home/TeamSection";

export default function HomePage() {
  return (
    <main className="min-h-screen">
      <section className="flex min-h-[70vh] flex-col items-center justify-center px-6 text-center">
        <span className="inline-flex items-center rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">
          V1 原型 · 仅供视觉参考
        </span>
        <h1 className="mt-6 text-4xl sm:text-5xl font-bold tracking-tight text-purple-600">
          看见自己穿上它的样子
        </h1>
        <p className="mt-4 max-w-xl text-muted-foreground">
          上传你的照片和一件上衣或外套的商品图，AI 会生成多张试衣效果图，
          帮你判断这件衣服是否适合你。
        </p>
        <div className="mt-8 flex gap-3">
          <Link
            href="/tryon"
            className="inline-flex h-11 items-center justify-center rounded-lg bg-primary px-6 text-sm font-medium text-primary-foreground transition hover:opacity-90"
          >
            开始试衣
          </Link>
          <Link
            href="/privacy"
            className="inline-flex h-11 items-center justify-center rounded-lg border border-input px-6 text-sm font-medium transition hover:bg-accent"
          >
            隐私说明
          </Link>
        </div>
        <p className="mt-10 max-w-md text-xs text-muted-foreground">
          你的照片仅用于本次试衣，24 小时内自动删除，不会公开，也不会用于模型训练。
        </p>
      </section>

      <TeamSection />
    </main>
  );
}
