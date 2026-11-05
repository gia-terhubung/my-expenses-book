import { createContext, useContext } from "react";

/** True while the lock screen or the privacy cover hides the app. False outside LockGate. */
export const AppObscuredContext = createContext(false);
export const useAppObscured = () => useContext(AppObscuredContext);
