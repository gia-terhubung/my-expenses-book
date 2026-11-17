import type { ReactNode } from "react";
import styles from "./Section.module.css";

/** A landing page section: container, h2 and content. `band` gives it the tonal background. */
export function Section({
  id,
  title,
  band = false,
  children,
}: {
  id: string;
  title: string;
  band?: boolean;
  children: ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={id + "-title"} className={`${styles.section}${band ? ` ${styles.band}` : ""}`}>
      <div className="container">
        <h2 id={id + "-title"}>{title}</h2>
        {children}
      </div>
    </section>
  );
}
