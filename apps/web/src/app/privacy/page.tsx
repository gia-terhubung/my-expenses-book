import type { Metadata } from "next";
import { PageSlip } from "@/components/PageSlip";
import { privacy } from "@/content/privacy";

export const metadata: Metadata = {
  title: privacy.title,
  description: privacy.summary,
  alternates: { canonical: "/privacy" },
};

/** Scaffold stub: the slip only. Plan task 9 renders the document body with `LegalDocument`. */
export default function Page() {
  return <PageSlip title={privacy.title} lead={privacy.summary} />;
}
