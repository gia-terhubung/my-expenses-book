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
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
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
    const style = StyleSheet.flatten(screen.getByRole("imagebutton").props.style);
    expect(style).toMatchObject({ width: "100%", aspectRatio: 1000 / 3000, maxHeight: cap });
    expect(style.alignSelf).toBeUndefined();
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
