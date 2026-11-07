/** Normalized 0..1, top-left origin, in the upright orientation of the returned pass. */
export type OcrBox = { x: number; y: number; w: number; h: number };

export type OcrObservation = { text: string; box: OcrBox; confidence: number };

export type OcrResult = {
  observations: OcrObservation[];
  /** Pixel size of the upright frame the boxes are relative to (swapped vs. the file for 90/270). */
  width: number;
  height: number;
  /**
   * Clockwise degrees the (EXIF-corrected) image was rotated to read it upright.
   * 90 = iOS CGImagePropertyOrientation.right / Android InputImage rotation 90;
   * 270 = .left / 270. 180 is never produced by the rotation retry today.
   */
  rotation: 0 | 90 | 180 | 270;
  ms: number;
};
