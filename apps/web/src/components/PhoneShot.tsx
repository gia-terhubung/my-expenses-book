import Image from "next/image";
import { SHOTS, shotSrc, type ShotId } from "@/content/screenshots";
import styles from "./PhoneShot.module.css";

/**
 * A screenshot in a device-shaped frame. The frame follows the shot's device (iPhone, Duo outer, Duo inner).
 *
 * - `fluid`: drop the per-device maximum width and fill the parent (the Duo pair sizes its own columns).
 */
export function PhoneShot({ id, eager = false, fluid = false }: { id: ShotId; eager?: boolean; fluid?: boolean }) {
  const shot = SHOTS[id];
  return (
    <div className={styles.frame} data-device={shot.device} data-fluid={fluid || undefined}>
      <Image
        src={shotSrc(id)}
        alt={shot.alt}
        width={shot.width}
        height={shot.height}
        loading={eager ? "eager" : "lazy"}
        fetchPriority={eager ? "high" : undefined}
        className={styles.screen}
        style={{ aspectRatio: `${shot.width} / ${shot.height}` }}
      />
    </div>
  );
}
