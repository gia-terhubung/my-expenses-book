import { STORE_LINKS } from "@/config/site";
import { storeBadges } from "@/content/landing";
import styles from "./StoreBadges.module.css";

type Links = { appStore: string | null; googlePlay: string | null };

function Badge({ store, name, href }: { store: "app-store" | "google-play"; name: string; href: string | null }) {
  const inner = (
    <>
      <span className={styles.top}>{href ? storeBadges.download : storeBadges.comingSoon}</span>{" "}
      <span className={styles.name}>{name}</span>
    </>
  );
  if (href) {
    return (
      <a className={`${styles.badge} ${styles.live}`} href={href} data-store={store} data-state="live">
        {inner}
      </a>
    );
  }
  return (
    <span className={`${styles.badge} ${styles.soon}`} data-store={store} data-state="soon">
      {inner}
    </span>
  );
}

/** Store buttons for the hero slip. A store with a null URL is a disabled "Coming soon" badge. */
export function StoreBadges({ links = STORE_LINKS }: { links?: Links }) {
  return (
    <ul className={styles.list} aria-label="Get the app">
      <li>
        <Badge store="app-store" name={storeBadges.appStore} href={links.appStore} />
      </li>
      <li>
        <Badge store="google-play" name={storeBadges.googlePlay} href={links.googlePlay} />
      </li>
    </ul>
  );
}
