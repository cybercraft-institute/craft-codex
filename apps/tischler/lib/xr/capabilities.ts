"use client";

/**
 * Backend-Erkennung: welcher Präsentationspfad fürs geführte AR passt.
 *
 *  - "webxr-ar"     immersive WebXR (Quest 3, HoloLens 2, Android/ARCore)
 *  - "magic-window" Kamera-Fallback (iPad/iOS — KEIN WebXR — + Webcam-Desktop,
 *                   no-XR Android): getUserMedia-Video + 3D-Overlay + Marker-CV
 *  - "preview"      schlichte 3D-Orbit-Vorschau (Desktop ohne Kamera, CI)
 *
 * Die Entscheidung (`decideBackend`) ist rein und damit testbar; das Sammeln
 * der Browser-Signale (`detectCapabilities`) ist SSR-fest wie detectXRSupport.
 */

import { detectXRSupport } from "./support";

export type Backend = "webxr-ar" | "magic-window" | "preview";

export interface DeviceCapabilities {
  backend: Backend;
  xrAr: boolean;
  xrVr: boolean;
  hasGetUserMedia: boolean;
  isIOS: boolean;
  reason?: string;
}

export interface BackendInputs {
  /** Manuelles Override via ?backend= (CI/Desktop). */
  override: Backend | null;
  xrAr: boolean;
  hasGetUserMedia: boolean;
  /** getUserMedia braucht einen Secure Context (https / localhost). */
  secureContext: boolean;
  isIOS: boolean;
  xrReason?: string;
}

/** Reine Backend-Entscheidung — keine Globals, voll unit-testbar. */
export function decideBackend(i: BackendInputs): {
  backend: Backend;
  reason?: string;
} {
  if (i.override) {
    return { backend: i.override, reason: `override: ?backend=${i.override}` };
  }
  if (i.xrAr) {
    return { backend: "webxr-ar" };
  }
  if (i.hasGetUserMedia && i.secureContext) {
    return {
      backend: "magic-window",
      reason: i.isIOS ? "iOS: kein WebXR — Kamera-Fallback" : i.xrReason,
    };
  }
  const reason = !i.hasGetUserMedia
    ? "keine Kamera (getUserMedia)"
    : !i.secureContext
      ? "kein Secure Context (https nötig)"
      : (i.xrReason ?? "keine AR-Fähigkeit");
  return { backend: "preview", reason };
}

export function isIOSDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  if (/iPad|iPhone|iPod/.test(ua)) return true;
  // iPadOS 13+ tarnt sich als MacIntel-Desktop-Safari — über Touch-Punkte entlarven.
  return (
    navigator.platform === "MacIntel" && (navigator.maxTouchPoints ?? 0) > 1
  );
}

export function readBackendOverride(): Backend | null {
  if (typeof window === "undefined") return null;
  try {
    const v = new URLSearchParams(window.location.search).get("backend");
    if (v === "webxr-ar" || v === "magic-window" || v === "preview") return v;
  } catch {
    // ignore malformed URL
  }
  return null;
}

export async function detectCapabilities(): Promise<DeviceCapabilities> {
  const isIOS = isIOSDevice();
  const hasGetUserMedia =
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices &&
    typeof navigator.mediaDevices.getUserMedia === "function";
  const secureContext =
    typeof window !== "undefined" && window.isSecureContext === true;

  const xr = await detectXRSupport();
  const { backend, reason } = decideBackend({
    override: readBackendOverride(),
    xrAr: xr.ar,
    hasGetUserMedia,
    secureContext,
    isIOS,
    xrReason: xr.reason,
  });

  return { backend, xrAr: xr.ar, xrVr: xr.vr, hasGetUserMedia, isIOS, reason };
}
