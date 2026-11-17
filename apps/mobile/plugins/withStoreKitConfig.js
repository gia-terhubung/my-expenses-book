/**
 * Local StoreKit testing: copies `storekit/Tips.storekit` into the generated iOS app folder and
 * selects it in the shared scheme's Run options, so a Debug run started from Xcode shows test prices
 * for the three tips without App Store Connect. Archive/EAS builds ignore scheme StoreKit settings,
 * so release builds still use the real store. `expo run:ios` launches through simctl, which does not
 * apply scheme StoreKit files: start the run from Xcode (Product > Run) to see test prices.
 */
const fs = require("fs");
const path = require("path");
const { withDangerousMod } = require("@expo/config-plugins");

const APP_FOLDER = "MyExpensesBook";
const FILE = "Tips.storekit";
// Relative to the scheme container, the form Xcode itself writes for a file in the app folder.
const STOREKIT_IDENTIFIER = `../../${APP_FOLDER}/${FILE}`;

function addStoreKitReference(xml) {
  if (xml.includes("<StoreKitConfigurationFileReference")) return xml;
  const ref =
    `      <StoreKitConfigurationFileReference\n         identifier = "${STOREKIT_IDENTIFIER}">\n` +
    `      </StoreKitConfigurationFileReference>\n`;
  return xml.replace(/(\n)(\s*<\/LaunchAction>)/, `$1${ref}$2`);
}

function withStoreKitConfig(config) {
  return withDangerousMod(config, [
    "ios",
    (cfg) => {
      const iosRoot = cfg.modRequest.platformProjectRoot;
      fs.copyFileSync(path.join(cfg.modRequest.projectRoot, "storekit", FILE), path.join(iosRoot, APP_FOLDER, FILE));
      const schemes = path.join(iosRoot, `${APP_FOLDER}.xcodeproj`, "xcshareddata", "xcschemes");
      if (fs.existsSync(schemes)) {
        for (const name of fs.readdirSync(schemes).filter((n) => n.endsWith(".xcscheme"))) {
          const p = path.join(schemes, name);
          fs.writeFileSync(p, addStoreKitReference(fs.readFileSync(p, "utf8")));
        }
      }
      return cfg;
    },
  ]);
}

module.exports = withStoreKitConfig;
module.exports.addStoreKitReference = addStoreKitReference;
module.exports.STOREKIT_IDENTIFIER = STOREKIT_IDENTIFIER;
