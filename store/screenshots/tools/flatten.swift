// Writes a copy of a PNG with no alpha channel (RGB, white under any transparency), the way the
// App Store and Play want screenshots. Lossless otherwise.
// Usage: flatten <in.png> <out.png>
import AppKit

let a = CommandLine.arguments
guard a.count == 3, let src = NSImage(contentsOfFile: a[1]),
      let cg = src.cgImage(forProposedRect: nil, context: nil, hints: nil) else {
  FileHandle.standardError.write("usage: flatten <in.png> <out.png>\n".data(using: .utf8)!)
  exit(2)
}
let w = cg.width, h = cg.height
let ctx = CGContext(data: nil, width: w, height: h, bitsPerComponent: 8, bytesPerRow: 0,
                    space: CGColorSpace(name: CGColorSpace.sRGB)!,
                    bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue)!
ctx.setFillColor(CGColor(red: 1, green: 1, blue: 1, alpha: 1))
ctx.fill(CGRect(x: 0, y: 0, width: w, height: h))
ctx.draw(cg, in: CGRect(x: 0, y: 0, width: w, height: h))
let rep = NSBitmapImageRep(cgImage: ctx.makeImage()!)
try! rep.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: a[2]))
