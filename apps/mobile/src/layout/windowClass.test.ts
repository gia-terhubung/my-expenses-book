import { windowClassFor } from "./windowClass";

describe("windowClassFor", () => {
  it.each([
    [0, "compact"],
    [599, "compact"],
    [600, "medium"],
    [839, "medium"],
    [840, "expanded"],
    [1280, "expanded"],
  ])("%i dp -> %s", (w, expected) => {
    expect(windowClassFor(w)).toBe(expected);
  });
});
