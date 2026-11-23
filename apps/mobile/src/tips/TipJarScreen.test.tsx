import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import { useReducedMotion } from "react-native-reanimated";

import { initI18n } from "@/i18n";
import { createFakeTipJar } from "@/payments/fakeTipJar";
import type { TipProduct } from "@/payments/types";

import { tokens } from "@/theme/tokens";

import { TipJarScreen } from "./TipJarScreen";

const light = tokens.light.colors;

// Jest's default window is 750 wide at font scale 2; the screen lays out by both.
const mockWindow = { width: 360, height: 800, scale: 2, fontScale: 1 };
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 34, left: 0, right: 0 }),
}));
jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({ __esModule: true, default: () => mockWindow }));

const reducedMotion = useReducedMotion as jest.Mock;
const flat = (node: { props: { style?: unknown } }) => StyleSheet.flatten(node.props.style as object) as Record<string, unknown>;
const hidden = { includeHiddenElements: true };
const IDS = ["tip_coffee_small", "tip_coffee_standard", "tip_coffee_generous"];

beforeAll(() => initI18n("en"));

const LABELS = ["Espresso, $2.99", "Black coffee, $4.99", "Cappuccino, $9.99"];

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
    await fireEvent.press(await screen.findByLabelText("Black coffee, $4.99"));
    expect(jar.bought).toEqual(["tip_coffee_standard"]);
    for (const l of LABELS) expect(screen.getByLabelText(l).props.accessibilityState).toMatchObject({ disabled: true });
  });

  it("returns to ready with no message when the user cancels", async () => {
    const jar = createFakeTipJar();
    await render(<TipJarScreen jar={jar} />);
    await fireEvent.press(await screen.findByLabelText("Black coffee, $4.99"));
    await act(async () => jar.emit({ kind: "cancelled" }));
    expect(screen.getByLabelText("Black coffee, $4.99").props.accessibilityState).toMatchObject({ disabled: false });
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
    await screen.findByLabelText("Black coffee, $4.99");
    await act(async () => jar.emit({ kind: "thanks", id: "tip_coffee_generous" }));
    expect(screen.getAllByText("Thank you so much! Your coffee means a lot and helps keep this app independent.")).toHaveLength(1);
  });
});

describe("TipJarScreen final-review fixes", () => {
  afterEach(() => jest.useRealTimers());

  it("a buy() rejected with user-cancelled shows no failure text (C1)", async () => {
    const jar = createFakeTipJar({ buyRejects: { code: "user-cancelled" } });
    await render(<TipJarScreen jar={jar} />);
    await fireEvent.press(await screen.findByLabelText("Black coffee, $4.99"));
    await act(async () => jar.emit({ kind: "cancelled" }));
    expect(screen.queryByText(/didn't go through/)).toBeNull();
    expect(screen.getByLabelText("Black coffee, $4.99").props.accessibilityState).toMatchObject({ disabled: false });
  });

  it("a buy() rejected with a real error shows the failure text", async () => {
    const jar = createFakeTipJar({ buyRejects: { code: "E_NETWORK" } });
    await render(<TipJarScreen jar={jar} />);
    await fireEvent.press(await screen.findByLabelText("Black coffee, $4.99"));
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
    await fireEvent.press(screen.getByLabelText("Black coffee, $4.99"));
    await act(async () => jest.advanceTimersByTime(3_000));
    expect(screen.getByLabelText("Black coffee, $4.99").props.accessibilityState).toMatchObject({ disabled: false });
  });

  it("pending and finishLater events show their own copy, never 'not charged'", async () => {
    const jar = createFakeTipJar();
    await render(<TipJarScreen jar={jar} />);
    await screen.findByLabelText("Black coffee, $4.99");
    await act(async () => jar.emit({ kind: "pending" }));
    expect(screen.getByText("Your payment is pending. The tip completes once the store confirms it.")).toBeTruthy();
    await act(async () => jar.emit({ kind: "finishLater" }));
    expect(screen.getByText("Your tip went through. It finishes the next time you open the tip jar.")).toBeTruthy();
    expect(screen.queryByText(/weren't charged/)).toBeNull();
  });
});

describe("TipJarScreen café counter", () => {
  afterEach(() => {
    reducedMotion.mockReturnValue(false);
    mockWindow.fontScale = 1;
  });

  const ready = async (props: { paused?: boolean } = {}) => {
    await render(<TipJarScreen jar={createFakeTipJar()} {...props} />);
    return screen.findByLabelText("Black coffee, $4.99");
  };
  const beans = () => screen.getAllByTestId(/^tip-bean-\d+$/, hidden);
  const drifting = () => beans().filter((b) => flat(b).animationName);

  it("draws one cup per tier, hidden from screen readers, with no icon font", async () => {
    await ready();
    for (const id of IDS) {
      const cup = screen.getByTestId(`tip-cup-${id}`, hidden);
      expect(cup.props).toMatchObject({ accessibilityElementsHidden: true, importantForAccessibility: "no-hide-descendants" });
      expect(screen.queryByTestId(`tip-cup-${id}`)).toBeNull();
    }
    expect(screen.queryByTestId(/^tip-icon-/, hidden)).toBeNull();
  });

  it("the espresso is a short pour, the black coffee a full mug", async () => {
    await ready();
    const liquid = (id: string) => Number(flat(screen.getByTestId(`tip-liquid-${id}`, hidden)).height);
    const body = (id: string) => Number(flat(screen.getByTestId(`tip-body-${id}`, hidden)).height);
    expect(liquid("tip_coffee_small")).toBeLessThan(liquid("tip_coffee_standard"));
    expect(liquid("tip_coffee_small") / body("tip_coffee_small")).toBeLessThanOrEqual(0.5);
    expect(liquid("tip_coffee_standard") / body("tip_coffee_standard")).toBeGreaterThanOrEqual(0.8);
    expect(body("tip_coffee_small")).toBeLessThan(body("tip_coffee_standard"));
  });

  it("only the cappuccino has foam, with cocoa dots", async () => {
    await ready();
    expect(screen.getAllByTestId("tip-foam", hidden)).toHaveLength(1);
    expect(screen.getAllByTestId("tip-cocoa", hidden).length).toBeGreaterThanOrEqual(3);
  });

  it("the cappuccino price pill is yellow with ink text; the others are green", async () => {
    await ready();
    expect(flat(screen.getByTestId("tip-price-tip_coffee_generous")).backgroundColor).toBe(light.highlight);
    expect(flat(screen.getByText("$9.99")).color).toBe(light.onHighlight);
    expect(flat(screen.getByTestId("tip-price-tip_coffee_small")).backgroundColor).toBe(light.primary);
    expect(flat(screen.getByText("$2.99")).color).toBe(light.onPrimary);
  });

  it("shows what each tier is for, and says tips are optional", async () => {
    await ready();
    expect(screen.getByText("A quick thank-you.", hidden)).toBeTruthy();
    expect(screen.getByText(/Tips are entirely optional/)).toBeTruthy();
    expect(screen.getByRole("header", { name: "Buy the developer a coffee?" })).toBeTruthy();
  });

  it("prices shrink to fit instead of ellipsizing", async () => {
    await ready();
    expect(screen.getByText("$4.99").props).toMatchObject({ numberOfLines: 1, adjustsFontSizeToFit: true });
  });

  it("scatters 10 to 14 faint beans behind the content; only 2 or 3 drift", async () => {
    await ready();
    const backdrop = screen.getByTestId("tip-backdrop", hidden);
    expect(backdrop.props).toMatchObject({ accessibilityElementsHidden: true, importantForAccessibility: "no-hide-descendants", pointerEvents: "none" });
    expect(beans().length).toBeGreaterThanOrEqual(10);
    expect(beans().length).toBeLessThanOrEqual(14);
    expect(drifting().length).toBeGreaterThanOrEqual(2);
    expect(drifting().length).toBeLessThanOrEqual(3);
    for (const b of drifting()) expect(flat(b).animationPlayState).toBe("running");
    expect(screen.getAllByTestId("tip-bean-seam", hidden)).toHaveLength(beans().length);
  });

  it("pauses the drift when the screen is not focused", async () => {
    await ready({ paused: true });
    for (const b of drifting()) expect(flat(b).animationPlayState).toBe("paused");
  });

  it("reduce motion: every bean is still and a pressed cup does not lift", async () => {
    reducedMotion.mockReturnValue(true);
    const tier = await ready();
    expect(drifting()).toHaveLength(0);
    await fireEvent(tier, "pressIn");
    expect(flat(screen.getByTestId("tip-cup-tip_coffee_standard", hidden)).transform).toBeUndefined();
  });

  it("a pressed cup lifts 2 dp when motion is allowed", async () => {
    const tier = await ready();
    const lift = () => flat(screen.getByTestId("tip-cup-tip_coffee_standard", hidden)).transform;
    await fireEvent(tier, "pressIn");
    expect(lift()).toEqual([{ translateY: -2 }]);
    await fireEvent(tier, "pressOut");
    expect(lift()).toEqual([{ translateY: 0 }]);
  });

  it("stands the cups side by side on the counter, each a 48 dp target", async () => {
    await ready();
    expect(screen.getByText("Cappuccino", hidden).props).toMatchObject({ numberOfLines: 1, adjustsFontSizeToFit: true });
    expect(flat(screen.getByTestId("tip-counter")).flexDirection).toBe("row");
    for (const l of LABELS) {
      const s = flat(screen.getByLabelText(l));
      expect(Number(s.minHeight)).toBeGreaterThanOrEqual(48);
      expect(Number(s.minWidth)).toBeGreaterThanOrEqual(48);
    }
  });

  it("at large text sizes the cups stack so names and prices keep their room", async () => {
    mockWindow.fontScale = 2;
    await ready();
    expect(flat(screen.getByTestId("tip-counter")).flexDirection).toBe("column");
    expect(screen.getByText("Cappuccino", hidden).props.numberOfLines).toBeUndefined();
  });
});

describe("TipJarScreen without store prices", () => {
  const product = (id: (typeof IDS)[number], displayPrice: string) => ({ id, displayPrice, title: id }) as TipProduct;
  const prices = () => screen.queryAllByTestId(/^tip-price-/);
  const cups = () => IDS.map((id) => screen.getByTestId(`tip-cup-${id}`, hidden));
  const NAMES = ["Espresso", "Black coffee", "Cappuccino"];

  it.each([
    ["no products", []],
    ["products with blank prices", IDS.map((id) => product(id, " "))],
  ])("%s: unavailable notice, cups shown but not buyable, no price tag at all", async (_name, products) => {
    const jar = createFakeTipJar({ products });
    await render(<TipJarScreen jar={jar} />);
    expect(await screen.findByText(/Tips aren't available right now/)).toBeTruthy();
    expect(screen.getByText("Try again")).toBeTruthy();
    expect(cups()).toHaveLength(3);
    // Pills stay as disabled placeholders: never yellow, never a price.
    expect(prices()).toHaveLength(3);
    for (const pill of prices()) expect(flat(pill).backgroundColor).toBe(light.tonal);
    expect(screen.getAllByText("–")).toHaveLength(3);
    expect(screen.queryByText(/\$/)).toBeNull();
    for (const n of NAMES) {
      const tier = screen.getByRole("button", { name: n });
      expect(tier.props.accessibilityLabel).toBe(n);
      expect(tier.props.accessibilityState).toMatchObject({ disabled: true });
      await fireEvent.press(tier);
    }
    expect(jar.bought).toEqual([]);
  });

  it("Try again reconnects from the blank-price state", async () => {
    const jar = createFakeTipJar({ products: IDS.map((id) => product(id, "")) });
    await render(<TipJarScreen jar={jar} />);
    await fireEvent.press(await screen.findByText("Try again"));
    expect(jar.connects).toBe(2);
  });

  it("a single tier the store did not price is shown without a price and cannot be bought", async () => {
    const jar = createFakeTipJar({ products: [product("tip_coffee_small", "$2.99"), product("tip_coffee_generous", "")] });
    await render(<TipJarScreen jar={jar} />);
    await screen.findByLabelText("Espresso, $2.99");
    expect(screen.queryByText(/Tips aren't available right now/)).toBeNull();
    expect(flat(screen.getByTestId("tip-price-tip_coffee_generous")).backgroundColor).toBe(light.tonal);
    expect(screen.getAllByText("–")).toHaveLength(2);
    for (const n of ["Black coffee", "Cappuccino"]) {
      await fireEvent.press(screen.getByRole("button", { name: n }));
      expect(screen.getByRole("button", { name: n }).props.accessibilityState).toMatchObject({ disabled: true });
    }
    expect(jar.bought).toEqual([]);
  });

  it("while connecting: cups with a muted placeholder price, no yellow tag, nothing buyable", async () => {
    const jar = createFakeTipJar({ hangConnect: true });
    await render(<TipJarScreen jar={jar} />);
    expect(screen.getByLabelText("Loading tips…")).toBeTruthy();
    expect(cups()).toHaveLength(3);
    const placeholders = screen.getAllByText("…");
    expect(placeholders).toHaveLength(3);
    for (const p of placeholders) expect(flat(p).color).toBe(light.textMuted);
    for (const id of IDS) expect(flat(screen.getByTestId(`tip-price-${id}`)).backgroundColor).toBe(light.tonal);
    for (const n of NAMES) {
      await fireEvent.press(screen.getByRole("button", { name: n }));
      expect(screen.getByRole("button", { name: n }).props.accessibilityState).toMatchObject({ disabled: true });
    }
    expect(jar.bought).toEqual([]);
  });

  it("a price always has a definite width to shrink into", async () => {
    await render(<TipJarScreen jar={createFakeTipJar()} />);
    await screen.findByLabelText("Black coffee, $4.99");
    for (const price of ["$2.99", "$4.99", "$9.99"]) expect(flat(screen.getByText(price)).alignSelf).toBe("stretch");
  });
});

describe("TipJarScreen price buttons", () => {
  const ready = async (jar = createFakeTipJar()) => {
    await render(<TipJarScreen jar={jar} />);
    await screen.findByLabelText("Black coffee, $4.99");
    return jar;
  };

  it("each tier has exactly one button: the price pill, labelled name and price", async () => {
    await ready();
    // The page's back chevron is the one button outside the tiers.
    const buttons = screen.getAllByRole("button").filter((b) => b.props.accessibilityLabel !== "Back");
    expect(buttons.map((b) => b.props.accessibilityLabel)).toEqual(LABELS);
    expect(buttons.map((b) => b.props.testID)).toEqual(IDS.map((id) => `tip-price-${id}`));
    // The name and note are spoken by the button (label and hint), not as extra stops.
    expect(screen.queryByText("Espresso")).toBeNull();
    expect(screen.getByText("Espresso", hidden)).toBeTruthy();
    expect(screen.getByLabelText("Espresso, $2.99").props.accessibilityHint).toBe("A quick thank-you.");
  });

  it("the pill is a 48 dp filled pill", async () => {
    await ready();
    for (const id of IDS) {
      const s = flat(screen.getByTestId(`tip-price-${id}`));
      expect(Number(s.minHeight)).toBeGreaterThanOrEqual(48);
      expect(s.borderRadius).toBe(tokens.light.radius.pill);
    }
  });

  it("tapping the cup buys too, without being a second button", async () => {
    const jar = await ready();
    const column = screen.getByTestId("tip-tier-tip_coffee_small");
    expect(column.props.accessible).toBe(false);
    expect(column.props.accessibilityRole).toBe("none");
    await fireEvent.press(column);
    expect(jar.bought).toEqual(["tip_coffee_small"]);
  });

  it("while buying, the tapped pill is busy and the others are disabled", async () => {
    await ready();
    await fireEvent.press(screen.getByLabelText("Black coffee, $4.99"));
    expect(screen.getByLabelText("Black coffee, $4.99").props.accessibilityState).toMatchObject({ busy: true, disabled: true });
    for (const l of ["Espresso, $2.99", "Cappuccino, $9.99"]) {
      expect(screen.getByLabelText(l).props.accessibilityState).toMatchObject({ busy: false, disabled: true });
    }
  });

  it("stacked: pills run the full width of the text column", async () => {
    mockWindow.fontScale = 2;
    await ready();
    mockWindow.fontScale = 1;
    for (const id of IDS) expect(flat(screen.getByTestId(`tip-price-${id}`)).alignSelf).toBe("stretch");
  });

  it("pads the scroll end by the bottom inset", async () => {
    await render(<TipJarScreen jar={createFakeTipJar()} />);
    expect(screen.getByTestId("tip-jar-scroll").props.contentContainerStyle.paddingBottom).toBe(34 + 32);
  });

  it("has the shared page header: Back chevron and title, no native header inset", async () => {
    await render(<TipJarScreen jar={createFakeTipJar()} />);
    expect(screen.getByRole("button", { name: "Back" })).toBeTruthy();
    expect(screen.getByRole("header", { name: "Tip jar" })).toBeTruthy();
    expect(screen.getByTestId("tip-jar-scroll").props.contentInsetAdjustmentBehavior).toBe("never");
  });
});
