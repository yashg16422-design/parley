import { AskView } from "@/components/ask/ask-view";
import { PageHeader } from "@/components/page-header";
import { currentUser } from "@/queries";

export default async function AskPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await currentUser();
  const { q } = await searchParams;
  return (
    <>
      <PageHeader title="Ask Parley" subtitle="Questions across every call, answered with citations to the exact moment." />
      <AskView initial={q?.slice(0, 500)} />
    </>
  );
}
