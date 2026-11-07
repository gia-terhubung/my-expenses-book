import { fireEvent, render, screen } from "@testing-library/react-native";

import { createFolder, listFolders } from "@/db/repositories/folders";
import { testDb } from "@/db/testing/testDb";
import type { AppDb } from "@/db/types";
import { initI18n } from "@/i18n";

import { FolderPicker } from "./FolderPicker";

let mockDb: AppDb;
jest.mock("@/db/DatabaseProvider", () => ({ useDb: () => mockDb }));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

beforeAll(() => initI18n("en"));
beforeEach(() => {
  mockDb = testDb();
});

async function mount(value: string | null = null) {
  const onChange = jest.fn();
  const onClose = jest.fn();
  const view = await render(<FolderPicker visible value={value} onChange={onChange} onClose={onClose} />);
  return { onChange, onClose, view };
}

describe("FolderPicker", () => {
  it("lists folders; No folder gives onChange(null)", async () => {
    const f = createFolder(mockDb, { name: "Office", kind: "project" });
    const { onChange } = await mount(f.id);
    await screen.findByText("Office");
    expect(screen.getByRole("radio", { name: "Office" }).props.accessibilityState.checked).toBe(true);
    await fireEvent.press(screen.getByText("No folder"));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it("picking a folder gives its id", async () => {
    const f = createFolder(mockDb, { name: "Office", kind: "project" });
    const { onChange } = await mount();
    await fireEvent.press(await screen.findByText("Office"));
    expect(onChange).toHaveBeenCalledWith(f.id);
  });

  it("New folder… creates a trip folder and selects it", async () => {
    const { onChange } = await mount();
    await fireEvent.press(await screen.findByText("New folder…"));
    await fireEvent.changeText(screen.getByLabelText("Folder name"), "Bali 2026");
    await fireEvent.press(screen.getByRole("radio", { name: "Trip" }));
    await fireEvent.press(screen.getByRole("button", { name: "Create" }));
    const created = listFolders(mockDb);
    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({ name: "Bali 2026", kind: "trip" });
    expect(onChange).toHaveBeenCalledWith(created[0].id);
  });

  it("an empty name cannot be created", async () => {
    const { onChange } = await mount();
    await fireEvent.press(await screen.findByText("New folder…"));
    await fireEvent.changeText(screen.getByLabelText("Folder name"), "   ");
    const create = screen.getByRole("button", { name: "Create" });
    expect(create.props.accessibilityState.disabled).toBe(true);
    await fireEvent.press(create);
    expect(listFolders(mockDb)).toHaveLength(0);
    expect(onChange).not.toHaveBeenCalled();
  });
});
