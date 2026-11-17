/**
 * Mono logo mark (from docs/design/logo/meb-long-page-mono.svg), drawn in `currentColor`.
 * Decorative: always paired with the visible app name, so it is hidden from assistive tech.
 */
export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg
      viewBox="236 236 552 552"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
      fill="currentColor"
    >
      <g transform="translate(512,512) rotate(-6) scale(.93) translate(-512,-545)">
        <path fillRule="evenodd" d="M300,328 h176 a20,20 0 0 1 20,20 v224 a20,20 0 0 1 -20,20 h-176 a20,20 0 0 1 -20,-20 v-224 a20,20 0 0 1 20,-20 Z M528,348 a20,20 0 0 1 20,-20 H724 a20,20 0 0 1 20,20 V790 h-14 a22,22 0 0 0 -44,0 h-14 h-14 a22,22 0 0 0 -44,0 h-14 h-14 a22,22 0 0 0 -44,0 h-14 Z M327,372 h122 a15,15 0 0 1 15,15 v0 a15,15 0 0 1 -15,15 h-122 a15,15 0 0 1 -15,-15 v0 a15,15 0 0 1 15,-15 Z M327,428 h122 a15,15 0 0 1 15,15 v0 a15,15 0 0 1 -15,15 h-122 a15,15 0 0 1 -15,-15 v0 a15,15 0 0 1 15,-15 Z M327,484 h66 a15,15 0 0 1 15,15 v0 a15,15 0 0 1 -15,15 h-66 a15,15 0 0 1 -15,-15 v0 a15,15 0 0 1 15,-15 Z M575,372 h122 a15,15 0 0 1 15,15 v0 a15,15 0 0 1 -15,15 h-122 a15,15 0 0 1 -15,-15 v0 a15,15 0 0 1 15,-15 Z M575,428 h66 a15,15 0 0 1 15,15 v0 a15,15 0 0 1 -15,15 h-66 a15,15 0 0 1 -15,-15 v0 a15,15 0 0 1 15,-15 Z M575,484 h122 a15,15 0 0 1 15,15 v0 a15,15 0 0 1 -15,15 h-122 a15,15 0 0 1 -15,-15 v0 a15,15 0 0 1 15,-15 Z M585,668 h102 a25,25 0 0 1 25,25 v0 a25,25 0 0 1 -25,25 h-102 a25,25 0 0 1 -25,-25 v0 a25,25 0 0 1 25,-25 Z " />
      </g>
    </svg>
  );
}
