export type WindowClass = "compact" | "medium" | "expanded";

/** Material window size classes by width in dp. Never branch on device model. */
export function windowClassFor(widthDp: number): WindowClass {
  if (widthDp < 600) return "compact";
  if (widthDp < 840) return "medium";
  return "expanded";
}
