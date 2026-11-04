import type { Prefs } from "@/prefs/prefs";

type Step = Prefs["onboardingStep"];

const NEXT: Record<Step, Step> = { language: "currency", currency: "lock", lock: "done", done: "done" };

export function nextStep(step: Step): Step {
  return NEXT[step];
}
