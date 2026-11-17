import type { ReactNode } from "react";
import styles from "./PageSlip.module.css";

/**
 * The green slip that opens every page, directly under `SiteHeader`, ending in
 * the torn edge. Holds the page's single <h1>.
 *
 * - `title`: the <h1> text.
 * - `lead`: optional paragraph under the title.
 * - `children`: optional extra content inside the slip, below the lead
 *   (the landing page puts the store badges here).
 * - `aside`: optional second column on wide screens (the landing page puts
 *   the hero screenshot here). Below 900px it stacks under the text.
 */
export function PageSlip({
  title,
  lead,
  children,
  aside,
}: {
  title: string;
  lead?: string;
  children?: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <section className={`slip slip-torn ${styles.slip}`}>
      <div className={`container ${aside ? styles.split : ""}`}>
        <div className={styles.text}>
          <h1>{title}</h1>
          <span className={`total-bar ${styles.bar}`} aria-hidden="true" />
          {lead ? <p className={`lead ${styles.lead}`}>{lead}</p> : null}
          {children}
        </div>
        {aside ? <div className={styles.aside}>{aside}</div> : null}
      </div>
    </section>
  );
}
