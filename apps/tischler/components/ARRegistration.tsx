"use client";

import { useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Billboard, Text } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import {
  XRSpace,
  useXRInputSourceEvent,
  useXRInputSourceState,
} from "@react-three/xr";
import {
  solveLeveledFrame,
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

const PROBE_DISTANCE = 0.15; // Achsenkreuz 15 cm vor dem Controller
const AXIS_LEN = 0.06;
const AXIS_R = 0.0022;

/** XYZ-Achsenkreuz (X rot, Y grün, Z blau) mit Ursprung im Gruppen-Nullpunkt. */
function AxisGizmo() {
  return (
    <group>
      <mesh position={[AXIS_LEN / 2, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <cylinderGeometry args={[AXIS_R, AXIS_R, AXIS_LEN, 10]} />
        <meshBasicMaterial color="#ff5555" />
      </mesh>
      <mesh position={[0, AXIS_LEN / 2, 0]}>
        <cylinderGeometry args={[AXIS_R, AXIS_R, AXIS_LEN, 10]} />
        <meshBasicMaterial color="#4ade80" />
      </mesh>
      <mesh position={[0, 0, AXIS_LEN / 2]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[AXIS_R, AXIS_R, AXIS_LEN, 10]} />
        <meshBasicMaterial color="#4d8bff" />
      </mesh>
    </group>
  );
}

const PROMPTS = [
  "Punkt 1/3 — Ursprung (Ecke der Oberseite)",
  "Punkt 2/3 — entlang X (Nachbarecke)",
  "Punkt 3/3 — entlang Y (andere Nachbarecke)",
];

/**
 * 3-Punkt-Registrierung per Controller-Spitze (Quest 3, WebXR — ohne Kamera).
 *
 * Die getrackte Controllerspitze (Achsenkreuz, 15 cm voraus) ist die Sonde:
 * Punkt 1 = Ursprung, Punkt 2 = entlang X, Punkt 3 = entlang Y → definiert eine
 * Ebene. `worldAligned` zwingt diese Ebene auf die Welt-Horizontale (Ursprung +
 * Yaw zählen, die Stützpunkte halten das Brett eben); sonst freie 3-Punkt-Lage.
 */
export function ARRegistration({
  params,
  worldAligned = false,
  onRegistered,
}: {
  params: DovetailParams;
  worldAligned?: boolean;
  onRegistered: (result: RegistrationResult) => void;
}) {
  const tipRef = useRef<THREE.Group>(null); // Anker an der Spitze (Erfassung)
  const worldGizmoRef = useRef<THREE.Group>(null); // welt-orientiertes Kreuz
  const [captured, setCaptured] = useState<Vec3[]>([]);

  const right = useXRInputSourceState("controller", "right");
  const left = useXRInputSourceState("controller", "left");
  // Rechts bevorzugen; targetRaySpace = Zeigeachse → Spitze liegt VOR dem Controller.
  const controller = right ?? left;
  const probeSpace = controller?.inputSource?.targetRaySpace;

  // Modell-Referenzecken (Oberseite Brett A), Maßstab 1: Ursprung, X-Ecke, Y-Ecke.
  const model = useMemo<[Vec3, Vec3, Vec3]>(() => {
    const hw = (params.width_mm / 2) * SCALE_MM_TO_M;
    const hl = (params.length_mm / 2) * SCALE_MM_TO_M;
    const y = BOARD_SEPARATION_M / 2;
    return [
      [-hw, y, hl], // Ursprung
      [hw, y, hl], // entlang +X (Breitenkante)
      [-hw, y, -hl], // entlang +Y (Längskante)
    ];
  }, [params.width_mm, params.length_mm]);

  // Bei „Welt-Ebene" das Kreuz welt-orientiert (eben) an der Spitze halten;
  // sonst hängt es controller-orientiert im targetRaySpace.
  useFrame(() => {
    const wg = worldGizmoRef.current;
    const tip = tipRef.current;
    if (!wg) return;
    if (worldAligned && tip) {
      tip.getWorldPosition(wg.position);
      wg.quaternion.identity();
      wg.visible = true;
    } else {
      wg.visible = false;
    }
  });

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
          const pts = next as [Vec3, Vec3, Vec3];
          const t = worldAligned
            ? solveLeveledFrame(model, pts)
            : solveRigidFrom3Points(model, pts);
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
    [model, worldAligned, onRegistered],
  );

  const promptIndex = Math.min(captured.length, 2);

  return (
    <>
      {probeSpace && (
        <XRSpace space={probeSpace}>
          {/* dünner Stiel vom Controller zur Spitze */}
          <mesh
            position={[0, 0, -PROBE_DISTANCE / 2]}
            rotation={[Math.PI / 2, 0, 0]}
          >
            <cylinderGeometry args={[0.0015, 0.0015, PROBE_DISTANCE, 12]} />
            <meshBasicMaterial color="#a4a4ac" />
          </mesh>
          {/* Anker + (controller-orientiertes) Kreuz */}
          <group ref={tipRef} position={[0, 0, -PROBE_DISTANCE]}>
            {!worldAligned && <AxisGizmo />}
          </group>
        </XRSpace>
      )}

      {/* Welt-orientiertes Kreuz (Position via useFrame, identische Rotation). */}
      <group ref={worldGizmoRef} visible={false}>
        <AxisGizmo />
      </group>

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
            ? `Ausrichten${worldAligned ? " · Welt-Ebene" : ""} · Kreuz auf den Punkt, Trigger\n${PROMPTS[promptIndex]}`
            : "Ausrichten braucht einen Controller"}
        </Text>
      </Billboard>
    </>
  );
}
