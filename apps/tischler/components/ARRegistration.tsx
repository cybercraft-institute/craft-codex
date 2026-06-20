"use client";

import { useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Billboard, Text } from "@react-three/drei";
import {
  XRSpace,
  useXRInputSourceEvent,
  useXRInputSourceState,
} from "@react-three/xr";
import {
  solveRigidFrom3Points,
  type DovetailParams,
  type Vec3,
} from "@craft-codex/core";
import { BOARD_SEPARATION_M, SCALE_MM_TO_M } from "./DovetailScene";

export interface RegistrationResult {
  position: [number, number, number];
  quaternion: [number, number, number, number];
  rmsError: number;
}

const AXIS_LEN = 0.06;
const AXIS_R = 0.0022;

/** XYZ-Achsenkreuz (X rot, Y grün, Z blau) mit Ursprung im Gruppen-Nullpunkt. */
function AxisGizmo() {
  return (
    <group>
      {/* X — rot, entlang +X */}
      <mesh position={[AXIS_LEN / 2, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <cylinderGeometry args={[AXIS_R, AXIS_R, AXIS_LEN, 10]} />
        <meshBasicMaterial color="#ff5555" />
      </mesh>
      {/* Y — grün, entlang +Y */}
      <mesh position={[0, AXIS_LEN / 2, 0]}>
        <cylinderGeometry args={[AXIS_R, AXIS_R, AXIS_LEN, 10]} />
        <meshBasicMaterial color="#4ade80" />
      </mesh>
      {/* Z — blau, entlang +Z */}
      <mesh position={[0, 0, AXIS_LEN / 2]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[AXIS_R, AXIS_R, AXIS_LEN, 10]} />
        <meshBasicMaterial color="#4d8bff" />
      </mesh>
    </group>
  );
}

const PROMPTS = [
  "Ecke 1/3 — Hirnholz-Seite, eine Ecke",
  "Ecke 2/3 — gleiche Stirnkante, andere Ecke",
  "Ecke 3/3 — lange Kante entlang, anderes Ende",
];

/**
 * 3-Punkt-Registrierung per Controller-Spitze (Quest 3, WebXR — ohne Kamera).
 *
 * Die getrackte Controllerspitze ist die „Sonde": der Nutzer berührt drei
 * bekannte Brettecken und drückt den Trigger. Aus den Korrespondenzen
 * Modell↔Welt rechnet solveRigidFrom3Points() die Lage des digitalen Bretts.
 * Modellecken stammen aus den realen mm-Maßen (Oberseite von Brett A).
 */
export function ARRegistration({
  params,
  onRegistered,
}: {
  params: DovetailParams;
  onRegistered: (result: RegistrationResult) => void;
}) {
  const tipRef = useRef<THREE.Group>(null);
  const [captured, setCaptured] = useState<Vec3[]>([]);

  const right = useXRInputSourceState("controller", "right");
  const left = useXRInputSourceState("controller", "left");
  // Rechts bevorzugen (Dominanthand); targetRaySpace = die Zeigeachse des
  // Controllers, sodass die Spitze VOR dem Controller liegt (nicht am Griff).
  const controller = right ?? left;
  const probeSpace = controller?.inputSource?.targetRaySpace;

  // Modell-Referenzecken (Oberseite Brett A) im Gruppen-Lokalsystem (Meter,
  // Maßstab 1) — gleiche Reihenfolge wie die PROMPTS.
  const model = useMemo<[Vec3, Vec3, Vec3]>(() => {
    const hw = (params.width_mm / 2) * SCALE_MM_TO_M;
    const hl = (params.length_mm / 2) * SCALE_MM_TO_M;
    const y = BOARD_SEPARATION_M / 2;
    return [
      [-hw, y, hl],
      [hw, y, hl],
      [hw, y, -hl],
    ];
  }, [params.width_mm, params.length_mm]);

  // Trigger erfasst die aktuelle Spitzenposition (Welt).
  useXRInputSourceEvent(
    "all",
    "select",
    () => {
      const tip = tipRef.current;
      if (!tip) return;
      const p = new THREE.Vector3();
      tip.getWorldPosition(p);
      setCaptured((prev) => {
        if (prev.length >= 3) return prev;
        const next: Vec3[] = [...prev, [p.x, p.y, p.z]];
        if (next.length === 3) {
          const t = solveRigidFrom3Points(model, next as [Vec3, Vec3, Vec3]);
          if (t) {
            onRegistered({
              position: t.position,
              quaternion: t.rotation,
              rmsError: t.rmsError,
            });
          }
          return []; // zurücksetzen; Parent beendet den Modus
        }
        return next;
      });
    },
    [model, onRegistered],
  );

  const promptIndex = Math.min(captured.length, 2);

  return (
    <>
      {/* Sonde: dünner Stiel entlang der Zeigeachse + XYZ-Achsenkreuz an der
          Spitze (~7 cm vor dem Controller). Der Kreuzungspunkt ist der präzise
          Erfassungspunkt — tipRef liefert seine Weltposition beim Trigger. */}
      {probeSpace && (
        <XRSpace space={probeSpace}>
          <mesh position={[0, 0, -0.035]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.0015, 0.0015, 0.07, 12]} />
            <meshBasicMaterial color="#a4a4ac" />
          </mesh>
          <group ref={tipRef} position={[0, 0, -0.07]}>
            <AxisGizmo />
          </group>
        </XRSpace>
      )}

      {/* Bereits erfasste Punkte (grün). */}
      {captured.map((c, i) => (
        <mesh key={i} position={c}>
          <sphereGeometry args={[0.008, 16, 16]} />
          <meshBasicMaterial color="#4ade80" />
        </mesh>
      ))}

      {/* Anweisung. */}
      <Billboard position={[0, 1.0, -0.6]}>
        <Text
          fontSize={0.02}
          color="#ffed00"
          anchorX="center"
          anchorY="middle"
          maxWidth={0.7}
        >
          {probeSpace
            ? `Ausrichten · Spitze auf die Ecke, Trigger drücken\n${PROMPTS[promptIndex]}`
            : "Ausrichten braucht einen Controller"}
        </Text>
      </Billboard>
    </>
  );
}
