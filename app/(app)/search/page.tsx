import { PageHeader } from "@/components/page-header";
import { SearchView } from "@/components/search/search-view";

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  return (
    <>
      <PageHeader title="Search" subtitle="Every word from every call. Synonyms like SSO and single sign-on match each other." />
      <SearchView initial={q} />
    </>
  );
}
