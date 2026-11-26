// Measures the two yellow marks on the scan slide (02-scan) for each raw review capture: the
// receipt's TOTAL row (label and amount) and the Total field in the form below it. Uses Apple
// Vision text recognition, so nobody has to measure 16 screenshots by hand.
// Output: JSON keyed "<device>/<lang>", value [[x, y, w, h], [x, y, w, h]] in raw pixels with a
// top-left origin: first the receipt row, then the field. Exits 1 if either is not found.
// Usage: swift tools/find-marks.swift raw/*/*/01-review.png > marks.json
import AppKit
import Vision

struct Line { let text: String; let box: CGRect }  // box in pixels, top-left origin

func digits(_ s: String) -> String { s.filter(\.isNumber) }

func lines(in path: String) -> (lines: [Line], size: CGSize) {
  let image = NSImage(contentsOfFile: path)!
  var rect = CGRect(origin: .zero, size: image.size)
  let cg = image.cgImage(forProposedRect: &rect, context: nil, hints: nil)!
  let W = CGFloat(cg.width), H = CGFloat(cg.height)
  let request = VNRecognizeTextRequest()
  request.recognitionLevel = .accurate
  request.usesLanguageCorrection = false
  try! VNImageRequestHandler(cgImage: cg).perform([request])
  let found = (request.results ?? []).compactMap { o -> Line? in
    guard let t = o.topCandidates(1).first?.string else { return nil }
    let b = o.boundingBox
    return Line(text: t, box: CGRect(x: b.minX * W, y: (1 - b.maxY) * H, width: b.width * W, height: b.height * H))
  }
  return (found, CGSize(width: W, height: H))
}

var result: [String: [[Int]]] = [:]
var failed = false
for path in CommandLine.arguments.dropFirst() {
  let parts = path.split(separator: "/")
  let key = "\(parts[parts.count - 3])/\(parts[parts.count - 2])"
  let (all, _) = lines(in: path)
  // "TOTAL" or "VALOR TOTAL" at the start, as a whole word: never SUBTOTAL.
  let label = all.first { $0.text.range(of: #"^(VALOR )?TOTAL\b"#, options: .regularExpression) != nil }
  guard let label else {
    FileHandle.standardError.write("\(path): receipt TOTAL not found\n".data(using: .utf8)!)
    failed = true; continue
  }
  // The row: everything whose vertical centre is within half the label's height of the label's.
  let row = all.filter { abs($0.box.midY - label.box.midY) < label.box.height / 2 }
  let rowBox = row.map(\.box).reduce(label.box) { $0.union($1) }
  let amount = row.map { digits($0.text) }.filter { !$0.isEmpty }.last ?? ""
  // The field: text with the same digits that starts outside the receipt row's horizontal span
  // (left of it on phones, where the form is below the photo; right of it on iPad, where the form
  // is beside it). That skips the card-payment line that repeats the total on the receipt.
  let field = all
    .filter { !amount.isEmpty && digits($0.text) == amount && ($0.box.minX < rowBox.minX || $0.box.minX > rowBox.maxX) }
    .max { $0.box.minY < $1.box.minY }
  guard let field else {
    FileHandle.standardError.write("\(path): Total field with \(amount) not found\n".data(using: .utf8)!)
    failed = true; continue
  }
  result[key] = [rowBox, field.box].map { [Int($0.minX), Int($0.minY), Int($0.width.rounded(.up)), Int($0.height.rounded(.up))] }
}
let keys = result.keys.sorted()
print("{\n" + keys.map { "  \"\($0)\": \(result[$0]!)" }.joined(separator: ",\n") + "\n}")
exit(failed ? 1 : 0)
