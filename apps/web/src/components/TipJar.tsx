import { tipJar } from "@/content/landing";
import { PhoneShot } from "./PhoneShot";
import { Section } from "./Section";
import styles from "./TipJar.module.css";

export function TipJar() {
  return (
    <Section id={tipJar.id} title={tipJar.title}>
      <div className={styles.split}>
        <div className={styles.text}>
          <p className="lead">{tipJar.body}</p>
          <p className={styles.note}>{tipJar.note}</p>
        </div>
        <div className={styles.shot}>
          <PhoneShot id={tipJar.shot} size="sm" />
        </div>
      </div>
    </Section>
  );
}
