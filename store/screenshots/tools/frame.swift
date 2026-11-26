// Frames one raw app screen as a store screenshot: a slip-green header with the caption
// (Bricolage Grotesque ExtraBold, left aligned), the yellow bar from under the month total, the
// app's torn bottom edge, then the real screen (status bar cropped) running off the bottom.
// Optional marks: "x,y,w,h;x,y,w,h" in raw pixels (top-left origin), the receipt row then the field,
// drawn as a yellow highlighter joined by a dashed line. "-" in place of a rect skips it.
// Usage: swift frame.swift <font.ttf> <raw.png> <cropTopPx> <W> <H> <caption> <out.png> [marks]
import AppKit

let a = CommandLine.arguments
CTFontManagerRegisterFontsForURL(URL(fileURLWithPath: a[1]) as CFURL, .process, nil)
let raw = NSImage(contentsOfFile: a[2])!
let rawRep = raw.representations.first!
let rawW = CGFloat(rawRep.pixelsWide), rawH = CGFloat(rawRep.pixelsHigh)
let crop = CGFloat(Double(a[3])!)
let W = CGFloat(Double(a[4])!), H = CGFloat(Double(a[5])!)
let caption = a[6]

let green = NSColor(srgbRed: 0x1F / 255, green: 0x5C / 255, blue: 0x4C / 255, alpha: 1)
let page = NSColor(srgbRed: 0xF2 / 255, green: 0xF5 / 255, blue: 0xF1 / 255, alpha: 1)
let yellow = NSColor(srgbRed: 0xFF / 255, green: 0xD8 / 255, blue: 0x4A / 255, alpha: 1)

// Layout unit from the narrow side, so tablets and landscape keep phone-like proportions.
let u = min(W, H * 0.62) / 100
let margin = 7 * u
let fontSize = 7.6 * u
let font = NSFont(name: "BricolageGrotesque-ExtraBold", size: fontSize) ?? NSFont.boldSystemFont(ofSize: fontSize)
let para = NSMutableParagraphStyle()
para.lineHeightMultiple = 0.98
let attrs: [NSAttributedString.Key: Any] = [.font: font, .foregroundColor: NSColor.white, .paragraphStyle: para, .kern: -0.01 * fontSize]
let text = NSAttributedString(string: caption, attributes: attrs)
let textW = min(W - 2 * margin, 86 * u)
let textBox = text.boundingRect(with: NSSize(width: textW, height: 1000 * u), options: [.usesLineFragmentOrigin])
let topPad = 9 * u
let barY = topPad + textBox.height + 3.2 * u
let headerH = barY + 0.9 * u + 7 * u

// Opaque from the start: the stores reject screenshots with an alpha channel.
let cg = CGContext(
  data: nil, width: Int(W), height: Int(H), bitsPerComponent: 8, bytesPerRow: 0,
  space: CGColorSpace(name: CGColorSpace.sRGB)!, bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue)!
cg.translateBy(x: 0, y: H)
cg.scaleBy(x: 1, y: -1)
NSGraphicsContext.current = NSGraphicsContext(cgContext: cg, flipped: true)

page.setFill(); NSRect(x: 0, y: 0, width: W, height: H).fill()
green.setFill(); NSRect(x: 0, y: 0, width: W, height: headerH).fill()
text.draw(with: NSRect(x: margin, y: topPad, width: textW, height: textBox.height + fontSize), options: [.usesLineFragmentOrigin])
yellow.setFill()
NSBezierPath(roundedRect: NSRect(x: margin, y: barY, width: 9 * u, height: 0.9 * u), xRadius: 0.45 * u, yRadius: 0.45 * u).fill()
// Torn edge: page-coloured circles centred on the header's bottom line.
let tooth = 2.2 * u
page.setFill()
var x: CGFloat = 0
while x < W + tooth {
  NSBezierPath(ovalIn: NSRect(x: x, y: headerH - tooth / 2, width: tooth, height: tooth)).fill()
  x += tooth
}

// The screen: status bar cropped, centred, as wide as the margins allow, running off the bottom.
let screenTop = headerH + 6 * u
let maxW = W - 2 * margin
// Marks in raw pixels; nil where a rect is "-".
let rawMarks: [NSRect?] = a.count > 8 ? a[8].split(separator: ";").map { part in
  let v = part.split(separator: ",").compactMap { Double($0) }.map { CGFloat($0) }
  return v.count == 4 ? NSRect(x: v[0], y: v[1], width: v[2], height: v[3]) : nil
} : []
// A mark must end above the page's bottom margin (4u): on short pages the screen shrinks to fit it.
let markFloor = rawMarks.compactMap { $0?.maxY }.max()
let markRoom: CGFloat = H - 4.6 * u - screenTop
var fitMarks = CGFloat.greatestFiniteMagnitude
if let floor = markFloor { fitMarks = markRoom * rawW / (floor - crop) }
let screenW = min(maxW, (H - screenTop + 40 * u) * rawW / (rawH - crop), fitMarks)
let screenX = (W - screenW) / 2
let visibleH = (rawH - crop) * screenW / rawW
let dest = NSRect(x: screenX, y: screenTop, width: screenW, height: visibleH)
let radius = 4.5 * u
let shadow = NSShadow()
shadow.shadowColor = NSColor(white: 0, alpha: 0.16)
shadow.shadowBlurRadius = 3.5 * u
shadow.shadowOffset = NSSize(width: 0, height: -1.2 * u)
NSGraphicsContext.saveGraphicsState()
shadow.set()
NSColor.white.setFill()
NSBezierPath(roundedRect: dest, xRadius: radius, yRadius: radius).fill()
NSGraphicsContext.restoreGraphicsState()
NSGraphicsContext.saveGraphicsState()
NSBezierPath(roundedRect: dest, xRadius: radius, yRadius: radius).addClip()
// Source rect in the image's own bottom-left coordinates: everything below the status bar.
let src = NSRect(x: 0, y: 0, width: raw.size.width, height: raw.size.height * (rawH - crop) / rawH)
raw.draw(in: dest, from: src, operation: .sourceOver, fraction: 1, respectFlipped: true, hints: [.interpolation: NSImageInterpolation.high])
if a.count > 8 {
  // Raw pixels to page: same scale as the screen, shifted by the cropped status bar.
  let k = screenW / rawW
  let marks: [NSRect?] = rawMarks.map { m in
    m.map { NSRect(x: screenX + $0.minX * k, y: screenTop + ($0.minY - crop) * k, width: $0.width * k, height: $0.height * k)
      .insetBy(dx: -0.6 * u, dy: -0.6 * u) }
  }
  // Placement report for check.sh: the lowest mark's bottom edge and the page's usable bottom.
  if let low = marks.compactMap({ $0 }).map(\.maxY).max() { print("marks-bottom \(Int(low)) \(Int(H - 4 * u))") }
  cg.setBlendMode(.multiply)
  yellow.withAlphaComponent(0.55).setFill()
  for m in marks.compactMap({ $0 }) { NSBezierPath(roundedRect: m, xRadius: 0.8 * u, yRadius: 0.8 * u).fill() }
  cg.setBlendMode(.normal)
  if marks.count == 2, let r = marks[0], let f = marks[1] {
    // An elbow through the gutter left of the field labels, so it never crosses other form text:
    // from the receipt row's near end (its left end on phones, where the form is below the photo;
    // its right end on iPad, where the form is beside it), down or up to the field's centre line.
    let gx = f.minX - 3.5 * u
    let line = NSBezierPath()
    line.move(to: NSPoint(x: r.minX > gx ? r.minX : r.maxX, y: r.midY))
    line.line(to: NSPoint(x: gx, y: r.midY))
    line.line(to: NSPoint(x: gx, y: f.midY))
    line.line(to: NSPoint(x: f.minX, y: f.midY))
    line.lineWidth = 0.5 * u
    line.setLineDash([1.4 * u, 1.0 * u], count: 2, phase: 0)
    line.lineCapStyle = .round
    yellow.setStroke(); line.stroke()
  }
}
NSGraphicsContext.restoreGraphicsState()
NSGraphicsContext.current = nil
let out = NSBitmapImageRep(cgImage: cg.makeImage()!)
try! out.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: a[7]))
