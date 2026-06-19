import { describe, it, expect, afterEach, vi } from "vitest";
import { decideBackend, isIOSDevice } from "./capabilities";

describe("decideBackend", () => {
  const base = {
    override: null,
    xrAr: false,
    hasGetUserMedia: false,
    secureContext: true,
    isIOS: false,
  } as const;

  it("prefers WebXR AR when available (Quest/HoloLens/ARCore)", () => {
    expect(decideBackend({ ...base, xrAr: true }).backend).toBe("webxr-ar");
  });

  it("falls back to magic-window when no WebXR but camera + secure context (iPad)", () => {
    const r = decideBackend({
      ...base,
      xrAr: false,
      hasGetUserMedia: true,
      isIOS: true,
    });
    expect(r.backend).toBe("magic-window");
    expect(r.reason).toMatch(/iOS/);
  });

  it("uses magic-window on a non-iOS webcam device too", () => {
    expect(
      decideBackend({ ...base, hasGetUserMedia: true }).backend,
    ).toBe("magic-window");
  });

  it("drops to preview without a camera", () => {
    const r = decideBackend({ ...base, hasGetUserMedia: false });
    expect(r.backend).toBe("preview");
    expect(r.reason).toMatch(/getUserMedia/);
  });

  it("drops to preview when camera exists but context is insecure", () => {
    const r = decideBackend({
      ...base,
      hasGetUserMedia: true,
      secureContext: false,
    });
    expect(r.backend).toBe("preview");
    expect(r.reason).toMatch(/Secure Context/i);
  });

  it("honours an explicit ?backend= override over detection", () => {
    expect(
      decideBackend({ ...base, override: "preview", xrAr: true }).backend,
    ).toBe("preview");
    expect(
      decideBackend({ ...base, override: "webxr-ar" }).backend,
    ).toBe("webxr-ar");
  });
});

describe("isIOSDevice", () => {
  afterEach(() => vi.unstubAllGlobals());

  function stubNavigator(nav: Partial<Navigator>) {
    vi.stubGlobal("navigator", nav as Navigator);
  }

  it("detects a classic iPad UA", () => {
    stubNavigator({ userAgent: "Mozilla/5.0 (iPad; CPU OS 16_0)", platform: "iPad", maxTouchPoints: 5 });
    expect(isIOSDevice()).toBe(true);
  });

  it("detects iPadOS desktop-mode spoof (MacIntel + touch points)", () => {
    stubNavigator({ userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X)", platform: "MacIntel", maxTouchPoints: 5 });
    expect(isIOSDevice()).toBe(true);
  });

  it("does not flag a real Mac (no touch points)", () => {
    stubNavigator({ userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X)", platform: "MacIntel", maxTouchPoints: 0 });
    expect(isIOSDevice()).toBe(false);
  });
});
