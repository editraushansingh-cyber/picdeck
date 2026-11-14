import type { Metadata } from "next";
import { CodeEntryForm } from "@/components/CodeEntryForm";

export const metadata: Metadata = { title: "Client gallery — PicDeck" };

// This route reads the session cookie, event params or search params on every request.
export const instant = false;

export default async function GalleryEntryPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const { code } = await searchParams;
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-5 py-12">
      <CodeEntryForm initialCode={code ?? ""} />
    </div>
  );
}
