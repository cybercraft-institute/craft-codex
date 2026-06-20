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
  const tipRef = useRef<THREE.Mesh>(null);
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
      {/* Sonde: dünner Stiel entlang der Zeigeachse + Kugel an der Spitze,
          ~7 cm vor dem Controller. tipRef ist die Kugel — ihre Weltposition
          wird beim Trigger erfasst. */}
      {probeSpace && (
        <XRSpace space={probeSpace}>
          <mesh position={[0, 0, -0.035]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.0018, 0.0018, 0.07, 12]} />
            <meshBasicMaterial color="#ffed00" />
          </mesh>
          <mesh ref={tipRef} position={[0, 0, -0.07]}>
            <sphereGeometry args={[0.006, 16, 16]} />
            <meshBasicMaterial color="#ffed00" />
          </mesh>
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
