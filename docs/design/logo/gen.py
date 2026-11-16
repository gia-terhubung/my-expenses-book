import re, pathlib
OUT = pathlib.Path(__file__).parent
OLD = OUT.parent / "logo3" / "logo-preview.html"

def teeth(n, t, r):            # along a bottom edge, drawn right to left
    s = (t - 2*r) / 2
    return "".join(f"h{-s:g} a{r},{r} 0 0 0 {-2*r},0 h{-s:g} " for _ in range(n))
def teeth_top(n, t, r):        # along a top edge, drawn left to right
    s = (t - 2*r) / 2
    return "".join(f"h{s:g} a{r},{r} 0 0 0 {2*r},0 h{s:g} " for _ in range(n))
def teeth_up(n, t, r):         # along a left edge, drawn bottom to top
    s = (t - 2*r) / 2
    return "".join(f"v{-s:g} a{r},{r} 0 0 0 0,{-2*r} v{-s:g} " for _ in range(n))
def rr(x, y, w, h, r):
    return (f"M{x+r},{y} h{w-2*r} a{r},{r} 0 0 1 {r},{r} v{h-2*r} a{r},{r} 0 0 1 {-r},{r} "
            f"h{-(w-2*r)} a{r},{r} 0 0 1 {-r},{-r} v{-(h-2*r)} a{r},{r} 0 0 1 {r},{-r} Z ")

# p = dict(book, paper, ink, ac); mono draws one colour with real gaps.

# 1. Pop-up: the slip stands up out of the open book's gutter like a pop-up page.
def C1(p, mono=False, uid="a"):
    slip = f"M392,720 V238 {teeth_top(4,60,19)}V720 Z "
    lines = rr(432,318,160,36,18) + rr(432,380,100,36,18)
    total = rr(432,456,160,54,27)
    wing = "M512,622 Q392,540 262,574 V704 Q392,672 512,752 Z "
    wing2 = "M512,622 Q632,540 762,574 V704 Q632,672 512,752 Z "
    if mono:
        c = p["book"]
        return (f'<mask id="m1{uid}" maskUnits="userSpaceOnUse" x="0" y="0" width="1024" height="1024"><rect width="1024" height="1024" fill="#fff"/>'
                f'<path d="{wing}{wing2}" fill="#000" stroke="#000" stroke-width="84" stroke-linejoin="round"/></mask>'
                f'<path mask="url(#m1{uid})" fill-rule="evenodd" d="{slip}{lines}{total}" fill="{c}"/>'
                f'<path d="{wing}{wing2}" fill="{c}" stroke="{c}" stroke-width="36" stroke-linejoin="round"/>')
    return (f'<path d="{slip}" fill="{p["paper"]}"/><path d="{lines}" fill="{p["ink"]}"/><path d="{total}" fill="{p["ac"]}"/>'
            f'<path d="{wing}{wing2}" fill="{p["book"]}" stroke="{p["book"]}" stroke-width="36" stroke-linejoin="round"/>')

# 2. Long page: an open book seen from above; the right-hand page keeps going and ends in a torn edge.
def C2(p, mono=False, uid="a"):
    g = '<g transform="translate(512,512) rotate(-6) scale(.93) translate(-512,-545)">'
    cover = rr(252,300,520,320,44)
    left = rr(280,328,216,264,20)
    right = f"M528,348 a20,20 0 0 1 20,-20 H724 a20,20 0 0 1 20,20 V790 {teeth(3,72,22)}Z "
    l1 = rr(312,372,152,30,15) + rr(312,428,152,30,15) + rr(312,484,96,30,15)
    l2 = rr(560,372,152,30,15) + rr(560,428,96,30,15) + rr(560,484,152,30,15)
    total = rr(560,668,152,50,25)
    if mono:
        c = p["book"]
        return g + f'<path fill-rule="evenodd" d="{left}{right}{l1}{l2}{total}" fill="{c}"/></g>'
    return (g + f'<path d="{cover}" fill="{p["book"]}"/><path d="{left}{right}" fill="{p["paper"]}"/>'
            f'<path d="{l1}{l2}" fill="{p["ink"]}"/><path d="{total}" fill="{p["ac"]}"/></g>')

# 3. Folded slip: one till slip folded down the middle, so the slip itself is the open book.
def C3(p, mono=False, uid="a"):
    page = f"M242,0 V350 H0 {teeth_up(4,87.5,26)}Z "
    a = rr(64,62,146,34,17) + rr(110,124,100,34,17) + rr(64,186,146,34,17)
    b = rr(64,62,146,34,17) + rr(110,124,100,34,17)
    total = rr(64,222,146,56,28)
    L = '<g transform="matrix(1,.2,0,1,262,300)">'
    R = '<g transform="matrix(-1,.2,0,1,762,300)">'
    if mono:
        c = p["book"]
        return (L + f'<path fill-rule="evenodd" d="{page}{a}" fill="{c}"/></g>'
                + R + f'<path fill-rule="evenodd" d="{page}{b}{total}" fill="{c}"/></g>')
    return (L + f'<path d="{page}" fill="{p["paper"]}"/><path d="{a}" fill="{p["ink"]}"/></g>'
            + R + f'<path d="{page}" fill="{p["paper"]}"/><path d="{b}" fill="{p["ink"]}"/><path d="{total}" fill="{p["ac"]}"/></g>')

# 4. Book roof: the book is laid face down to keep its place, and the slip hangs out from under it.
def C4(p, mono=False, uid="a"):
    slip = f"M401,400 H623 V772 {teeth(3,74,23)}Z "
    lines = rr(441,536,142,30,15) + rr(441,590,90,30,15)
    total = rr(441,654,142,48,24)
    pages = "M512,340 L770,495 V571 L512,416 L254,571 V495 Z "
    cover = "M512,252 L790,419 V527 L512,360 L234,527 V419 Z "
    if mono:
        c = p["book"]
        return (f'<mask id="m4{uid}" maskUnits="userSpaceOnUse" x="0" y="0" width="1024" height="1024"><rect width="1024" height="1024" fill="#fff"/>'
                f'<path d="{cover}" fill="#000" stroke="#000" stroke-width="100" stroke-linejoin="round"/></mask>'
                f'<path mask="url(#m4{uid})" fill-rule="evenodd" d="{slip}{lines}{total}" fill="{c}"/>'
                f'<path d="{cover}" fill="{c}" stroke="{c}" stroke-width="30" stroke-linejoin="round"/>')
    return (f'<path d="{slip}" fill="{p["ac"]}"/><path d="{lines}{total}" fill="{p["ink"]}"/>'
            f'<path d="{pages}" fill="{p["paper"]}"/>'
            f'<path d="{cover}" fill="{p["book"]}" stroke="{p["book"]}" stroke-width="30" stroke-linejoin="round"/>')

CON = {"1": C1, "2": C2, "3": C3}
MINT, DEEP, SUN, WHITE, NIGHT = "#3DDFA4", "#0F3D32", "#FFD84A", "#FFFFFF", "#0E1513"
def P(bg, book, paper, ink, ac): return dict(bg=bg, book=book, paper=paper, ink=ink, ac=ac)
G = "#101010"
VAR = {
 "1": {"default": P(MINT, DEEP, WHITE, DEEP, SUN), "dark": P(NIGHT, MINT, WHITE, NIGHT, SUN), "tinted": P(G, "#8C8C8C", WHITE, G, "#8C8C8C")},
 "2": {"default": P(SUN, DEEP, WHITE, DEEP, MINT), "dark": P(NIGHT, "#1F5C4C", WHITE, NIGHT, MINT), "tinted": P(G, "#5A5A5A", WHITE, G, "#8C8C8C")},
 "3": {"default": P(DEEP, None, WHITE, DEEP, SUN), "dark": P(NIGHT, None, MINT, NIGHT, SUN), "tinted": P(G, None, WHITE, G, "#8C8C8C")},
 "4": {"default": P(MINT, DEEP, WHITE, DEEP, SUN), "dark": P(NIGHT, MINT, WHITE, NIGHT, SUN), "tinted": P(G, "#8C8C8C", "#D0D0D0", G, WHITE)},
}
HEAD = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">'
defs = ""
for k, f in CON.items():
    c = VAR[k]["default"]
    (OUT / f"concept-{k}.svg").write_text(f'{HEAD}<rect width="1024" height="1024" fill="{c["bg"]}"/>{f(c)}</svg>\n')
    (OUT / f"concept-{k}-mono.svg").write_text(f'{HEAD}{f(P(None,"#000000","#000000","#000000","#000000"),True,"f")}</svg>\n')
    for v, c in VAR[k].items():
        defs += f'<g id="k{k}-{v}"><rect width="1024" height="1024" fill="{c["bg"]}"/>{f(c)}</g>'
    cc = "currentColor"
    defs += f'<g id="k{k}-mono">{f(P(None,cc,cc,cc,cc),True)}</g>'
old = OLD.read_text()
for i in ("z-default", "z-dark", "z-mono", "x-default", "x-dark", "x-mono"):
    m = re.search(rf'<g id="{i}">.*?(?=<g id="|</defs>)', old, re.S)
    defs += m.group(0)

IOS, AND, FULL = "92 92 840 840", "171 171 682 682", "0 0 1024 1024"
def ic(ref, px, shape="", vb=IOS, cls=""):
    return f'<svg class="ic {shape} {cls}" width="{px}" height="{px}" viewBox="{vb}" role="img" aria-label="{ref} at {px}px"><use href="#{ref}"/></svg>'
def fig(cap, *icons): return f'<figure><div class="row">{"".join(icons)}</div><figcaption>{cap}</figcaption></figure>'
def homes(k):
    out = ""
    for mode, v in (("light", "default"), ("dark", "dark")):
        out += f'<div class="home {mode}">'
        out += fig("iOS, 96 and 48 px", ic(f"k{k}-{v}", 96, "squircle"), ic(f"k{k}-{v}", 48, "squircle"))
        out += fig("Android circle, 96 and 48 px", ic(f"k{k}-{v}", 96, "circle", AND), ic(f"k{k}-{v}", 48, "circle", AND))
        th = "th-l" if mode == "light" else "th-d"
        out += fig("Android themed (mono)", ic(f"k{k}-mono", 96, "circle", AND, th), ic(f"k{k}-mono", 48, "circle", AND, th))
        if mode == "dark":
            out += fig("iOS tinted (grey source)", ic(f"k{k}-tinted", 96, "squircle"), ic(f"k{k}-tinted", 48, "squircle"))
        out += "</div>"
    return out

TXT = {
 "1": ("1. Pop-up", "The slip stands up out of the open book's gutter like a pop-up page, torn edge on top, total in yellow.",
       "Mint ground, deep green book, white slip. Weakest point: a book with something standing on it is a shape reading and study apps also use, and the torn top edge goes soft at 48 px."),
 "2": ("2. Long page", "An open book seen from above whose right-hand page keeps going and ends in a torn edge: the page is the receipt.",
       "Sun yellow ground, a slight tilt, mint total. Weakest point: at 48 px the two lined pages can pass for a document or reader app before the torn tail is noticed, and yellow sits furthest from the green UI."),
 "3": ("3. Folded slip", "One till slip folded down the middle, so the slip itself is the open book; the torn ends become the page edges.",
       "Sits on deep green, closest to the app's own slip. Weakest point: the scalloped sides can read as a ticket stub or spiral binding rather than a torn receipt."),
 "4": ("4. Book roof", "The book is laid face down to keep its place, the way you park a paperback, and a yellow slip hangs out from under it.",
       "It doubles as a roof over the receipt, which is the offline, stays-at-home story. Weakest point: PLACEHOLDER4"),
}
PICK = "1"
secs = ""
for k in CON:
    t, idea, note = TXT[k]
    secs += (f'<section><div class="hero">{ic(f"k{k}-default", 300, "squircle")}</div><div><h2>{t}</h2>'
             f'<p class="note">{idea} {note}</p>{homes(k)}</div></section>')
line = '<div class="lineup">' + "".join(
    f'<div class="home {m}">' + "".join(fig(TXT[k][0], ic(f"k{k}-{v}", 60, "squircle")) for k in CON) + "</div>"
    for m, v in (("light", "default"), ("dark", "dark"))) + "</div>"

NAMES = ["Mail", "Maps", "Photos", "Clock", "Notes", "Music", "Weather", "Camera", "Expenses", "Files", "Health", "Store"]
def phone(mode, v, shape, vb):
    cells = ""
    for i, n in enumerate(NAMES):
        if n == "Expenses":
            cells += f'<div class="app">{ic(f"k{PICK}-{v}", 60, shape, vb)}<span>{n}</span></div>'
        else:
            cells += f'<div class="app"><i class="ph {shape} p{i%4}"></i><span>{n}</span></div>'
    dock = "".join(f'<i class="ph {shape} p{i}"></i>' for i in (2, 0, 3, 1))
    return (f'<div class="phone {mode}"><div class="clock">9:41</div><div class="grid">{cells}</div>'
            f'<div class="dock">{dock}</div></div>')
mock = ('<section class="ctx" id="context"><div><h2>On a home screen</h2>'
        f'<p class="note">{TXT[PICK][0][3:]} at 60 px among grey placeholder apps, so only its own colour and shape compete for the eye. Left is an iOS-style light screen, right an Android-style dark screen with circle masks.</p></div>'
        f'<div class="phones">{phone("light","default","squircle",IOS)}{phone("dark","default","circle",AND)}</div></section>')

def trio(v, px, shape, t=""):
    if v == "mono":
        return tuple(ic(f"{r}-mono", px, shape, AND, t) for r in (f"k{PICK}", "z", "x"))
    return tuple(ic(f"{r}-{v}", px, shape, AND if shape == "circle" else IOS) for r in (f"k{PICK}", "z", "x"))
cmp_ = (f'<section class="cmp"><div class="hero trio">{"".join(trio("default", 96, "squircle"))}</div>'
        f'<div><h2>Recommended: {TXT[PICK][0][3:]}, next to round 3</h2>'
        '<p class="note">In every group: the new pick, then round 3\'s pocket grin (Z), then round 3\'s slip buddy (X). Same mint, yellow and deep green; the difference is that the book is now open and the receipt is doing something with it.</p>'
        + "".join(f'<div class="home {m}">'
            + fig("iOS 96 px", *trio(v, 96, "squircle"))
            + fig("iOS 48 px", *trio(v, 48, "squircle"))
            + fig("Android 48 px", *trio(v, 48, "circle"))
            + fig("Themed 48 px", *trio("mono", 48, "circle", t))
            + "</div>" for m, v, t in (("light", "default", "th-l"), ("dark", "dark", "th-d")))
        + "</div></section>")

css = """:root{--page:#EEF4F0;--ink:#0F3D32;--muted:#4C6259;--line:#CFDDD5}
*{box-sizing:border-box}
body{margin:0;background:var(--page);color:var(--ink);font:15px/1.5 system-ui,sans-serif}
main{max-width:1080px;margin:0 auto;padding:40px 20px 80px}
h1,h2{font-family:"Bricolage Grotesque",system-ui,sans-serif;letter-spacing:-.01em;margin:0}
h1{font-size:40px;line-height:1.1} h2{font-size:26px;line-height:1.2}
.lede{max-width:62ch;color:var(--muted);margin:10px 0 28px}
.lineup{display:flex;flex-wrap:wrap;gap:12px;margin-bottom:12px}
.lineup .home{margin:0;flex:1 1 300px}
section{display:grid;grid-template-columns:300px 1fr;gap:28px;padding:32px 0;border-top:1px solid var(--line)}
.note{max-width:64ch;margin:6px 0 16px}
.ic{display:block;flex:none} .circle{border-radius:50%} .squircle{border-radius:22.4%}
.hero .ic{max-width:100%;height:auto;box-shadow:0 10px 30px rgba(15,61,50,.18)}
.hero.trio{display:flex;gap:8px;align-items:flex-start}
.home{display:flex;flex-wrap:wrap;gap:22px 30px;padding:18px 20px;border-radius:14px;margin-top:12px}
.home.light{background:#C9D6CF;color:#16201C} .home.dark{background:#0B100F;color:#EEF3F0}
figure{margin:0;display:grid;gap:8px}
.row{display:flex;gap:14px;align-items:flex-end}
figcaption{font-size:12px;opacity:.75}
.home.dark .ic{outline:1px solid rgba(255,255,255,.08)}
.th-l{background:#E3EEE8;color:#1F5C4C} .th-d{background:#1E3A32;color:#74C9AE}
section.ctx{grid-template-columns:300px 1fr}
.phones{display:flex;flex-wrap:wrap;gap:24px}
.phone{width:340px;border-radius:40px;padding:22px 20px 16px;border:6px solid #16201C}
.phone.light{background:#D5DAD7;color:#16201C} .phone.dark{background:#15191A;color:#EEF3F0;border-color:#000}
.clock{font:700 15px/1 system-ui,sans-serif;margin:0 0 26px 6px}
.grid{display:grid;grid-template-columns:repeat(4,60px);justify-content:space-between;gap:20px 0}
.app{display:grid;justify-items:center;gap:5px} .app span{font-size:11px;line-height:1.2}
.ph{display:block;width:60px;height:60px}
.light .p0{background:#B9C0BC} .light .p1{background:#A8B0AB} .light .p2{background:#C4CAC6} .light .p3{background:#9DA6A1}
.dark .p0{background:#33393A} .dark .p1{background:#3D4445} .dark .p2{background:#2B3031} .dark .p3{background:#474E4F}
.dock{display:flex;justify-content:space-between;margin-top:54px;padding:12px;border-radius:26px;background:rgba(255,255,255,.28)}
.dark .dock{background:rgba(255,255,255,.07)}
@media(max-width:760px){section,section.ctx{grid-template-columns:1fr} .hero{max-width:300px} h1{font-size:30px}}"""
html = f"""<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>My Expenses Book logo options, round 4</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,700&display=swap" rel="stylesheet">
<style>{css}</style></head><body>
<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>{defs}</defs></svg>
<main><h1>An open book and a receipt, three ways</h1>
<p class="lede">Every mark here has both things you asked for: a book that is open and a till slip, joined into one shape. The colours carry on from round 3 (mint, sun yellow, deep green, white), drawn flat with round corners. Below, the three at home-screen size (60 px), then each in detail, then the pick on a phone and next to round 3. The art sits inside the Android safe zone; the iOS icon uses the same art scaled up.</p>
{line}{secs}{mock}{cmp_}</main></body></html>"""
(OUT / "logo-preview.html").write_text(html)
