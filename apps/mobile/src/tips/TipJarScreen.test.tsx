import { act, fireEvent, render, screen } from "@testing-library/react-native";

import { initI18n } from "@/i18n";
import { createFakeTipJar } from "@/payments/fakeTipJar";

import { TipJarScreen } from "./TipJarScreen";

beforeAll(() => initI18n("en"));

const LABELS = ["Small coffee, $2.99", "Coffee, $4.99", "Generous coffee, $9.99"];

describe("TipJarScreen", () => {
  it("connects on mount, lists the three tiers with store prices, disconnects on unmount", async () => {
    const jar = createFakeTipJar();
    const { unmount } = await render(<TipJarScreen jar={jar} />);
    expect(jar.connects).toBe(1);
    const buttons = await screen.findAllByRole("button", { name: /coffee/i });
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
    await fireEvent.press(await screen.findByLabelText("Small coffee, $2.99"));
    await act(async () => jar.emit({ kind: "failed", code: "E_NETWORK" }));
    expect(screen.getByText("The purchase didn't go through. You weren't charged.")).toBeTruthy();
  });

  it("thanks the user, also for a purchase replayed before any tap", async () => {
    const jar = createFakeTipJar();
    await render(<TipJarScreen jar={jar} />);
    await screen.findByLabelText("Coffee, $4.99");
    await act(async () => jar.emit({ kind: "thanks", id: "tip_coffee_generous" }));
    expect(screen.getAllByText("Thank you! Your tip keeps this app independent.")).toHaveLength(1);
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
