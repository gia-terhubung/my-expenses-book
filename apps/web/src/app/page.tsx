import { PageSlip } from "@/components/PageSlip";
import { hero } from "@/content/landing";

/** Scaffold stub: the hero slip only. Plan tasks 2 to 8 add the store badges, screenshot and sections. */
export default function HomePage() {
  return <PageSlip title={hero.title} lead={hero.lead} />;
}
