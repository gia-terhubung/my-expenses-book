import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import { useReducedMotion } from "react-native-reanimated";

import { initI18n } from "@/i18n";
import { createFakeTipJar } from "@/payments/fakeTipJar";

import { TipJarScreen } from "./TipJarScreen";

const reducedMotion = useReducedMotion as jest.Mock;
const flat = (node: { props: { style?: unknown } }) => StyleSheet.flatten(node.props.style as object) as Record<string, unknown>;
const hidden = { includeHiddenElements: true };
const IDS = ["tip_coffee_small", "tip_coffee_standard", "tip_coffee_generous"];

beforeAll(() => initI18n("en"));

const LABELS = ["Espresso, $2.99", "Coffee, $4.99", "Generous coffee, $9.99"];

describe("TipJarScreen", () => {
  it("connects on mount, lists the three tiers with store prices, disconnects on unmount", async () => {
    const jar = createFakeTipJar();
    const { unmount } = await render(<TipJarScreen jar={jar} />);
    expect(jar.connects).toBe(1);
    const buttons = await screen.findAllByRole("button", { name: /\$/ });
    expect(buttons.map((b) => b.props.accessibilityLabel)).toEqual(LABELS);
    await act(async () => unmount());
    expect(jar.disconnects).toBe(1);
  });

  it("shows unavailable with Retry when the store connection fails", async () => {
    const jar = createFakeTipJar({ failConnect: true });
    await render(<TipJarScreen jar={jar} />);
    expect(await screen.findByText(/Tips aren't available right now/)).toBeTruthy();
    await fireEvent.press(screen.getByText("Try again"));
    expect(jar.connects).toBe(2);
  });

  it("shows unavailable when the store returns no products", async () => {
    await render(<TipJarScreen jar={createFakeTipJar({ products: [] })} />);
    expect(await screen.findByText(/Tips aren't available right now/)).toBeTruthy();
  });

  it("buys the tapped tier and disables every tier while buying", async () => {
    const jar = createFakeTipJar();
    await render(<TipJarScreen jar={jar} />);
    await fireEvent.press(await screen.findByLabelText("Coffee, $4.99"));
    expect(jar.bought).toEqual(["tip_coffee_standard"]);
    for (const l of LABELS) expect(screen.getByLabelText(l).props.accessibilityState).toMatchObject({ disabled: true });
  });

  it("returns to ready with no message when the user cancels", async () => {
    const jar = createFakeTipJar();
    await render(<TipJarScreen jar={jar} />);
    await fireEvent.press(await screen.findByLabelText("Coffee, $4.99"));
    await act(async () => jar.emit({ kind: "cancelled" }));
    expect(screen.getByLabelText("Coffee, $4.99").props.accessibilityState).toMatchObject({ disabled: false });
    expect(screen.queryByText(/didn't go through/)).toBeNull();
  });

  it("shows the failure copy inline", async () => {
    const jar = createFakeTipJar();
    await render(<TipJarScreen jar={jar} />);
    await fireEvent.press(await screen.findByLabelText("Espresso, $2.99"));
    await act(async () => jar.emit({ kind: "failed", code: "E_NETWORK" }));
    expect(screen.getByText("The purchase didn't go through. You weren't charged.")).toBeTruthy();
  });

  it("thanks the user, also for a purchase replayed before any tap", async () => {
    const jar = createFakeTipJar();
    await render(<TipJarScreen jar={jar} />);
    await screen.findByLabelText("Coffee, $4.99");
    await act(async () => jar.emit({ kind: "thanks", id: "tip_coffee_generous" }));
    expect(screen.getAllByText("Thank you so much! Your coffee means a lot and helps keep this app independent.")).toHaveLength(1);
  });
});

describe("TipJarScreen final-review fixes", () => {
  afterEach(() => jest.useRealTimers());

  it("a buy() rejected with user-cancelled shows no failure text (C1)", async () => {
    const jar = createFakeTipJar({ buyRejects: { code: "user-cancelled" } });
    await render(<TipJarScreen jar={jar} />);
    await fireEvent.press(await screen.findByLabelText("Coffee, $4.99"));
    await act(async () => jar.emit({ kind: "cancelled" }));
    expect(screen.queryByText(/didn't go through/)).toBeNull();
    expect(screen.getByLabelText("Coffee, $4.99").props.accessibilityState).toMatchObject({ disabled: false });
  });

  it("a buy() rejected with a real error shows the failure text", async () => {
    const jar = createFakeTipJar({ buyRejects: { code: "E_NETWORK" } });
    await render(<TipJarScreen jar={jar} />);
    await fireEvent.press(await screen.findByLabelText("Coffee, $4.99"));
    expect(await screen.findByText("The purchase didn't go through. You weren't charged.")).toBeTruthy();
  });

  it("a store that never answers becomes unavailable after the timeout (I2)", async () => {
    jest.useFakeTimers();
    const jar = createFakeTipJar({ hangConnect: true });
    await render(<TipJarScreen jar={jar} />);
    await act(async () => jest.advanceTimersByTime(15_000));
    expect(screen.getByText(/Tips aren't available right now/)).toBeTruthy();
  });

  it("buttons come back when the purchase request resolves with no event (I3)", async () => {
    jest.useFakeTimers();
    const jar = createFakeTipJar();
    await render(<TipJarScreen jar={jar} />);
    await act(async () => {});
    await fireEvent.press(screen.getByLabelText("Coffee, $4.99"));
    await act(async () => jest.advanceTimersByTime(3_000));
    expect(screen.getByLabelText("Coffee, $4.99").props.accessibilityState).toMatchObject({ disabled: false });
  });

  it("pending and finishLater events show their own copy, never 'not charged'", async () => {
    const jar = createFakeTipJar();
    await render(<TipJarScreen jar={jar} />);
    await screen.findByLabelText("Coffee, $4.99");
    await act(async () => jar.emit({ kind: "pending" }));
    expect(screen.getByText("Your payment is pending. The tip completes once the store confirms it.")).toBeTruthy();
    await act(async () => jar.emit({ kind: "finishLater" }));
    expect(screen.getByText("Your tip went through. It finishes the next time you open the tip jar.")).toBeTruthy();
    expect(screen.queryByText(/weren't charged/)).toBeNull();
  });
});

describe("TipJarScreen revamp", () => {
  afterEach(() => reducedMotion.mockReturnValue(false));

  it("gives every tier an icon that screen readers skip", async () => {
    await render(<TipJarScreen jar={createFakeTipJar()} />);
    await screen.findByLabelText("Coffee, $4.99");
    for (const id of IDS) {
      const icon = screen.getByTestId(`tip-icon-${id}`, hidden);
      expect(icon.props.accessibilityElementsHidden).toBe(true);
      expect(icon.props.importantForAccessibility).toBe("no-hide-descendants");
    }
    expect(screen.queryByTestId("tip-icon-tip_coffee_small")).toBeNull();
  });

  it("shows what each tier is for, and says tips are optional", async () => {
    await render(<TipJarScreen jar={createFakeTipJar()} />);
    await screen.findByLabelText("Coffee, $4.99");
    expect(screen.getByText("A quick thank-you.")).toBeTruthy();
    expect(screen.getByText(/Tips are entirely optional/)).toBeTruthy();
    expect(screen.getByRole("header", { name: "Buy the developer a coffee?" })).toBeTruthy();
  });

  it("prices shrink to fit instead of ellipsizing", async () => {
    await render(<TipJarScreen jar={createFakeTipJar()} />);
    const price = await screen.findByText("$4.99");
    expect(price.props).toMatchObject({ numberOfLines: 1, adjustsFontSizeToFit: true });
  });

  it("drifts the backdrop shapes, hidden from screen readers", async () => {
    await render(<TipJarScreen jar={createFakeTipJar()} />);
    await screen.findByLabelText("Coffee, $4.99");
    const backdrop = screen.getByTestId("tip-backdrop", hidden);
    expect(backdrop.props).toMatchObject({ accessibilityElementsHidden: true, importantForAccessibility: "no-hide-descendants", pointerEvents: "none" });
    const shapes = screen.getAllByTestId(/^tip-drift-/, hidden);
    expect(shapes.length).toBeGreaterThanOrEqual(3);
    expect(shapes.length).toBeLessThanOrEqual(5);
    for (const s of shapes) {
      expect(flat(s).animationName).toBeTruthy();
      expect(flat(s).animationPlayState).toBe("running");
    }
  });

  it("pauses the drift when the screen is not focused", async () => {
    await render(<TipJarScreen jar={createFakeTipJar()} paused />);
    await screen.findByLabelText("Coffee, $4.99");
    for (const s of screen.getAllByTestId(/^tip-drift-/, hidden)) expect(flat(s).animationPlayState).toBe("paused");
  });

  it("reduce motion: shapes stay still and a pressed tier does not scale", async () => {
    reducedMotion.mockReturnValue(true);
    await render(<TipJarScreen jar={createFakeTipJar()} />);
    const tier = await screen.findByLabelText("Coffee, $4.99");
    for (const s of screen.getAllByTestId(/^tip-drift-/, hidden)) expect(flat(s).animationName).toBeUndefined();
    await fireEvent(tier, "pressIn");
    expect(flat(screen.getByTestId("tip-tier-tip_coffee_standard")).transform).toBeUndefined();
  });

  it("a pressed tier scales down a touch when motion is allowed", async () => {
    await render(<TipJarScreen jar={createFakeTipJar()} />);
    const tier = await screen.findByLabelText("Coffee, $4.99");
    await fireEvent(tier, "pressIn");
    expect(flat(screen.getByTestId("tip-tier-tip_coffee_standard")).transform).toEqual([{ scale: 0.97 }]);
    await fireEvent(tier, "pressOut");
    expect(flat(screen.getByTestId("tip-tier-tip_coffee_standard")).transform).toEqual([{ scale: 1 }]);
  });

  it("tiers are at least 48 dp tall", async () => {
    await render(<TipJarScreen jar={createFakeTipJar()} />);
    await screen.findByLabelText("Coffee, $4.99");
    expect(Number(flat(screen.getByTestId("tip-tier-tip_coffee_small")).minHeight)).toBeGreaterThanOrEqual(48);
  });
});
