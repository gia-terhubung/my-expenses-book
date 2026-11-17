import type { Metadata } from "next";
import { LegalDocument } from "@/components/legal/LegalDocument";
import { PageSlip } from "@/components/PageSlip";
import { privacy } from "@/content/privacy";

export const metadata: Metadata = {
  title: privacy.title,
  description: privacy.summary,
  alternates: { canonical: "/privacy" },
};

export default function Page() {
  return (
    <>
      <PageSlip title={privacy.title} lead={privacy.summary} />
      <LegalDocument doc={privacy} />
    </>
  );
}
