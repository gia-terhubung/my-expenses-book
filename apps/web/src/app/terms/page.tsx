import type { Metadata } from "next";
import { PageSlip } from "@/components/PageSlip";
import { terms } from "@/content/terms";

export const metadata: Metadata = {
  title: terms.title,
  description: terms.summary,
  alternates: { canonical: "/terms" },
};

/** Scaffold stub: the slip only. Plan task 9 renders the document body with `LegalDocument`. */
export default function Page() {
  return <PageSlip title={terms.title} lead={terms.summary} />;
}
