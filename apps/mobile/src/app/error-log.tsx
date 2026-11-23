import Constants from "expo-constants";

import { ErrorLogScreen } from "@/errorLog/ErrorLogScreen";
import { StatusBarInset } from "@/layout/StatusBarInset";

export default function ErrorLogRoute() {
  return (
    <StatusBarInset>
      <ErrorLogScreen appVersion={Constants.expoConfig?.version ?? "?"} />
    </StatusBarInset>
  );
}
