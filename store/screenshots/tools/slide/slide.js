// Draws one store slide from the query string (see tools/render-one.sh):
//   w, h      page size in px (the store size; the window is exactly this big)
//   device    android | iphone | ipad | tablet | duo-closed | duo-open
//   raw       capture to show on the device's screen (relative to this page or a file: URL)
//   caption   the slide's caption text
// Sets <body data-status> to "ok", "overflow" (caption does not fit its box) or "aspect" (the
// capture's shape differs from the device's screen by more than 2%), read by render-one.sh.
(async () => {
  const q = new URLSearchParams(location.search);
  const W = Number(q.get("w"));
  const H = Number(q.get("h"));
  const status = (s) => (document.body.dataset.status = s);

  // Screen shape (width / height) and frame proportions, as fractions of the device's width.
  const DEVICES = {
    iphone: { aspect: 1320 / 2868, bezel: 0.034, radius: 0.16, island: true },
    android: { aspect: 720 / 1640, bezel: 0.026, radius: 0.1, punch: true },
    ipad: { aspect: 2064 / 2752, bezel: 0.04, radius: 0.06, camera: true },
    tablet: { aspect: 2064 / 2752, bezel: 0.045, radius: 0.05 },
    "duo-closed": { aspect: 1398 / 2034, bezel: 0.03, radius: 0.12, spine: true },
    "duo-open": { aspect: 2853 / 2007, bezel: 0.022, radius: 0.05, fold: true },
  };
  const spec = DEVICES[q.get("device")];
  if (!spec) return status("device");

  // Page: caption on top, band at the bottom, device in between (tipped, may run off the bottom).
  const gutter = W * 0.07;
  const fontPx = Math.min(W * 0.085, H * 0.042);
  const capTop = W * 0.065;
  const capLines = 3;
  // Room for descenders on the last line.
  const capBox = fontPx * (1.04 * capLines + 0.22);
  const cap = document.createElement("h1");
  cap.className = "caption";
  cap.textContent = q.get("caption") || "";
  Object.assign(cap.style, {
    left: `${gutter}px`,
    right: `${gutter}px`,
    top: `${capTop}px`,
    height: `${capBox}px`,
    fontSize: `${fontPx}px`,
  });
  document.body.append(cap);

  const zig = W * 0.022;
  const band = document.createElement("div");
  band.className = "band";
  band.style.height = `${H * 0.17}px`;
  band.style.setProperty("--zig", `${zig}px`);
  document.body.append(band);

  // Device size: as wide as fits, but a sideways device also may not be taller than the free space.
  const top = capTop + capBox + W * 0.06;
  const free = H - top;
  let dw = W * (spec.aspect > 1 ? 0.9 : 0.78);
  const dh = (d) => (d - 2 * d * spec.bezel) / spec.aspect + 2 * d * spec.bezel;
  if (spec.aspect > 1 && dh(dw) > free * 0.8) dw = (free * 0.8) / (dh(dw) / dw);
  const device = document.createElement("div");
  device.className = "device";
  const b = dw * spec.bezel;
  Object.assign(device.style, {
    width: `${dw}px`,
    height: `${dh(dw)}px`,
    left: `${(W - dw) / 2}px`,
    top: `${spec.aspect > 1 ? top + (free * 0.83 - dh(dw)) / 2 : top}px`,
    padding: `${b}px`,
    borderRadius: `${dw * spec.radius}px`,
    transform: "rotate(-4deg)",
  });
  const screen = document.createElement("div");
  screen.className = "screen";
  screen.style.borderRadius = `${Math.max(dw * spec.radius - b, 0)}px`;
  const img = document.createElement("img");
  img.src = q.get("raw");
  screen.append(img);
  device.append(screen);
  // Shape details that tell the devices apart (also listed in <body data-marks> for the tests).
  const mark = (parent, style) => {
    const m = document.createElement("div");
    m.className = "mark";
    Object.assign(m.style, style);
    parent.append(m);
  };
  const sw = dw - 2 * b; // screen width
  const px = (n) => `${n}px`;
  let marks = "plain";
  if (spec.island) {
    // iPhone: Dynamic Island.
    mark(screen, { width: px(dw * 0.3), height: px(dw * 0.085), left: px((sw - dw * 0.3) / 2), top: px(dw * 0.03), borderRadius: px(dw * 0.05) });
    marks = "island";
  } else if (spec.punch) {
    // Android: punch-hole camera.
    const d = dw * 0.032;
    mark(screen, { width: px(d), height: px(d), left: px((sw - d) / 2), top: px(dw * 0.026), borderRadius: "50%" });
    marks = "punch";
  } else if (spec.camera) {
    // iPad: front camera in the top bezel.
    const d = dw * 0.012;
    mark(device, { width: px(d), height: px(d), left: px((dw - d) / 2), top: px((b - d) / 2), borderRadius: "50%", background: "#2c2c2c" });
    marks = "camera";
  } else if (spec.spine) {
    // Duo closed: the hinge spine along the left edge.
    mark(device, { width: px(dw * 0.035), height: px(dh(dw) * 0.94), left: px(-dw * 0.028), top: px(dh(dw) * 0.03), borderRadius: px(dw * 0.02), background: "#2b2b2b", zIndex: -1 });
    marks = "spine";
  } else if (spec.fold) {
    // Duo open: the crease down the middle of the inner screen.
    mark(screen, {
      width: px(dw * 0.006), top: "0", bottom: "0", left: px((sw - dw * 0.006) / 2),
      background: "linear-gradient(90deg, rgba(0,0,0,0), rgba(0,0,0,0.14), rgba(0,0,0,0))",
    });
    marks = "fold";
  }
  document.body.dataset.marks = marks;
  document.body.append(device);

  // Decide on the window's load event: the image (added before it) and the caption font have loaded
  // by then. Awaiting decode() instead raced Chrome's --dump-dom.
  if (document.readyState !== "complete") await new Promise((r) => addEventListener("load", r, { once: true }));
  if (!img.naturalWidth) return status("raw");
  const rawAspect = img.naturalWidth / img.naturalHeight;
  if (Math.abs(rawAspect / spec.aspect - 1) > 0.02) return status("aspect");
  if (cap.scrollHeight > cap.clientHeight + 1) return status("overflow");
  status("ok");
})();
