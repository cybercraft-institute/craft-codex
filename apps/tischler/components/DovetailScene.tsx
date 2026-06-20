"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useMemo, type ReactNode } from "react";
import * as THREE from "three";
import {
  generateBoardAMesh,
  generateBoardBMesh,
  generateMarkings,
  markingsToLineSegments,
} from "@craft-codex/core";
import type { DovetailParams, DovetailStep } from "@craft-codex/core";

interface DovetailSceneProps {
  params: DovetailParams;
  step: DovetailStep;
  /**
   * Optional Wrapper-Komponente um den Scene-Content (z.B. <XR store={...}>).
   * Default: identity (just renders children directly).
   */
  contentWrapper?: (children: ReactNode) => ReactNode;
}

export const SCALE_MM_TO_M = 0.001;
export const BOARD_SEPARATION_M = 0.15;

/**
 * Pure 3D-Scene-Inhalt — ohne Canvas, ohne XR-Wrapper.
 * Nutzbar in 2D-Canvas und in XR-Context.
 */
export function DovetailSceneContents({
  params,
  step,
  withOrbitControls = true,
}: {
  params: DovetailParams;
  step: DovetailStep;
  withOrbitControls?: boolean;
}) {
  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight
        position={[2, 3, 2]}
        intensity={1.2}
        castShadow
        shadow-mapSize={[1024, 1024]}
      />
      <BoardA params={params} />
      <BoardB params={params} />
      <MarkingLines params={params} step={step} />
      {withOrbitControls && (
        <OrbitControls
          target={[0, 0, 0]}
          enablePan
          enableZoom
          minDistance={0.15}
          maxDistance={1.5}
        />
      )}
    </>
  );
}

function BoardA({ params }: { params: DovetailParams }) {
  const geometry = useMemo(() => {
    const mesh = generateBoardAMesh(params, THREE);
    return mesh.geometry;
  }, [params]);

  return (
    <mesh
      geometry={geometry}
      scale={[SCALE_MM_TO_M, SCALE_MM_TO_M, SCALE_MM_TO_M]}
      position={[0, BOARD_SEPARATION_M / 2, 0]}
      castShadow
      receiveShadow
    >
      <meshStandardMaterial color="#c89a6c" roughness={0.7} metalness={0} />
    </mesh>
  );
}

function BoardB({ params }: { params: DovetailParams }) {
  const geometry = useMemo(() => {
    const mesh = generateBoardBMesh(params, THREE);
    return mesh.geometry;
  }, [params]);

  return (
    <mesh
      geometry={geometry}
      scale={[SCALE_MM_TO_M, SCALE_MM_TO_M, SCALE_MM_TO_M]}
      position={[0, -BOARD_SEPARATION_M / 2, 0]}
      rotation={[0, Math.PI, 0]}
      castShadow
      receiveShadow
    >
      <meshStandardMaterial color="#a98256" roughness={0.7} metalness={0} />
    </mesh>
  );
}

function MarkingLines({
  params,
  step,
}: {
  params: DovetailParams;
  step: DovetailStep;
}) {
  const lineSegments = useMemo(() => {
    const markings = generateMarkings(step, params);
    return markingsToLineSegments(markings, THREE);
  }, [params, step]);

  return (
    <primitive
      object={lineSegments}
      scale={[SCALE_MM_TO_M, SCALE_MM_TO_M, SCALE_MM_TO_M]}
      position={[0, BOARD_SEPARATION_M / 2 + 0.001, 0]}
    />
  );
}

export function DovetailScene({
  params,
  step,
  contentWrapper,
}: DovetailSceneProps) {
  const content = <DovetailSceneContents params={params} step={step} />;
  return (
    <Canvas
      shadows
      camera={{ position: [0.3, 0.25, 0.4], fov: 45 }}
      style={{ width: "100%", height: "100%", background: "#0a0a0a" }}
    >
      {contentWrapper ? contentWrapper(content) : content}
    </Canvas>
  );
}
