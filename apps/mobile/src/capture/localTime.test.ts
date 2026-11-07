import { deviceTimeZone, formatLocal, localToUtc } from "./localTime";

describe("local time helpers", () => {
  it("formats an instant as wall time in a zone", () => {
    const t = new Date(Date.UTC(2026, 10, 5, 3, 4, 5));
    expect(formatLocal(t, "Asia/Jakarta")).toBe("2026-11-05T10:04:05");
    expect(formatLocal(t, "America/New_York")).toBe("2026-11-04T22:04:05");
  });

  it("converts wall time in a zone to UTC ms, across DST", () => {
    expect(localToUtc("2026-11-05T10:04:05", "Asia/Jakarta")).toBe(Date.UTC(2026, 10, 5, 3, 4, 5));
    expect(localToUtc("2026-07-01T12:00:00", "America/New_York")).toBe(Date.UTC(2026, 6, 1, 16, 0, 0));
    expect(localToUtc("2026-12-01T12:00:00", "America/New_York")).toBe(Date.UTC(2026, 11, 1, 17, 0, 0));
  });

  it("treats an unknown zone as UTC", () => {
    expect(localToUtc("2026-11-05T10:00:00", "Not/AZone")).toBe(Date.UTC(2026, 10, 5, 10, 0, 0));
    expect(formatLocal(new Date(Date.UTC(2026, 10, 5, 10, 0, 0)), "Not/AZone")).toBe("2026-11-05T10:00:00");
  });

  it("reads the device zone", () => {
    expect(typeof deviceTimeZone()).toBe("string");
  });
});
