import { act, render } from "@testing-library/react-native";
import { Text } from "react-native";

import { NativeSheetHost, NativeSheetPage, TabStackContext, useNativeSheets } from "./NativeSheet";

/** One sheet body at a time: a page going away must only close the sheet it showed. */
const mockRouter = { push: jest.fn(), back: jest.fn() };
jest.mock("expo-router", () => ({
  ...jest.requireActual("../../test/expoRouterStack").stackMock,
  router: { push: (...a: unknown[]) => mockRouter.push(...a), back: () => mockRouter.back() },
}));

beforeEach(() => jest.clearAllMocks());

it("a closing sheet page does not close the next sheet that opened meanwhile", async () => {
  const closeA = jest.fn();
  const closeB = jest.fn();
  const hosts = await render(
    <NativeSheetHost visible onClose={closeA}>
      <Text>A</Text>
    </NativeSheetHost>,
  );
  const pageA = await render(<NativeSheetPage />);
  // A closes (✓), and B opens before A's page has finished going away.
  await hosts.rerender(
    <>
      <NativeSheetHost visible={false} onClose={closeA}>
        <Text>A</Text>
      </NativeSheetHost>
      <NativeSheetHost visible onClose={closeB}>
        <Text>B</Text>
      </NativeSheetHost>
    </>,
  );
  await act(async () => pageA.unmount());
  expect(closeB).not.toHaveBeenCalled();
});

it("inside a sheet body, pickers do not open another native sheet", async () => {
  let inner: boolean | undefined;
  function Probe() {
    inner = useNativeSheets();
    return null;
  }
  await render(
    <NativeSheetHost visible onClose={() => {}}>
      <Probe />
    </NativeSheetHost>,
  );
  // The page is a tab-stack page too, so only the sheet guard can stop a nested native sheet.
  await render(
    <TabStackContext.Provider value>
      <NativeSheetPage />
    </TabStackContext.Provider>,
  );
  expect(inner).toBe(false);
});
