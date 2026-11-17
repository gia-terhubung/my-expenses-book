import { STORE_BADGE_FILES, STORE_LINKS } from "@/config/site";
import { storeBadges } from "@/content/landing";
import styles from "./StoreBadges.module.css";

type Links = { appStore: string | null; googlePlay: string | null };

function comingSoonText(links: Links): string | null {
  if (!links.appStore && !links.googlePlay) return storeBadges.comingSoonBoth;
  if (!links.appStore) return storeBadges.comingSoonAppStore;
  if (!links.googlePlay) return storeBadges.comingSoonGooglePlay;
  return null;
}

/**
 * Official store badges for the hero slip. A store without a URL gets no badge
 * (the artwork may not be altered or disabled); a plain text line says it is coming.
 */
export function StoreBadges({ links = STORE_LINKS }: { links?: Links }) {
  const soon = comingSoonText(links);
  const live = [
    { key: "app-store", href: links.appStore, src: STORE_BADGE_FILES.appStore, alt: storeBadges.appStoreAlt },
    { key: "google-play", href: links.googlePlay, src: STORE_BADGE_FILES.googlePlay, alt: storeBadges.googlePlayAlt },
  ].filter((b): b is typeof b & { href: string } => Boolean(b.href));

  return (
    <div className={styles.wrap}>
      {live.length > 0 ? (
        <ul className={styles.list} aria-label="Get the app">
          {live.map((b) => (
            <li key={b.key}>
              <a className={styles.link} href={b.href} data-store={b.key}>
                {/* Official SVG artwork must be shown unaltered: plain img, no optimiser. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className={styles[b.key === "app-store" ? "apple" : "google"]} src={b.src} alt={b.alt} />
              </a>
            </li>
          ))}
        </ul>
      ) : null}
      {soon ? <p className={`slip-muted ${styles.soon}`}>{soon}</p> : null}
    </div>
  );
}
