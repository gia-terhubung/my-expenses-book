import { Redirect } from "expo-router";

// Route entry: the provider renders DbErrorScreen itself; reaching this directly means no error.
export default function DbErrorRoute() {
  return <Redirect href="/" />;
}
