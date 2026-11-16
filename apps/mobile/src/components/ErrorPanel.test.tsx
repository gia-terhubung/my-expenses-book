import { render } from "@testing-library/react-native";

import { errorLog, resetErrorLogForTests } from "@/errorLog/instance";
import { initI18n } from "@/i18n";

import { ErrorPanel } from "./ErrorPanel";

beforeAll(() => initI18n("en"));
beforeEach(() => resetErrorLogForTests());

describe("ErrorPanel logging", () => {
  it("logs its details once under the given scope", async () => {
    const { rerender } = await render(<ErrorPanel title="Oops" details="disk I/O error" scope="db.open" />);
    await rerender(<ErrorPanel title="Oops" details="disk I/O error" scope="db.open" />);
    expect(errorLog.list()).toEqual([expect.objectContaining({ scope: "db.open", message: "disk I/O error" })]);
  });

  it("logs nothing without details", async () => {
    await render(<ErrorPanel title="Oops" scope="db.open" />);
    expect(errorLog.list()).toEqual([]);
  });
});
