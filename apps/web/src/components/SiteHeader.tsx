import Image from "next/image";
import Link from "next/link";
import { SITE } from "@/config/site";
import styles from "./SiteHeader.module.css";

/** Top bar. It is slip green so that it joins the page's `PageSlip` directly below it. */
export function SiteHeader() {
  return (
    <header className={`slip ${styles.header}`}>
      <div className={`container ${styles.row}`}>
        <Link href="/" className={styles.brand}>
          <Image src="/logo/meb-long-page.svg" alt="" width={36} height={36} className={styles.icon} loading="eager" />
          <span className={styles.name}>{SITE.name}</span>
        </Link>
        <nav aria-label="Legal">
          <ul className={styles.nav}>
            <li>
              <Link href="/privacy">Privacy</Link>
            </li>
            <li>
              <Link href="/terms">Terms</Link>
            </li>
          </ul>
        </nav>
      </div>
    </header>
  );
}
