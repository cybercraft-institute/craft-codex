"use client";

import { useEffect, useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { XR, createXRStore } from "@react-three/xr";
import {
  DEFAULT_DOVETAIL_PARAMS,
  type DovetailParams,
} from "@craft-codex/core";
import { DovetailSceneContents } from "./DovetailScene";
import { XRStepBar } from "./XRStepBar";
import { WorkflowPanel } from "./WorkflowPanel";
import { WorkflowOverlay } from "./WorkflowOverlay";
import { ARPlacement } from "./ARPlacement";
import { ARRegistration, type RegistrationResult } from "./ARRegistration";
import { DOVETAIL_WORKFLOW } from "../lib/workflow/dovetail-workflow";
import { useWorkflow } from "../lib/workflow/useWorkflow";
import {
  detectCapabilities,
  type DeviceCapabilities,
} from "../lib/xr/capabilities";
import { loadSession, saveSession } from "../lib/storage/local";

/**
 * Rückgrat der geführten AR-Anleitung. Erkennt das Backend (webxr-ar /
 * magic-window / preview) und rendert denselben Workflow-State entsprechend:
 * immersives 3D-Panel auf Headsets, HTML-Overlay sonst. Dieselbe Schritt-ID
 * treibt Hologramm + XRStepBar.
 */
export function WorkflowRoot() {
  const wf = useWorkflow(DOVETAIL_WORKFLOW);
  const [params, setParams] = useState<DovetailParams>(DEFAULT_DOVETAIL_PARAMS);
  const [caps, setCaps] = useState<DeviceCapabilities | null>(null);

  const store = useMemo(
    () => createXRStore({ emulate: false, offerSession: false }),
    [],
  );

  useEffect(() => {
    const session = loadSession();
    if (session) setParams(session.params);
    let cancelled = false;
    detectCapabilities().then((c) => {
      if (!cancelled) setCaps(c);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Aktiven Schritt in die Dovetail-Session spiegeln, damit /dovetail und XR
  // denselben Lernschritt teilen (wie zuvor die XRStepBar).
  useEffect(() => {
    saveSession({ params, step: wf.stepId, updatedAt: 0 });
  }, [params, wf.stepId]);

  if (!caps) {
    return (
      <p className="cc-muted" style={{ marginTop: "1.5rem" }}>
        Prüfe Gerät …
      </p>
    );
  }

  return (
    <div data-testid="workflow-root" data-backend={caps.backend}>
      {caps.backend === "webxr-ar" ? (
        <ImmersiveView wf={wf} params={params} store={store} caps={caps} />
      ) : (
        <FlatView wf={wf} params={params} caps={caps} />
      )}
    </div>
  );
}

type Wf = ReturnType<typeof useWorkflow>;

function ImmersiveView({
  wf,
  params,
  store,
  caps,
}: {
  wf: Wf;
  params: DovetailParams;
  store: ReturnType<typeof createXRStore>;
  caps: DeviceCapabilities;
}) {
  const enterAR = async () => {
    try {
      const session = await store.enterAR();
      if (!session) console.warn("[XR] enterAR: no session");
    } catch (e) {
      console.error("[XR] enterAR failed:", e);
    }
  };

  // Platzierung per Hit-Test (Griff-Taste). Vor dem ersten Platzieren schwebt
  // das Brett auf Tischhöhe vor dem Nutzer.
  const [placement, setPlacement] = useState<[number, number, number] | null>(
    null,
  );
  // 3-Punkt-Ausrichtung: präzise Pose, sobald registriert (echter Maßstab = 1).
  const [registering, setRegistering] = useState(false);
  const [worldAligned, setWorldAligned] = useState(true);
  const [registration, setRegistration] = useState<RegistrationResult | null>(
    null,
  );

  const registered = registration !== null;
  // Beim Ausrichten/Registriert: echter Maßstab (1). Sonst 3× für Sichtbarkeit.
  const groupScale = registering || registered ? 1 : 3;
  const groupPosition: [number, number, number] = registration
    ? registration.position
    : (placement ?? [0, 1.2, -0.6]);
  const groupQuat: [number, number, number, number] = registration
    ? registration.quaternion
    : [0, 0, 0, 1];

  return (
    <>
      <section className="cc-card" style={{ marginTop: "1.5rem" }}>
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <Capability label="Immersive AR" supported={caps.xrAr} />
        </div>
        <div style={{ marginTop: "1.25rem" }}>
          <button
            type="button"
            disabled={!caps.xrAr}
            onClick={enterAR}
            className="cc-btn cc-btn--primary"
          >
            Enter AR
          </button>
        </div>
        <p className="cc-muted" style={{ marginTop: "1rem", fontSize: "0.8rem" }}>
          „Enter AR“ startet die Passthrough-Session — Brett &amp; Anleitung
          schweben in deinem Raum. <strong>Grob:</strong> Fläche anvisieren,
          Griff-Taste legt das Brett ab. <strong>Präzise:</strong> „Ausrichten“
          und drei reale Brettecken mit der Controllerspitze + Trigger antippen —
          das Modell rastet aufs Werkstück. Schritte wechselst du mit dem Trigger.
        </p>
        {registered && (
          <p style={{ marginTop: "0.5rem", fontSize: "0.8rem", color: "var(--color-success)" }}>
            Ausgerichtet · Restfehler ±{Math.round(registration.rmsError * 1000)}
            mm
          </p>
        )}
      </section>

      <section
        className="cc-stage"
        style={{ marginTop: "1rem", height: "60vh", minHeight: 420 }}
        aria-label="XR-Vorschau"
      >
        <Canvas
          shadows
          // alpha:true → der Renderer löscht transparent, damit in der AR-Session
          // das Quest-Passthrough hinter der Szene sichtbar bleibt.
          gl={{ alpha: true }}
          camera={{ position: [0.9, 1.9, 1.0], fov: 45 }}
          onCreated={({ camera }) => camera.lookAt(0, 1.4, -0.6)}
          style={{ background: "#0a0a0a" }}
        >
          <XR store={store}>
            <group
              position={groupPosition}
              quaternion={groupQuat}
              scale={[groupScale, groupScale, groupScale]}
            >
              <DovetailSceneContents
                params={params}
                step={wf.stepId}
                withOrbitControls={false}
              />
              <XRStepBar active={wf.stepId} onChange={wf.goToStep} />
            </group>
            <WorkflowPanel
              wf={wf}
              position={[0, 1.78, -0.6]}
              registering={registering}
              onToggleRegister={() => setRegistering((v) => !v)}
              worldAligned={worldAligned}
              onToggleWorld={() => setWorldAligned((v) => !v)}
              onExit={() => {
                void store.getState().session?.end();
              }}
            />
            {/* Grob-Platzierung nur außerhalb der Präzisions-Ausrichtung. */}
            {!registering && !registered && (
              <ARPlacement onPlace={setPlacement} />
            )}
            {registering && (
              <ARRegistration
                params={params}
                worldAligned={worldAligned}
                onRegistered={(r) => {
                  setRegistration(r);
                  setRegistering(false);
                }}
              />
            )}
          </XR>
        </Canvas>
      </section>
    </>
  );
}

function FlatView({
  wf,
  params,
  caps,
}: {
  wf: Wf;
  params: DovetailParams;
  caps: DeviceCapabilities;
}) {
  return (
    <>
      {caps.backend === "magic-window" && (
        <div
          style={{
            marginTop: "1.25rem",
            borderLeft: "3px solid var(--cci-yellow)",
            background: "var(--cci-yellow-soft)",
            padding: "0.75rem 1rem",
            fontSize: "0.875rem",
            color: "var(--color-heading)",
          }}
        >
          Kamera-AR mit Marker folgt — hier schon die geführte Vorschau mit
          Hologramm.
        </div>
      )}
      <div
        style={{
          marginTop: "1.25rem",
          display: "flex",
          flexWrap: "wrap",
          gap: "1rem",
          alignItems: "flex-start",
        }}
      >
        <div style={{ flex: "1 1 320px", minWidth: 300 }}>
          <WorkflowOverlay wf={wf} />
        </div>
        <section
          className="cc-stage"
          style={{ flex: "2 1 360px", height: "60vh", minHeight: 420 }}
          aria-label="3D-Vorschau"
        >
          <Canvas
            shadows
            camera={{ position: [0.3, 0.25, 0.4], fov: 45 }}
            style={{ background: "#0a0a0a" }}
          >
            <DovetailSceneContents
              params={params}
              step={wf.stepId}
              withOrbitControls
            />
          </Canvas>
        </section>
      </div>
    </>
  );
}

function Capability({ label, supported }: { label: string; supported: boolean }) {
  return (
    <div
      className={supported ? "cc-badge cc-badge--yellow" : "cc-badge"}
      style={{ fontSize: "0.72rem", padding: "0.4rem 0.7rem" }}
    >
      {label}: {supported ? "bereit" : "n/a"}
    </div>
  );
}
