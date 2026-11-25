import { devices } from "@/content/landing";
import { SHOTS } from "@/content/screenshots";
import { PhoneShot } from "./PhoneShot";
import { Section } from "./Section";
import styles from "./Devices.module.css";

/**
 * The iPhone Duo folded and unfolded, side by side. Each column is as wide as its screenshot, so the two
 * screens keep their true size against each other at every width.
 */
export function Devices() {
  const columns = devices.shots.map((s) => `${SHOTS[s.shot].width}fr`).join(" ");
  return (
    <Section id={devices.id} title={devices.title} band>
      <p className={`lead ${styles.body}`}>{devices.body}</p>
      <div className={styles.pair} style={{ gridTemplateColumns: columns }}>
        {devices.shots.map((s) => (
          <figure className={styles.figure} key={s.shot}>
            <PhoneShot id={s.shot} fluid />
            <figcaption>{s.caption}</figcaption>
          </figure>
        ))}
      </div>
    </Section>
  );
}
