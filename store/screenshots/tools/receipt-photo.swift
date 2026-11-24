// Renders one store-shot receipt photo: a thermal paper slip lying on a table, from the
// "name<TAB>amount" lines in apps/mobile/src/dev/storeShotSlips.json.
// Usage: swift receipt-photo.swift <slips.json> <lang> <out.jpg>
import AppKit

let args = CommandLine.arguments
let data = try! Data(contentsOf: URL(fileURLWithPath: args[1]))
let all = try! JSONSerialization.jsonObject(with: data) as! [String: [String]]
let lines = all[args[2]]!

let paperW: CGFloat = 860, pad: CGFloat = 64, lh: CGFloat = 46
let paperH = CGFloat(lines.count) * lh + pad * 2 + 40
// A tight crop, as a person framing a receipt photo would: a little table on every side.
let W: CGFloat = paperW + 120, H: CGFloat = paperH + 140
let mono = NSFont.monospacedSystemFont(ofSize: 29, weight: .medium)
let head = NSFont.monospacedSystemFont(ofSize: 34, weight: .bold)
let ink = NSColor(calibratedRed: 0.16, green: 0.16, blue: 0.18, alpha: 0.92)

let img = NSImage(size: NSSize(width: W, height: H))
img.lockFocus()
// Table: warm grey with a soft vignette.
NSColor(calibratedRed: 0.55, green: 0.53, blue: 0.50, alpha: 1).setFill()
NSRect(x: 0, y: 0, width: W, height: H).fill()
let vignette = NSGradient(colors: [NSColor(white: 1, alpha: 0.10), NSColor(white: 0, alpha: 0.25)])!
vignette.draw(in: NSRect(x: 0, y: 0, width: W, height: H), relativeCenterPosition: .zero)

let px = (W - paperW) / 2, py = (H - paperH) / 2
let ctx = NSGraphicsContext.current!.cgContext
ctx.saveGState()
ctx.translateBy(x: W / 2, y: H / 2)
ctx.rotate(by: -0.012)
ctx.translateBy(x: -W / 2, y: -H / 2)
let shadow = NSShadow()
shadow.shadowColor = NSColor(white: 0, alpha: 0.35)
shadow.shadowBlurRadius = 28
shadow.shadowOffset = NSSize(width: 0, height: -10)
shadow.set()
let paper = NSRect(x: px, y: py, width: paperW, height: paperH)
NSColor(calibratedRed: 0.985, green: 0.978, blue: 0.962, alpha: 1).setFill()
paper.fill()
NSShadow().set()
// Faint thermal banding.
for i in stride(from: 0, to: Int(paperH), by: 6) {
  NSColor(white: 0, alpha: i % 12 == 0 ? 0.012 : 0.006).setFill()
  NSRect(x: px, y: py + CGFloat(i), width: paperW, height: 2).fill()
}
for (i, raw) in lines.enumerated() {
  let y = py + paperH - pad - CGFloat(i + 1) * lh
  let parts = raw.components(separatedBy: "\t")
  let f = i == 0 ? head : mono
  let attrs: [NSAttributedString.Key: Any] = [.font: f, .foregroundColor: ink]
  if parts.count == 2 {
    (parts[0] as NSString).draw(at: NSPoint(x: px + pad, y: y), withAttributes: attrs)
    let r = parts[1] as NSString
    let s = r.size(withAttributes: attrs)
    r.draw(at: NSPoint(x: px + paperW - pad - s.width, y: y), withAttributes: attrs)
  } else {
    let s = (raw as NSString).size(withAttributes: attrs)
    let x = i < 5 ? px + (paperW - s.width) / 2 : px + pad
    (raw as NSString).draw(at: NSPoint(x: x, y: y), withAttributes: attrs)
  }
}
ctx.restoreGState()
img.unlockFocus()
let rep = NSBitmapImageRep(data: img.tiffRepresentation!)!
try! rep.representation(using: .jpeg, properties: [.compressionFactor: 0.88])!.write(to: URL(fileURLWithPath: args[3]))
print(Int(W), Int(H))
