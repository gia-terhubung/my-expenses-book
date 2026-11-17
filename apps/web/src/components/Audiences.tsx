import { audiences } from "@/content/landing";
import { Section } from "./Section";
import styles from "./Audiences.module.css";

export function Audiences() {
  return (
    <Section id={audiences.id} title={audiences.title} band>
      <ul className={styles.list}>
        {audiences.items.map((item) => (
          <li key={item.name}>
            <h3>{item.name}</h3>
            <p>{item.body}</p>
          </li>
        ))}
      </ul>
    </Section>
  );
}
