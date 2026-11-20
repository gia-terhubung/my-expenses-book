import { layoutFor } from "../layout";

/** Named layouts for test mocks of `useLayout`. */
export const LAYOUTS = {
  phone: layoutFor({ width: 360, height: 800, left: 0, right: 0 }),
  duoClosed: layoutFor({ width: 466, height: 678, left: 0, right: 84 }),
  duoSideways: layoutFor({ width: 678, height: 466, left: 0, right: 84 }),
  duoPortrait: layoutFor({ width: 669, height: 951, left: 0, right: 0 }),
  duoLandscape: layoutFor({ width: 951, height: 669, left: 0, right: 84 }),
  foldInner: layoutFor({ width: 841, height: 701, left: 0, right: 0 }),
  foldInnerPortrait: layoutFor({ width: 701, height: 841, left: 0, right: 0 }),
  flipCover: layoutFor({ width: 360, height: 400, left: 0, right: 0 }),
};
