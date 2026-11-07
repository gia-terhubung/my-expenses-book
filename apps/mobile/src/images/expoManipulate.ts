import { ImageManipulator, SaveFormat } from "expo-image-manipulator";

import type { Manipulate } from "./store";

export const expoManipulate: Manipulate = async (srcUri, { maxEdge, quality }) => {
  // Load first to learn the (orientation-corrected) size, then resize the long edge only.
  // Refs are released explicitly: full-size decodes are large on low-RAM Android.
  const probe = await ImageManipulator.manipulate(srcUri).renderAsync();
  const ctx = ImageManipulator.manipulate(probe);
  try {
    const { width, height } = probe;
    if (Math.max(width, height) > maxEdge) {
      ctx.resize(width >= height ? { width: maxEdge } : { height: maxEdge });
    }
    const ref = await ctx.renderAsync();
    try {
      const out = await ref.saveAsync({ format: SaveFormat.JPEG, compress: quality });
      return { uri: out.uri, width: out.width, height: out.height };
    } finally {
      ref.release();
    }
  } finally {
    ctx.release();
    probe.release();
  }
};
