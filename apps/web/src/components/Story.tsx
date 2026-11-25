import { story } from "@/content/landing";
import { PhoneShot } from "./PhoneShot";
import { Section } from "./Section";
import styles from "./Story.module.css";

/** The store listing's scenes, in store order: caption, a line of plain copy, the screenshot. Sides alternate on wide screens. */
export function Story() {
  return (
    <Section id={story.id} title={story.title}>
      <div className={styles.scenes}>
        {story.scenes.map((scene) => (
          <article className={styles.scene} key={scene.shot}>
            <div className={styles.text}>
              <h3>{scene.title}</h3>
              <p>{scene.body}</p>
            </div>
            <div className={styles.shot}>
              <PhoneShot id={scene.shot} />
            </div>
          </article>
        ))}
      </div>
    </Section>
  );
}
