import { features } from "@/content/landing";
import { Section } from "./Section";
import styles from "./Features.module.css";

export function Features() {
  return (
    <Section id={features.id} title={features.title}>
      <dl className={styles.list}>
        {features.items.map((item) => (
          <div className={styles.item} key={item.name}>
            <dt>{item.name}</dt>
            <dd>{item.body}</dd>
          </div>
        ))}
      </dl>
    </Section>
  );
}
