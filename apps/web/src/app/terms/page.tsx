import type { Metadata } from "next";
import { LegalDocument } from "@/components/legal/LegalDocument";
import { PageSlip } from "@/components/PageSlip";
import { terms } from "@/content/terms";

export const metadata: Metadata = {
  title: terms.title,
  description: terms.summary,
  alternates: { canonical: "/terms" },
};

export default function Page() {
  return (
    <>
      <PageSlip title={terms.title} lead={terms.summary} />
      <LegalDocument doc={terms} />
    </>
  );
}
