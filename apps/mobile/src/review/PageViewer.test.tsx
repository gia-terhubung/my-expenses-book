import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { Dimensions, StyleSheet } from "react-native";

import type { ReceiptPage } from "@/db/types";
import { initI18n } from "@/i18n";

import { PageViewer } from "./PageViewer";
import { inlineCap } from "./zoomMath";

const mockImages = {
  openForView: jest.fn(async (p: string) => (p === "bad.jpg" ? Promise.reject(new Error("x")) : `file:///cache/view/${p}`)),
};
jest.mock("@/images/ImageStoreProvider", () => ({ useImageStore: () => mockImages }));
let mockInsets = { top: 0, bottom: 0, left: 0, right: 0 };
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => mockInsets,
}));

beforeAll(() => initI18n("en"));

function page(over: Partial<ReceiptPage> = {}): ReceiptPage {
  return {
    id: "p1",
    receiptId: "r1",
    pageIndex: 0,
    imagePath: "a.jpg",
    thumbPath: null,
    width: 1000,
    height: 3000,
    dhash: null,
    createdAt: 0,
    updatedAt: 0,
    deletedAt: null,
    version: 1,
    ...over,
  } as ReceiptPage;
}

async function layout(width: number, height: number) {
  await act(async () => {
    fireEvent(screen.getByRole("imagebutton"), "layout", { nativeEvent: { layout: { x: 0, y: 0, width, height } } });
  });
}

const cap = inlineCap(Dimensions.get("window").height);

describe("PageViewer inline", () => {
  it("fills the width and caps the height at 55% of the window", async () => {
    await render(<PageViewer pages={[page()]} />);
    // Before the width is known: full width at the page's own shape.
    expect(StyleSheet.flatten(screen.getByRole("imagebutton").props.style)).toMatchObject({ width: "100%", aspectRatio: 1000 / 3000 });
    await layout(400, 1200);
    const style = StyleSheet.flatten(screen.getByRole("imagebutton").props.style);
    // Device bug (iPhone Duo): aspectRatio + maxHeight let Yoga shrink the width to fit the cap.
    // Once measured, the height is set outright and the width stays 100%.
    expect(style).toMatchObject({ width: "100%", height: cap });
    expect(style.aspectRatio).toBeUndefined();
    expect(style.maxHeight).toBeUndefined();
  });

  it("a short page keeps its own height under the cap", async () => {
    await render(<PageViewer pages={[page({ width: 1000, height: 500 })]} />);
    await layout(400, 200);
    expect(StyleSheet.flatten(screen.getByRole("imagebutton").props.style)).toMatchObject({ width: "100%", height: 200 });
  });

  it("shows the top of a tall page, full width, with a torn edge where it is cut", async () => {
    await render(<PageViewer pages={[page()]} />);
    await waitFor(() => expect(screen.getByTestId("inline-photo")).toBeTruthy());
    expect(screen.getByTestId("inline-photo").props).toMatchObject({ contentFit: "cover", contentPosition: { top: 0 } });
    await layout(400, cap);
    expect(screen.getByTestId("slip-edge", { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByTestId("photo-expand-hint", { includeHiddenElements: true })).toBeTruthy();
  });

  it("a page that fits has no torn edge but still shows the expand hint", async () => {
    await render(<PageViewer pages={[page({ width: 1000, height: 500 })]} />);
    await waitFor(() => expect(screen.getByTestId("inline-photo")).toBeTruthy());
    await layout(400, 200);
    expect(screen.queryByTestId("slip-edge", { includeHiddenElements: true })).toBeNull();
    expect(screen.getByTestId("photo-expand-hint", { includeHiddenElements: true })).toBeTruthy();
  });

  it("a page of unknown size uses 3:4", async () => {
    await render(<PageViewer pages={[page({ width: null, height: null })]} />);
    expect(StyleSheet.flatten(screen.getByRole("imagebutton").props.style).aspectRatio).toBe(3 / 4);
  });

  it("a photo that cannot be opened says so, with no expand hint", async () => {
    await render(<PageViewer pages={[page({ imagePath: "bad.jpg" })]} />);
    await waitFor(() => expect(screen.getByText("Couldn't open the photo.")).toBeTruthy());
    expect(screen.queryByTestId("photo-expand-hint", { includeHiddenElements: true })).toBeNull();
  });

  it("tapping the photo opens the zoomable full-screen viewer", async () => {
    await render(<PageViewer pages={[page()]} />);
    await waitFor(() => expect(screen.getByTestId("inline-photo")).toBeTruthy());
    await act(async () => fireEvent.press(screen.getByRole("imagebutton")));
    expect(screen.getByTestId("zoom-surface")).toBeTruthy();
  });
});

describe("PageViewer fill (review form pane)", () => {
  it("keeps the whole page visible (contain) and never draws the torn edge", async () => {
    await render(<PageViewer pages={[page()]} fill />);
    await waitFor(() => expect(screen.getByTestId("inline-photo")).toBeTruthy());
    await layout(300, 500);
    expect(screen.getByTestId("inline-photo").props.contentFit).toBe("contain");
    expect(screen.queryByTestId("slip-edge", { includeHiddenElements: true })).toBeNull();
    expect(screen.getByTestId("photo-expand-hint", { includeHiddenElements: true })).toBeTruthy();
  });
});

describe("PageViewer full screen", () => {
  afterEach(() => {
    mockInsets = { top: 0, bottom: 0, left: 0, right: 0 };
  });

  it("keeps the photo and Done inside the safe area (Duo outer screen: status column on the right)", async () => {
    mockInsets = { top: 20, bottom: 10, left: 0, right: 84 };
    await render(<PageViewer pages={[page()]} />);
    await waitFor(() => expect(screen.getByTestId("inline-photo")).toBeTruthy());
    await act(async () => fireEvent.press(screen.getByRole("imagebutton")));
    expect(StyleSheet.flatten(screen.getByTestId("photo-viewer-area").props.style)).toMatchObject({
      paddingTop: 20,
      paddingBottom: 10,
      paddingLeft: 0,
      paddingRight: 84,
    });
    const done = StyleSheet.flatten(screen.getByRole("button", { name: "Close photo" }).props.style);
    // Bottom centre: on the open Duo the status pill reaches into the top-right of the content.
    expect(StyleSheet.flatten(screen.getByTestId("photo-done-bar").props.style)).toMatchObject({
      position: "absolute",
      left: 0,
      right: 84,
      bottom: 10 + 16,
      alignItems: "center",
    });
    // Seen on the Duo: a 60% black pill vanished over the black band around a fitted photo.
    expect(done.borderWidth).toBeGreaterThan(0);
  });
});
