import Image from "next/image";
import { SHOTS, SHOT_HEIGHT, SHOT_WIDTH, shotSrc, type Shot, type ShotId } from "@/content/screenshots";
import styles from "./PhoneShot.module.css";

/** A screenshot in a phone-shaped frame, or a marked placeholder until `ready` is true. */
export function PhoneShot({
  id,
  size = "md",
  eager = false,
  shots = SHOTS,
}: {
  id: ShotId;
  size?: "md" | "sm";
  eager?: boolean;
  shots?: Record<ShotId, Shot>;
}) {
  const shot = shots[id];
  return (
    <div className={styles.frame} data-size={size}>
      {shot.ready ? (
        <Image
          src={shotSrc(id)}
          alt={shot.alt}
          width={SHOT_WIDTH}
          height={SHOT_HEIGHT}
          loading={eager ? "eager" : "lazy"}
          fetchPriority={eager ? "high" : undefined}
          className={styles.screen}
        />
      ) : (
        <div
          role="img"
          aria-label={"Screenshot placeholder: " + shot.screen}
          data-placeholder={id}
          className={`${styles.screen} ${styles.placeholder}`}
        >
          <span>Screenshot placeholder</span>
          <span>{shot.screen}</span>
          <span>{`${id}.webp`}</span>
        </div>
      )}
    </div>
  );
}
