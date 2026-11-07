import { createPendingCaptures, resolveCaptureRequest } from "./pendingCapture";

describe("pending captures", () => {
  it("hands URIs over once per random token", () => {
    const pending = createPendingCaptures();
    const a = pending.put("photos", ["file:///c/ImagePicker/1.jpg", "file:///c/ImagePicker/2.jpg"]);
    const b = pending.put("scan", ["file:///c/ImagePicker/3.jpg"]);
    expect(a).toMatch(/^[0-9a-f]{32}$/);
    expect(a).not.toBe(b);
    expect(pending.take(a)).toEqual({ mode: "photos", uris: ["file:///c/ImagePicker/1.jpg", "file:///c/ImagePicker/2.jpg"] });
    expect(pending.take(a)).toBeNull();
    expect(pending.take("0".repeat(32))).toBeNull();
    expect(pending.take(undefined)).toBeNull();
    expect(pending.take(b)?.mode).toBe("scan");
  });
});

describe("resolveCaptureRequest", () => {
  const uris = encodeURIComponent(JSON.stringify(["file:///c/ImagePicker/x.jpg"]));

  it("ignores URIs in route params outside dev builds", () => {
    const pending = createPendingCaptures();
    expect(resolveCaptureRequest({ mode: "photos", uris: decodeURIComponent(uris) }, { dev: false, pending })).toBeNull();
  });

  it("uses a pending token: photos = one group per photo, scan = one group", () => {
    const pending = createPendingCaptures();
    const t1 = pending.put("photos", ["a", "b"]);
    expect(resolveCaptureRequest({ token: t1 }, { dev: false, pending })).toEqual([["a"], ["b"]]);
    expect(resolveCaptureRequest({ token: t1 }, { dev: false, pending })).toBeNull();
    const t2 = pending.put("scan", ["p1", "p2"]);
    expect(resolveCaptureRequest({ token: t2, uris: '["evil"]' }, { dev: false, pending })).toEqual([["p1", "p2"]]);
  });

  it("accepts param URIs only in dev builds (simulator checks)", () => {
    const pending = createPendingCaptures();
    expect(resolveCaptureRequest({ mode: "photos", uris: '["a","b"]' }, { dev: true, pending })).toEqual([["a"], ["b"]]);
    expect(resolveCaptureRequest({ mode: "photos", uris: "not json" }, { dev: true, pending })).toBeNull();
  });
});
