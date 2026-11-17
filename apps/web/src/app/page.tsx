import { Audiences } from "@/components/Audiences";
import { Features } from "@/components/Features";
import { HowItWorks } from "@/components/HowItWorks";
import { PageSlip } from "@/components/PageSlip";
import { PhoneShot } from "@/components/PhoneShot";
import { PrivacyReceipt } from "@/components/PrivacyReceipt";
import { StoreBadges } from "@/components/StoreBadges";
import { hero } from "@/content/landing";
import styles from "./page.module.css";

export default function HomePage() {
  return (
    <>
      <PageSlip title={hero.title} lead={hero.lead} overhang aside={<PhoneShot id={hero.shot} eager />}>
        <StoreBadges />
        <p className={`small slip-muted ${styles.note}`}>{hero.note}</p>
      </PageSlip>
      <HowItWorks />
      <PrivacyReceipt />
      <Features />
      <Audiences />
    </>
  );
}
