import { useEffect } from "react";
import { Modal, type ModalProps } from "react-native";

import { useAppObscured } from "@/lock/appObscured";

/**
 * The only way to show an RN `Modal` in this app (enforced by appModalGuard.test.ts). RN Modals
 * live in their own native window, above the lock screen and in the app-switcher snapshot, so
 * while the app is locked or privacy-covered the modal is hidden and closed via onRequestClose.
 */
export function AppModal({ visible, onRequestClose, ...rest }: ModalProps) {
  const obscured = useAppObscured();
  useEffect(() => {
    if (obscured && visible) onRequestClose?.({} as never);
  }, [obscured, visible, onRequestClose]);
  return <Modal {...rest} visible={visible && !obscured} onRequestClose={onRequestClose} />;
}
