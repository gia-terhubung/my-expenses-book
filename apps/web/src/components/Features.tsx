import { features } from "@/content/landing";
import { PhoneShot } from "./PhoneShot";
import { Section } from "./Section";
import styles from "./Features.module.css";

export function Features() {
  return (
    <Section id={features.id} title={features.title}>
      <div className={styles.split}>
        <dl className={styles.list}>
          {features.items.map((item) => (
            <div className={styles.item} key={item.name}>
              <dt>{item.name}</dt>
              <dd>{item.body}</dd>
            </div>
          ))}
        </dl>
        <div className={styles.shot}>
          <PhoneShot id={features.shot} />
        </div>
      </div>
    </Section>
  );
}
