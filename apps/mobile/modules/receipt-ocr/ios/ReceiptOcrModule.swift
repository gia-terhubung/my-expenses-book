import ExpoModulesCore
import ImageIO
import Vision

public class ReceiptOcrModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ReceiptOcr")

    AsyncFunction("recognizeText") { (uri: String, languages: [String]) throws -> [String: Any] in
      let t0 = Date()
      // Cap decode size: enough for receipt text, bounded memory on older phones.
      let image = try Self.loadUpright(uri, maxPixel: 4096)
      let langs = Self.resolveLanguages(languages)

      var best = try Self.recognize(image, orientation: .up, rotation: 0, languages: langs)
      if Self.mostlyTall(best) {
        // Bake-off photo 21: sideways label. Try both quarter turns and keep the better pass.
        for (orientation, rotation) in [(CGImagePropertyOrientation.right, 90), (.left, 270)] {
          let pass = try Self.recognize(image, orientation: orientation, rotation: rotation, languages: langs)
          #if DEBUG
          NSLog("ReceiptOcr pass %d: conf=%.3f forward=%.2f (best so far %d: conf=%.3f forward=%.2f)",
                rotation, pass.meanConfidence, pass.forwardFraction, best.rotation, best.meanConfidence, best.forwardFraction)
          #endif
          if Self.isBetter(pass, than: best) { best = pass }
        }
      }
      return [
        "observations": best.observations,
        "width": best.width,
        "height": best.height,
        "rotation": best.rotation,
        "ms": Int(Date().timeIntervalSince(t0) * 1000),
      ]
    }

    AsyncFunction("imageHash") { (uri: String) throws -> String in
      let image = try Self.loadUpright(uri, maxPixel: 256)
      return try Self.dHash(image)
    }
  }

  // MARK: - Loading

  private static func fileURL(_ uri: String) throws -> URL {
    if let url = URL(string: uri), url.isFileURL { return url }
    if uri.hasPrefix("/") { return URL(fileURLWithPath: uri) }
    throw ocrError("Unsupported uri (file:// only)")
  }

  /// Decodes with the EXIF orientation applied, so pixel rows are upright as displayed.
  private static func loadUpright(_ uri: String, maxPixel: Int) throws -> CGImage {
    let url = try fileURL(uri)
    guard let source = CGImageSourceCreateWithURL(url as CFURL, nil) else {
      throw ocrError("Cannot open image")
    }
    let opts: [CFString: Any] = [
      kCGImageSourceCreateThumbnailFromImageAlways: true,
      kCGImageSourceCreateThumbnailWithTransform: true,
      kCGImageSourceThumbnailMaxPixelSize: maxPixel,
      kCGImageSourceShouldCacheImmediately: true,
    ]
    guard let image = CGImageSourceCreateThumbnailAtIndex(source, 0, opts as CFDictionary) else {
      throw ocrError("Cannot decode image")
    }
    return image
  }

  // MARK: - OCR

  private struct Pass {
    let observations: [[String: Any]]
    let tallFraction: Double
    let meanConfidence: Double
    /// Share of multi-character observations whose first glyph sits left of the last glyph
    /// (along +x more than along y) in this pass's frame — 1.0 when the frame is upright.
    let forwardFraction: Double
    let width: Int
    let height: Int
    let rotation: Int
  }

  private static func resolveLanguages(_ requested: [String]) -> [String] {
    let probe = VNRecognizeTextRequest()
    probe.recognitionLevel = .accurate
    let supported = (try? probe.supportedRecognitionLanguages()) ?? []
    let langs = requested.filter { supported.contains($0) }
    return langs.isEmpty ? ["en-US"] : langs
  }

  /// Vision reads glyphs in any orientation, so both quarter-turn passes can score the same
  /// confidence while one of them lays the boxes out upside down (bake-off: `.right` gave
  /// reversed row order on photo 21). Text direction decides; mean confidence breaks ties.
  private static func isBetter(_ a: Pass, than b: Pass) -> Bool {
    if abs(a.forwardFraction - b.forwardFraction) > 0.1 { return a.forwardFraction > b.forwardFraction }
    return a.meanConfidence > b.meanConfidence
  }

  private static func mostlyTall(_ pass: Pass) -> Bool {
    !pass.observations.isEmpty && pass.tallFraction > 0.6
  }

  private static func recognize(
    _ image: CGImage, orientation: CGImagePropertyOrientation, rotation: Int, languages: [String]
  ) throws -> Pass {
    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate
    request.usesLanguageCorrection = true
    request.automaticallyDetectsLanguage = false
    request.recognitionLanguages = languages

    let handler = VNImageRequestHandler(cgImage: image, orientation: orientation, options: [:])
    do {
      try handler.perform([request])
    } catch {
      throw ocrError("Vision failed: \(error.localizedDescription)")
    }

    // Vision boxes are normalized to the oriented (upright-for-this-pass) frame.
    let quarter = rotation == 90 || rotation == 270
    let width = quarter ? image.height : image.width
    let height = quarter ? image.width : image.height

    var observations: [[String: Any]] = []
    var tall = 0
    var confSum = 0.0
    var directional = 0
    var forward = 0
    for obs in request.results ?? [] {
      guard let top = obs.topCandidates(1).first else { continue }
      if let dir = textDirection(top, width: width, height: height) {
        directional += 1
        if dir { forward += 1 }
      }
      let bb = obs.boundingBox  // lower-left origin
      if bb.height * CGFloat(height) > bb.width * CGFloat(width) { tall += 1 }
      confSum += Double(top.confidence)
      observations.append([
        "text": top.string,
        "confidence": Double(top.confidence),
        "box": [
          "x": Double(bb.minX),
          "y": Double(1 - bb.maxY),
          "w": Double(bb.width),
          "h": Double(bb.height),
        ],
      ])
    }
    let n = Double(observations.count)
    return Pass(
      observations: observations,
      tallFraction: n > 0 ? Double(tall) / n : 0,
      meanConfidence: n > 0 ? confSum / n : 0,
      forwardFraction: directional > 0 ? Double(forward) / Double(directional) : 0,
      width: width,
      height: height,
      rotation: rotation
    )
  }

  /// true when the text runs left→right in the pass frame, false otherwise, nil if unknown.
  private static func textDirection(_ text: VNRecognizedText, width: Int, height: Int) -> Bool? {
    let str = text.string
    guard str.count >= 2,
          let first = str.indices.first,
          let last = str.indices.last,
          let a = try? text.boundingBox(for: first..<str.index(after: first)),
          let b = try? text.boundingBox(for: last..<str.endIndex)
    else { return nil }
    // `.accurate` may return word-level boxes: one-word strings carry no direction.
    if a.boundingBox == b.boundingBox { return nil }
    let dx = (b.boundingBox.midX - a.boundingBox.midX) * CGFloat(width)
    let dy = (b.boundingBox.midY - a.boundingBox.midY) * CGFloat(height)
    return dx > abs(dy)
  }

  // MARK: - dHash

  /// 64-bit difference hash, same algorithm as Android (see src/ocr/dhash.ts):
  /// upright RGBA pixels → luma (299R + 587G + 114B) / 1000 → mean over a 9×8 grid of
  /// integer-bounded cells → bit (r*8+c) = cell(r,c) < cell(r,c+1), packed MSB-first,
  /// 16 lowercase hex chars.
  private static func dHash(_ image: CGImage) throws -> String {
    let w = image.width
    let h = image.height
    guard w >= 9, h >= 8 else { throw ocrError("Image too small to hash") }
    var pixels = [UInt8](repeating: 0, count: w * h * 4)
    let drawn: Bool = pixels.withUnsafeMutableBytes { buf in
      guard let ctx = CGContext(
        data: buf.baseAddress, width: w, height: h, bitsPerComponent: 8, bytesPerRow: w * 4,
        space: CGColorSpace(name: CGColorSpace.sRGB)!,
        bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue
      ) else { return false }
      ctx.draw(image, in: CGRect(x: 0, y: 0, width: w, height: h))
      return true
    }
    guard drawn else { throw ocrError("Cannot read pixels") }

    // Bitmap context memory is top row first.
    var grid = [Double](repeating: 0, count: 9 * 8)
    for r in 0..<8 {
      let y0 = r * h / 8, y1 = (r + 1) * h / 8
      for c in 0..<9 {
        let x0 = c * w / 9, x1 = (c + 1) * w / 9
        var sum = 0
        for y in y0..<y1 {
          for x in x0..<x1 {
            let i = (y * w + x) * 4
            sum += (299 * Int(pixels[i]) + 587 * Int(pixels[i + 1]) + 114 * Int(pixels[i + 2])) / 1000
          }
        }
        grid[r * 9 + c] = Double(sum) / Double((y1 - y0) * (x1 - x0))
      }
    }
    var hash: UInt64 = 0
    for r in 0..<8 {
      for c in 0..<8 {
        hash <<= 1
        if grid[r * 9 + c] < grid[r * 9 + c + 1] { hash |= 1 }
      }
    }
    return String(format: "%016llx", hash)
  }
}

private func ocrError(_ description: String) -> Exception {
  Exception(name: "OcrError", description: description, code: "ERR_OCR")
}
