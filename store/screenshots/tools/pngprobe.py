"""Prints a PNG's size and whether it has alpha; with x y, also the pixel colour there.

Usage: python3 tools/pngprobe.py <png> [x y]
Output: "W H alpha=<yes|no>" and, with x y, a second line "#RRGGBB". Standard library only.
"""
import struct
import sys
import zlib

CHANNELS = {0: 1, 2: 3, 3: 1, 4: 2, 6: 4}


def read(path):
    data = open(path, "rb").read()
    if data[:8] != b"\x89PNG\r\n\x1a\n":
        sys.exit(f"{path}: not a PNG")
    pos, chunks = 8, []
    while pos < len(data):
        (length,) = struct.unpack(">I", data[pos : pos + 4])
        kind = data[pos + 4 : pos + 8]
        chunks.append((kind, data[pos + 8 : pos + 8 + length]))
        pos += 12 + length
    return chunks


def pixel(chunks, w, depth, ctype, x, y):
    if depth != 8 or ctype not in (2, 6):
        sys.exit("pixel lookup supports 8-bit RGB and RGBA only")
    bpp = CHANNELS[ctype]
    raw = zlib.decompress(b"".join(c for k, c in chunks if k == b"IDAT"))
    stride = w * bpp
    prev = bytearray(stride)
    for row in range(y + 1):
        start = row * (stride + 1)
        ftype, line = raw[start], bytearray(raw[start + 1 : start + 1 + stride])
        for i in range(stride):
            a = line[i - bpp] if i >= bpp else 0
            b = prev[i]
            c = prev[i - bpp] if i >= bpp else 0
            if ftype == 1:
                line[i] = (line[i] + a) & 255
            elif ftype == 2:
                line[i] = (line[i] + b) & 255
            elif ftype == 3:
                line[i] = (line[i] + (a + b) // 2) & 255
            elif ftype == 4:
                p = a + b - c
                pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
                pred = a if pa <= pb and pa <= pc else (b if pb <= pc else c)
                line[i] = (line[i] + pred) & 255
        prev = line
    r, g, b = prev[x * bpp : x * bpp + 3]
    return f"#{r:02X}{g:02X}{b:02X}"


def main():
    path = sys.argv[1]
    chunks = read(path)
    w, h, depth, ctype = struct.unpack(">IIBB", chunks[0][1][:10])
    alpha = ctype in (4, 6) or any(k == b"tRNS" for k, _ in chunks)
    print(f"{w} {h} alpha={'yes' if alpha else 'no'}")
    if len(sys.argv) == 4:
        print(pixel(chunks, w, depth, ctype, int(sys.argv[2]), int(sys.argv[3])))


if __name__ == "__main__":
    main()
