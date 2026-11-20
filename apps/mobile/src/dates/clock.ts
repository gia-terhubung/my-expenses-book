/** The app's wall clock for date-driven features (recurring catch-up). One place to override in dev. */
export function now(): Date {
  return new Date();
}
