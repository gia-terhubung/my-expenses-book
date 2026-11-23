import { nextStep, prevStep, SETUP_STEPS } from "./steps";

describe("nextStep", () => {
  it("walks language -> currency -> taxYear -> payCycle -> lock -> tour -> done and stays done", () => {
    expect(nextStep("language")).toBe("currency");
    expect(nextStep("currency")).toBe("taxYear");
    expect(nextStep("taxYear")).toBe("payCycle");
    expect(nextStep("payCycle")).toBe("lock");
    expect(nextStep("lock")).toBe("tour");
    expect(nextStep("tour")).toBe("done");
    expect(nextStep("done")).toBe("done");
  });

  it("legacy stored lock continues to the tour", () => {
    expect(nextStep("lock")).toBe("tour");
  });
});

describe("prevStep", () => {
  it("is the inverse of nextStep and stops at language", () => {
    expect(prevStep("currency")).toBe("language");
    expect(prevStep("taxYear")).toBe("currency");
    expect(prevStep("payCycle")).toBe("taxYear");
    expect(prevStep("lock")).toBe("payCycle");
    expect(prevStep("tour")).toBe("lock");
    expect(prevStep("language")).toBe("language");
  });
});

it("SETUP_STEPS lists the five setup steps in order", () => {
  expect(SETUP_STEPS).toEqual(["language", "currency", "taxYear", "payCycle", "lock"]);
});
