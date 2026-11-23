import type { OnboardingStep } from "@/prefs/prefs";

/** The setup steps of the guide, in order; "tour" (the how-it-works cards) and "done" follow. */
export const SETUP_STEPS = ["language", "currency", "taxYear", "payCycle", "lock"] as const;

const NEXT: Record<OnboardingStep, OnboardingStep> = {
  language: "currency",
  currency: "taxYear",
  taxYear: "payCycle",
  payCycle: "lock",
  lock: "tour",
  tour: "done",
  done: "done",
};

const PREV: Record<OnboardingStep, OnboardingStep> = {
  language: "language",
  currency: "language",
  taxYear: "currency",
  payCycle: "taxYear",
  lock: "payCycle",
  tour: "lock",
  done: "done",
};

export function nextStep(step: OnboardingStep): OnboardingStep {
  return NEXT[step];
}

export function prevStep(step: OnboardingStep): OnboardingStep {
  return PREV[step];
}
