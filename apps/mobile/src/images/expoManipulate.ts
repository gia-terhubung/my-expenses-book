import { ImageManipulator, SaveFormat } from "expo-image-manipulator";

import type { Manipulate } from "./store";

export const expoManipulate: Manipulate = async (srcUri, { maxEdge, quality }) => {
  // Load first to learn the (orientation-corrected) size, then resize the long edge only.
  const probe = await ImageManipulator.manipulate(srcUri).renderAsync();
  const { width, height } = probe;
  const ctx = ImageManipulator.manipulate(probe);
  if (Math.max(width, height) > maxEdge) {
    ctx.resize(width >= height ? { width: maxEdge } : { height: maxEdge });
  }
  const ref = await ctx.renderAsync();
  const out = await ref.saveAsync({ format: SaveFormat.JPEG, compress: quality });
  return { uri: out.uri, width: out.width, height: out.height };
};
