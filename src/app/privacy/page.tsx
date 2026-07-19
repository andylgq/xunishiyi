import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "隐私说明 — AI 虚拟试衣",
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <div className="mb-6 flex items-center gap-2">
        <ShieldCheck className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">隐私说明</h1>
      </div>

      <div className="prose prose-sm max-w-none space-y-4 text-muted-foreground">
        <section>
          <h2 className="text-base font-semibold text-foreground">数据用途</h2>
          <p>
            你上传的本人照片和服装图片仅用于本次虚拟试衣，生成试衣效果图。我们不会将你的图片用于任何其他目的。
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-foreground">数据保留与删除</h2>
          <ul className="ml-4 list-disc space-y-1">
            <li>未登录用户的图片在 24 小时内自动删除。</li>
            <li>试衣结果同样在 24 小时后自动清理。</li>
            <li>你可随时在结果页或上传页主动删除照片与结果。</li>
            <li>登录用户仅在主动选择后才保存默认试衣照，可随时更换或删除。</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-semibold text-foreground">模型训练</h2>
          <p>
            未经你的同意，我们不会使用你的照片训练任何模型。你的图片不会进入模型训练数据集。
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-foreground">数据公开</h2>
          <p>
            你的照片和结果不会向其他用户公开展示。所有图片访问均通过短期有效的私有链接，链接过期后无法访问。
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-foreground">传输与存储</h2>
          <p>
            数据传输使用加密通道。图片存储在受控环境中，访问需要短期有效的签名凭证。
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-foreground">第三方 AI 服务</h2>
          <p>
            为生成试衣效果，你的本人照片和服装图片会被发送至第三方虚拟试衣服务进行处理。该服务仅用于生成本次结果，处理完成后我们立即将结果下载到自有存储，第三方返回的临时链接将在 24 小时后失效。
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-foreground">使用规范</h2>
          <ul className="ml-4 list-disc space-y-1">
            <li>禁止未经他人许可上传他人照片。</li>
            <li>禁止上传色情、裸露或违法内容。</li>
            <li>禁止利用生成结果冒充、欺诈或骚扰他人。</li>
            <li>违反上述规范可能导致服务终止。</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-semibold text-foreground">结果性质</h2>
          <p>
            试衣结果仅供视觉参考，不代表真实尺码、松紧程度、面料触感和实际合身度。颜色、图案、Logo 可能存在细微差异。
          </p>
        </section>
      </div>

      <div className="mt-8">
        <Button asChild>
          <Link href="/tryon">开始试衣</Link>
        </Button>
      </div>
    </main>
  );
}
