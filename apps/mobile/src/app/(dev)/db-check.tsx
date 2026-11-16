import { Redirect } from "expo-router";
import type { ComponentType } from "react";

function NotInRelease() {
  return <Redirect href="/" />;
}

// Metro folds __DEV__ to false in release builds, so this require (and the screen module with
// everything it imports) is dropped from the release bundle.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Screen: ComponentType = __DEV__ ? require("@/dev/screens/DbCheck").default : NotInRelease;

export default Screen;
