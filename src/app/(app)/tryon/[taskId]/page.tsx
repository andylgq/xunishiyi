import { ResultView } from "@/components/tryon/ResultView";

export const dynamic = "force-dynamic";

export default async function TaskPage({
  params,
}: {
  params: Promise<{ taskId: string }>;
}) {
  const { taskId } = await params;
  return <ResultView taskId={taskId} />;
}
