import { GuideFlow } from "@/guide/GuideFlow";

/**
 * First-run flow: the guide in first-run mode. The current step lives in prefs (not component
 * state), so a relaunch resumes it; the guide never remounts its pickers on rotation or unfold.
 */
export function OnboardingFlow() {
  return <GuideFlow mode="firstRun" />;
}
