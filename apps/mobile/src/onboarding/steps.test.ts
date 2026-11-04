import { nextStep } from "./steps";

describe("nextStep", () => {
  it("walks language -> currency -> lock -> done and stays done", () => {
    expect(nextStep("language")).toBe("currency");
    expect(nextStep("currency")).toBe("lock");
    expect(nextStep("lock")).toBe("done");
    expect(nextStep("done")).toBe("done");
  });
});
