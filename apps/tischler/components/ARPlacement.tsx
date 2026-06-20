"use client";

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { Billboard, Text } from "@react-three/drei";
import { useXRHitTest, useXRInputSourceEvent } from "@react-three/xr";

/**
 * WebXR-Hit-Test-Platzierung für Headsets (Quest 3 / HoloLens).
 *
 * Ein gelber Reticle-Ring folgt dem Blick (viewer-origin Hit-Test) auf reale
 * Flächen im Passthrough. Die GRIFF-Taste (squeeze) lässt das Brett dort
 * fallen — bewusst NICHT der Trigger (select), denn der bedient bereits die
 * Schritt-/Panel-Buttons. So kollidiert Platzieren nie mit der UI.
 *
 * Marker-CV (ArUco) geht hier nicht: in der WebXR-Session gibt es keine
 * Passthrough-Kamerabilder — das ist der Tablet-Pfad (Magic-Window).
 */
export function ARPlacement({
  onPlace,
}: {
  /** Welt-Position, an der das Brett platziert werden soll. */
  onPlace: (position: [number, number, number]) => void;
}) {
  const reticleRef = useRef<THREE.Mesh>(null);
  const posRef = useRef<THREE.Vector3 | null>(null);
  const matrix = useMemo(() => new THREE.Matrix4(), []);

  // Kontinuierlicher Hit-Test vom Viewer (Blickmitte) auf reale Flächen.
  useXRHitTest((results, getWorldMatrix) => {
    const mesh = reticleRef.current;
    if (!mesh) return;
    if (results.length === 0 || !getWorldMatrix(matrix, results[0]!)) {
      mesh.visible = false;
      return;
    }
    mesh.visible = true;
    mesh.position.setFromMatrixPosition(matrix);
    (posRef.current ??= new THREE.Vector3()).setFromMatrixPosition(matrix);
  }, "viewer");

  // Griff/Squeeze platziert — Trigger bleibt der UI vorbehalten.
  useXRInputSourceEvent(
    "all",
    "squeeze",
    () => {
      const p = posRef.current;
      if (p) onPlace([p.x, p.y + 0.12, p.z]); // leicht anheben, damit es aufliegt
    },
    [onPlace],
  );

  return (
    <>
      <mesh ref={reticleRef} visible={false} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.06, 0.09, 48]} />
        <meshBasicMaterial
          color="#ffed00"
          transparent
          opacity={0.9}
          side={THREE.DoubleSide}
        />
      </mesh>
      <Billboard position={[0, 0.9, -0.6]}>
        <Text fontSize={0.014} color="#f4f4f6" anchorX="center" anchorY="middle">
          Fläche anvisieren · Griff-Taste platziert das Brett
        </Text>
      </Billboard>
    </>
  );
}
