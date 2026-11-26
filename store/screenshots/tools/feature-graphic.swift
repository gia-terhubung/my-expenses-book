// Play Store feature graphic, 1024 x 500, one per language: slip green with the icon, the app
// name and the store subtitle on the left; a tilted paper receipt on the right whose TOTAL line
// carries the yellow highlighter, and the app's torn edge along the bottom. The current graphic is
// fed zero-receipt.json and the 00-free caption from captions.json as the subtitle.
// Usage: swift feature-graphic.swift <bold.ttf> <extrabold.ttf> <icon.png> <slips.json> <lang> <subtitle> <out.png>
import AppKit

let a = CommandLine.arguments
for f in [a[1], a[2]] { CTFontManagerRegisterFontsForURL(URL(fileURLWithPath: f) as CFURL, .process, nil) }
let icon = NSImage(contentsOfFile: a[3])!
let slips = try! JSONSerialization.jsonObject(with: Data(contentsOf: URL(fileURLWithPath: a[4]))) as! [String: [String]]
let lines = slips[a[5]]!
// A multi-sentence subtitle breaks before its last sentence ("Free. No ads." / "Works offline.").
let subtitle: String = {
  guard let r = a[6].range(of: ". ", options: .backwards) else { return a[6] }
  return a[6].replacingCharacters(in: r, with: ".\n")
}()

let W: CGFloat = 1024, H: CGFloat = 500
let green = NSColor(srgbRed: 0x1F / 255, green: 0x5C / 255, blue: 0x4C / 255, alpha: 1)
let page = NSColor(srgbRed: 0xF2 / 255, green: 0xF5 / 255, blue: 0xF1 / 255, alpha: 1)
let yellow = NSColor(srgbRed: 0xFF / 255, green: 0xD8 / 255, blue: 0x4A / 255, alpha: 0.85)
let mint = NSColor(srgbRed: 0xBF / 255, green: 0xD9 / 255, blue: 0xCF / 255, alpha: 1)
let ink = NSColor(calibratedRed: 0.16, green: 0.16, blue: 0.18, alpha: 0.92)

let cg = CGContext(
  data: nil, width: Int(W), height: Int(H), bitsPerComponent: 8, bytesPerRow: 0,
  space: CGColorSpace(name: CGColorSpace.sRGB)!, bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue)!
cg.translateBy(x: 0, y: H)
cg.scaleBy(x: 1, y: -1)
NSGraphicsContext.current = NSGraphicsContext(cgContext: cg, flipped: true)

green.setFill(); NSRect(x: 0, y: 0, width: W, height: H).fill()

// Right: the receipt, tilted, running off the bottom edge.
let paperW: CGFloat = 330, lh: CGFloat = 25, pad: CGFloat = 26
let shown = Array(lines.prefix(while: { !$0.hasPrefix("TUNAI") && !$0.hasPrefix("VISA") && !$0.hasPrefix("TARJETA") && !$0.hasPrefix("CARTAO") }))
let paperH = CGFloat(shown.count) * lh + pad * 2 + 40
NSGraphicsContext.saveGraphicsState()
cg.translateBy(x: 760, y: 60)
cg.rotate(by: 0.025)  // Gentle: a steeper tilt makes amounts read as the next row.
let shadow = NSShadow(); shadow.shadowColor = NSColor(white: 0, alpha: 0.35); shadow.shadowBlurRadius = 24; shadow.shadowOffset = NSSize(width: 0, height: -8)
NSGraphicsContext.saveGraphicsState(); shadow.set()
NSColor(calibratedRed: 0.985, green: 0.978, blue: 0.962, alpha: 1).setFill()
NSRect(x: -paperW / 2, y: 0, width: paperW, height: paperH).fill()
NSGraphicsContext.restoreGraphicsState()
let mono = NSFont.monospacedSystemFont(ofSize: 14, weight: .medium)
let head = NSFont.monospacedSystemFont(ofSize: 16, weight: .bold)
for (i, raw) in shown.enumerated() {
  let y = pad + CGFloat(i) * lh
  let parts = raw.components(separatedBy: "\t")
  let isTotal = parts.count == 2 && (parts[0].hasPrefix("TOTAL") || parts[0].hasPrefix("VALOR TOTAL"))
  if isTotal {
    yellow.setFill()
    NSBezierPath(roundedRect: NSRect(x: -paperW / 2 + pad - 8, y: y - 3, width: paperW - 2 * pad + 16, height: lh + 2), xRadius: 4, yRadius: 4).fill()
  }
  let attrs: [NSAttributedString.Key: Any] = [.font: i == 0 ? head : (isTotal ? head : mono), .foregroundColor: ink]
  if parts.count == 2 {
    (parts[0] as NSString).draw(at: NSPoint(x: -paperW / 2 + pad, y: y), withAttributes: attrs)
    let r = parts[1] as NSString
    r.draw(at: NSPoint(x: paperW / 2 - pad - r.size(withAttributes: attrs).width, y: y), withAttributes: attrs)
  } else {
    let s = raw as NSString
    // Header lines and a closing line (the zero receipt's thank-you) are centred.
    let x = i < 5 || i == shown.count - 1 ? -s.size(withAttributes: attrs).width / 2 : -paperW / 2 + pad
    s.draw(at: NSPoint(x: x, y: y), withAttributes: attrs)
  }
}
NSGraphicsContext.restoreGraphicsState()

// Left: icon, name, subtitle, and the yellow bar from under the month total.
let left: CGFloat = 64
let iconSize: CGFloat = 96
NSGraphicsContext.saveGraphicsState()
NSBezierPath(roundedRect: NSRect(x: left, y: 104, width: iconSize, height: iconSize), xRadius: 22, yRadius: 22).addClip()
icon.draw(in: NSRect(x: left, y: 104, width: iconSize, height: iconSize), from: .zero, operation: .sourceOver, fraction: 1, respectFlipped: true, hints: nil)
NSGraphicsContext.restoreGraphicsState()
let title = NSAttributedString(string: "My Expenses Book", attributes: [
  .font: NSFont(name: "BricolageGrotesque-ExtraBold", size: 54)!, .foregroundColor: NSColor.white, .kern: -0.6,
])
title.draw(at: NSPoint(x: left, y: 222))
NSColor(srgbRed: 0xFF / 255, green: 0xD8 / 255, blue: 0x4A / 255, alpha: 1).setFill()
NSBezierPath(roundedRect: NSRect(x: left, y: 300, width: 44, height: 5), xRadius: 2.5, yRadius: 2.5).fill()
// Wraps, so a long subtitle (the zero receipt's "Free. No ads. Works offline.") stays clear of the slip.
NSAttributedString(string: subtitle, attributes: [
  .font: NSFont(name: "BricolageGrotesque-Bold", size: 28)!, .foregroundColor: mint,
]).draw(with: NSRect(x: left, y: 322, width: 470, height: 120), options: [.usesLineFragmentOrigin])

// Torn edge along the bottom, in page colour.
page.setFill()
var x: CGFloat = 0
let tooth: CGFloat = 16
while x < W + tooth { NSBezierPath(ovalIn: NSRect(x: x, y: H - tooth / 2, width: tooth, height: tooth)).fill(); x += tooth }

NSGraphicsContext.current = nil
try! NSBitmapImageRep(cgImage: cg.makeImage()!).representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: a[7]))
