/* eslint-disable @typescript-eslint/no-require-imports */
const { addStoreKitReference, STOREKIT_IDENTIFIER } = require("../../plugins/withStoreKitConfig");

const SCHEME = `<?xml version="1.0" encoding="UTF-8"?>
<Scheme LastUpgradeVersion = "1130" version = "1.3">
   <LaunchAction
      buildConfiguration = "Debug"
      launchStyle = "0">
      <BuildableProductRunnable
         runnableDebuggingMode = "0">
      </BuildableProductRunnable>
   </LaunchAction>
   <ProfileAction buildConfiguration = "Release">
   </ProfileAction>
</Scheme>
`;

describe("addStoreKitReference", () => {
  it("adds the StoreKit file to the Run (LaunchAction) options only", () => {
    const out: string = addStoreKitReference(SCHEME);
    const launch = out.slice(out.indexOf("<LaunchAction"), out.indexOf("</LaunchAction>"));
    expect(launch).toContain(`<StoreKitConfigurationFileReference\n         identifier = "${STOREKIT_IDENTIFIER}">`);
    expect(out.slice(out.indexOf("<ProfileAction"))).not.toContain("StoreKitConfigurationFileReference");
  });

  it("is idempotent across prebuilds", () => {
    const once: string = addStoreKitReference(SCHEME);
    expect(addStoreKitReference(once)).toBe(once);
  });

  it("points at the copy inside the app folder", () => {
    expect(STOREKIT_IDENTIFIER).toBe("../MyExpensesBook/Tips.storekit");
  });
});
