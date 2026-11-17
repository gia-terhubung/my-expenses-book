import { howItWorks } from "@/content/landing";
import { PhoneShot } from "./PhoneShot";
import { Section } from "./Section";
import styles from "./HowItWorks.module.css";

export function HowItWorks() {
  return (
    <Section id={howItWorks.id} title={howItWorks.title}>
      <ol className={styles.steps}>
        {howItWorks.steps.map((step) => (
          <li key={step.name}>
            <PhoneShot id={step.shot} size="sm" />
            <h3>{step.name}</h3>
            <p>{step.body}</p>
          </li>
        ))}
      </ol>
    </Section>
  );
}
