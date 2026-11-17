import Link from "next/link";
import { privacyPromise } from "@/content/landing";
import { Section } from "./Section";
import styles from "./PrivacyReceipt.module.css";

/** The privacy promise, with the zero-total till receipt. */
export function PrivacyReceipt() {
  const { receipt } = privacyPromise;
  return (
    <Section id={privacyPromise.id} title={privacyPromise.title}>
      <div className={styles.split}>
        <div className={styles.text}>
          <p className="lead">{privacyPromise.body}</p>
          <h3>{privacyPromise.networkTitle}</h3>
          <ol>
            {privacyPromise.network.map((item) => (
              <li key={item.name}>
                <strong>{item.name}</strong> {item.body}
              </li>
            ))}
          </ol>
          <p>
            <Link href={privacyPromise.linkHref}>{privacyPromise.linkLabel}</Link>
          </p>
        </div>
        <aside className={styles.paper} aria-label={receipt.heading}>
          <h3>{receipt.heading}</h3>
          <dl className={`${styles.rows} figures`}>
            {receipt.rows.map((row) => (
              <div className={styles.row} key={row.label}>
                <dt>{row.label}</dt>
                <dd>{row.value}</dd>
              </div>
            ))}
            <div className={`${styles.row} ${styles.total}`}>
              <dt>{receipt.totalLabel}</dt>
              <dd>{receipt.totalValue}</dd>
            </div>
          </dl>
        </aside>
      </div>
    </Section>
  );
}
