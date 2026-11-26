// Store slide 1, "the zero receipt": the frame.swift header (slip green, Bricolage Grotesque
// ExtraBold caption, yellow bar, torn edge), then a paper slip that itemises what the app costs:
// price 0, ads 0, tracking 0, no account, internet optional, with the highlighter on TOTAL.
// The slip lines come from zero-receipt.json ("name<TAB>amount", or plain text, centred).
// Usage: swift promo.swift <font.ttf> <zero-receipt.json> <lang> <W> <H> <caption> <out.png>
import AppKit

let a = CommandLine.arguments
CTFontManagerRegisterFontsForURL(URL(fileURLWithPath: a[1]) as CFURL, .process, nil)
let slips = try! JSONSerialization.jsonObject(with: Data(contentsOf: URL(fileURLWithPath: a[2]))) as! [String: [String]]
let lines = slips[a[3]]!
let W = CGFloat(Double(a[4])!), H = CGFloat(Double(a[5])!)
let caption = a[6]

let green = NSColor(srgbRed: 0x1F / 255, green: 0x5C / 255, blue: 0x4C / 255, alpha: 1)
let page = NSColor(srgbRed: 0xF2 / 255, green: 0xF5 / 255, blue: 0xF1 / 255, alpha: 1)
let yellow = NSColor(srgbRed: 0xFF / 255, green: 0xD8 / 255, blue: 0x4A / 255, alpha: 1)
let paper = NSColor(calibratedRed: 0.985, green: 0.978, blue: 0.962, alpha: 1)
let ink = NSColor(calibratedRed: 0.16, green: 0.16, blue: 0.18, alpha: 0.92)

// Header: same unit and layout as frame.swift so slide 1 lines up with the other shots.
let u = min(W, H * 0.62) / 100
let margin = 7 * u
let fontSize = 7.6 * u
let font = NSFont(name: "BricolageGrotesque-ExtraBold", size: fontSize) ?? NSFont.boldSystemFont(ofSize: fontSize)
let para = NSMutableParagraphStyle()
para.lineHeightMultiple = 0.98
let text = NSAttributedString(string: caption, attributes: [.font: font, .foregroundColor: NSColor.white, .paragraphStyle: para, .kern: -0.01 * fontSize])
let textW = min(W - 2 * margin, 86 * u)
let textBox = text.boundingRect(with: NSSize(width: textW, height: 1000 * u), options: [.usesLineFragmentOrigin])
let topPad = 9 * u
let barY = topPad + textBox.height + 3.2 * u
let headerH = barY + 0.9 * u + 7 * u

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
let tooth = 2.2 * u
page.setFill()
var x: CGFloat = 0
while x < W + tooth {
  NSBezierPath(ovalIn: NSRect(x: x, y: headerH - tooth / 2, width: tooth, height: tooth)).fill()
  x += tooth
}

// The slip, drawn in its own units (s) around its top centre, then scaled to fit under the header.
let s = u
let slipW = 76 * s, pad = 8 * s, lh = 7.6 * s, scallop = 2.6 * s
let slipH = pad * 2 + CGFloat(lines.count) * lh
let mono = NSFont.monospacedSystemFont(ofSize: 4.3 * s, weight: .medium)
let bold = NSFont.monospacedSystemFont(ofSize: 4.9 * s, weight: .bold)
let areaTop = headerH + 7 * u, areaH = H - areaTop - 7 * u
let fit = min(1, areaH / (slipH + scallop + 4 * s), (W - 2 * margin) / (slipW + 4 * s))
let top = areaTop + (areaH - (slipH + scallop) * fit) / 2

cg.saveGState()
cg.translateBy(x: W / 2, y: top)
cg.scaleBy(x: fit, y: fit)
cg.rotate(by: -0.022)
let shadow = NSShadow()
shadow.shadowColor = NSColor(white: 0, alpha: 0.18)
shadow.shadowBlurRadius = 5 * s
shadow.shadowOffset = NSSize(width: 0, height: -1.6 * s)
NSGraphicsContext.saveGraphicsState()
shadow.set()
cg.beginTransparencyLayer(auxiliaryInfo: nil)
paper.setFill()
NSRect(x: -slipW / 2, y: 0, width: slipW, height: slipH).fill()
// Torn bottom: paper-coloured bumps hanging off the bottom edge.
// A whole number of bumps, so none overhangs the right edge.
let bumps = (slipW / (scallop * 2)).rounded(.down)
let d = slipW / bumps
for k in 0..<Int(bumps) {
  NSBezierPath(ovalIn: NSRect(x: -slipW / 2 + CGFloat(k) * d, y: slipH - d / 2, width: d, height: d)).fill()
}
cg.endTransparencyLayer()
NSGraphicsContext.restoreGraphicsState()

let left = -slipW / 2 + pad, right = slipW / 2 - pad
for (i, raw) in lines.enumerated() {
  let y = pad + CGFloat(i) * lh
  let parts = raw.components(separatedBy: "\t")
  let isTotal = parts.count == 2 && parts[0].hasPrefix("TOTAL")
  let f = (i == 0 || isTotal) ? bold : mono
  let attrs: [NSAttributedString.Key: Any] = [.font: f, .foregroundColor: ink]
  let lineH = ("0" as NSString).size(withAttributes: attrs).height
  let ty = y + (lh - lineH) / 2
  if isTotal {
    yellow.withAlphaComponent(0.85).setFill()
    NSBezierPath(roundedRect: NSRect(x: left - 2 * s, y: y + 0.4 * s, width: right - left + 4 * s, height: lh - 0.8 * s), xRadius: 1.2 * s, yRadius: 1.2 * s).fill()
  }
  if raw.isEmpty, i + 1 < lines.count, lines[i + 1].hasPrefix("TOTAL") {
    // Dashed rule above TOTAL, as on a till receipt.
    let dash = NSBezierPath()
    dash.move(to: NSPoint(x: left, y: y + lh / 2)); dash.line(to: NSPoint(x: right, y: y + lh / 2))
    dash.lineWidth = 0.35 * s
    dash.setLineDash([1.4 * s, 1.1 * s], count: 2, phase: 0)
    ink.withAlphaComponent(0.55).setStroke(); dash.stroke()
  }
  if parts.count == 2 {
    (parts[0] as NSString).draw(at: NSPoint(x: left, y: ty), withAttributes: attrs)
    let r = parts[1] as NSString
    r.draw(at: NSPoint(x: right - r.size(withAttributes: attrs).width, y: ty), withAttributes: attrs)
  } else if !raw.isEmpty {
    let t = raw as NSString
    t.draw(at: NSPoint(x: -t.size(withAttributes: attrs).width / 2, y: ty), withAttributes: attrs)
  }
}
cg.restoreGState()

NSGraphicsContext.current = nil
try! NSBitmapImageRep(cgImage: cg.makeImage()!).representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: a[7]))
