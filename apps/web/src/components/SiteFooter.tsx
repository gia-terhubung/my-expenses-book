import Link from "next/link";
import { SITE } from "@/config/site";
import { LogoMark } from "./LogoMark";
import styles from "./SiteFooter.module.css";

export function SiteFooter() {
  return (
    <footer className={styles.footer}>
      <div className={`container ${styles.grid}`}>
        <div>
          <p className={styles.brand}>
            <LogoMark size={28} />
            <span>{SITE.name}</span>
          </p>
          <p className="small muted">
            Made by {SITE.legalEntity}, {SITE.country}.
          </p>
        </div>
        <nav aria-label="Footer">
          <ul className={styles.links}>
            <li>
              <Link href="/privacy">Privacy policy</Link>
            </li>
            <li>
              <Link href="/terms">Terms of use</Link>
            </li>
            <li>
              <a href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a>
            </li>
          </ul>
        </nav>
        <p className={`small muted ${styles.note}`}>This website uses no cookies and no analytics.</p>
      </div>
    </footer>
  );
}
