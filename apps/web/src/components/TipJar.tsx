import { tipJar } from "@/content/landing";
import { Section } from "./Section";
import styles from "./TipJar.module.css";

export function TipJar() {
  return (
    <Section id={tipJar.id} title={tipJar.title}>
      <div className={styles.text}>
        <p className="lead">{tipJar.body}</p>
        <p className={styles.note}>{tipJar.note}</p>
      </div>
    </Section>
  );
}
