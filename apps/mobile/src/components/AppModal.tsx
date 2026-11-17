import { useEffect } from "react";
import { Modal, type ModalProps } from "react-native";

import { ModalSideInset } from "@/layout/ModalSideInset";
import { useAppObscured } from "@/lock/appObscured";

/**
 * The only way to show an RN `Modal` in this app (enforced by appModalGuard.test.ts). RN Modals
 * live in their own native window, above the lock screen and in the app-switcher snapshot, so
 * while the app is locked or privacy-covered the modal is hidden and closed via onRequestClose.
 * Non-transparent modals (page sheets) get their content padded by the root side insets
 * (`sideInset`, default on); a transparent modal lays itself out, and a full-screen viewer opts out.
 */
export function AppModal({
  visible,
  onRequestClose,
  children,
  sideInset,
  ...rest
}: ModalProps & { sideInset?: boolean }) {
  const obscured = useAppObscured();
  useEffect(() => {
    if (obscured && visible) onRequestClose?.({} as never);
  }, [obscured, visible, onRequestClose]);
  const inset = sideInset ?? !rest.transparent;
  return (
    <Modal {...rest} visible={visible && !obscured} onRequestClose={onRequestClose}>
      {inset ? <ModalSideInset>{children}</ModalSideInset> : children}
    </Modal>
  );
}
