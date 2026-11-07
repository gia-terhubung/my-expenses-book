import { act, render } from "@testing-library/react-native";
import { useEffect } from "react";

import { AppObscuredContext } from "./appObscured";
import { useWhenUnobscured } from "./useWhenUnobscured";

function Probe({ fn, fire }: { fn: () => void; fire: number }) {
  const defer = useWhenUnobscured();
  useEffect(() => {
    if (fire) defer(fn);
  }, [fire, defer, fn]);
  return null;
}

const ui = (obscured: boolean, fn: () => void, fire = 1) => (
  <AppObscuredContext.Provider value={obscured}>
    <Probe fn={fn} fire={fire} />
  </AppObscuredContext.Provider>
);

describe("useWhenUnobscured", () => {
  it("capture finishing while locked defers navigation until unlocked, then runs it once", async () => {
    const nav = jest.fn();
    const r = await render(ui(true, nav));
    await act(async () => {});
    expect(nav).not.toHaveBeenCalled();
    await r.rerender(ui(true, nav));
    expect(nav).not.toHaveBeenCalled();
    await r.rerender(ui(false, nav));
    await act(async () => {});
    expect(nav).toHaveBeenCalledTimes(1);
    await r.rerender(ui(true, nav));
    await r.rerender(ui(false, nav));
    expect(nav).toHaveBeenCalledTimes(1);
  });

  it("runs right away when not obscured", async () => {
    const nav = jest.fn();
    await render(ui(false, nav));
    await act(async () => {});
    expect(nav).toHaveBeenCalledTimes(1);
  });
});
