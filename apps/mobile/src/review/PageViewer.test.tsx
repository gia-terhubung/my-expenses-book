import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { Dimensions, StyleSheet } from "react-native";

import type { ReceiptPage } from "@/db/types";
import { initI18n } from "@/i18n";

import { PageViewer, viewerKey } from "./PageViewer";
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
  it("fills the width and caps the height at 55% of the window, without waiting for layout", async () => {
    await render(<PageViewer pages={[page()]} />);
    // Review finding: a measured height went stale when Fabric skipped onLayout on a Duo unfold.
    // The box clips at the cap; the page inside keeps full width at its own shape.
    const box = StyleSheet.flatten(screen.getByRole("imagebutton").props.style);
    expect(box).toMatchObject({ width: "100%", maxHeight: cap, overflow: "hidden" });
    expect(box.aspectRatio).toBeUndefined();
    expect(box.height).toBeUndefined();
    expect(StyleSheet.flatten(screen.getByTestId("inline-page").props.style)).toMatchObject({
      width: "100%",
      aspectRatio: 1000 / 3000,
    });
  });

  it("shows the top of a tall page, full width, with a torn edge where the box cuts it", async () => {
    await render(<PageViewer pages={[page()]} />);
    await waitFor(() => expect(screen.getByTestId("inline-photo")).toBeTruthy());
    expect(screen.getByTestId("inline-photo").props.contentFit).toBe("contain");
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
    expect(StyleSheet.flatten(screen.getByTestId("inline-page").props.style).aspectRatio).toBe(3 / 4);
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
      paddingLeft: 0,
      paddingRight: 84,
    });
    const done = StyleSheet.flatten(screen.getByRole("button", { name: "Close photo" }).props.style);
    // Seen on the Duo: a 60% black pill vanished over the black band around a fitted photo.
    expect(done.borderWidth).toBeGreaterThan(0);
    // Its own bar under the photo: floating over it, Done hid item lines (Redmi, landscape).
    const bar = StyleSheet.flatten(screen.getByTestId("photo-done-bar").props.style);
    expect(bar).toMatchObject({ paddingBottom: 10 + 8, paddingRight: 84, alignItems: "center" });
    expect(bar.position).toBeUndefined();
  });
});

describe("viewerKey", () => {
  it("on Android changes with the window size, so a rotation remounts the modal at the new size", () => {
    // Seen on the Redmi: the open modal's window kept its portrait size after a rotation.
    expect(viewerKey("android", 360, 820)).not.toBe(viewerKey("android", 820, 360));
  });

  it("on iOS stays put: the viewer re-fits in place", () => {
    expect(viewerKey("ios", 360, 820)).toBe(viewerKey("ios", 820, 360));
  });
});

describe("PageViewer open state from the parent", () => {
  it("a hidden instance shows no viewer even when a page is open (review form side by side)", async () => {
    // Seen on the Redmi: rotating swapped the form to its side pane; the hidden inline instance
    // kept its viewer open and Android drew only the dim backdrop.
    await render(<PageViewer pages={[page()]} open={0} onOpenChange={() => {}} active={false} />);
    expect(screen.queryByTestId("zoom-surface")).toBeNull();
  });

  it("the visible instance shows the page the parent opened", async () => {
    await render(<PageViewer pages={[page()]} open={0} onOpenChange={() => {}} />);
    await waitFor(() => expect(screen.getByTestId("zoom-surface")).toBeTruthy());
  });

  it("tapping a page asks the parent to open it; Done asks to close", async () => {
    const onOpenChange = jest.fn();
    const view = await render(<PageViewer pages={[page()]} open={null} onOpenChange={onOpenChange} />);
    await waitFor(() => expect(screen.getByTestId("inline-photo")).toBeTruthy());
    await act(async () => fireEvent.press(screen.getByRole("imagebutton")));
    expect(onOpenChange).toHaveBeenLastCalledWith(0);
    await view.rerender(<PageViewer pages={[page()]} open={0} onOpenChange={onOpenChange} />);
    await act(async () => fireEvent.press(screen.getByRole("button", { name: "Close photo" })));
    expect(onOpenChange).toHaveBeenLastCalledWith(null);
  });
});
