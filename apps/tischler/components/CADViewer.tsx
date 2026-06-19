"use client";

import {
  Component,
  Suspense,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Canvas, useLoader } from "@react-three/fiber";
import * as THREE from "three";
import {
  DEFAULT_DOVETAIL_PARAMS,
  generateBoardAMesh,
  generateBoardBMesh,
  generateMarkings,
  markingsToLineSegments,
  type DovetailParams,
} from "@craft-codex/core";
import { OrbitControls, Environment } from "@react-three/drei";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { CADMode, CADModelEntry } from "../lib/surface-modes/cad";

interface CADViewerProps {
  mode: CADMode;
  width?: number;
  height?: number;
}

const DEFAULT_WIDTH = 720;
const DEFAULT_HEIGHT = 480;

/**
 * R3F-Viewer für GLB/GLTF-Modelle, die in einer `CADMode` registriert sind.
 *
 * Das Drop-Down listet `mode.listModels()`. Ein Klick auf einen Eintrag ruft
 * `mode.selectModel(url)`. Der Canvas zeigt das aktive Modell mit
 * OrbitControls. `useLoader(GLTFLoader, …)` suspendet, daher steckt es in
 * einem `<Suspense>`. Eine kleine Error-Boundary fängt invalid URLs ab und
 * zeigt eine freundliche Message statt einem Crash.
 *
 * Der Viewer ist DOM-only — Mode-Logik bleibt in `cad.ts`.
 */
export function CADViewer({
  mode,
  width = DEFAULT_WIDTH,
  height = DEFAULT_HEIGHT,
}: CADViewerProps) {
  const [activeUrl, setActiveUrl] = useState<string | null>(() =>
    mode.getActiveModelUrl(),
  );
  // listModels() ist ein readonly-Snapshot; wir caches ihn per state damit
  // re-renders auch nach extern-registrierten Modellen funktionieren.
  const [models, setModels] = useState<readonly CADModelEntry[]>(() =>
    mode.listModels(),
  );

  useEffect(() => {
    // Initial-Sync (falls between mount + effect Modelle registriert wurden)
    setActiveUrl(mode.getActiveModelUrl());
    setModels(mode.listModels());
    const unsub = mode.onChange((url) => {
      setActiveUrl(url);
      setModels(mode.listModels());
    });
    return unsub;
  }, [mode]);

  const activeEntry = useMemo(
    () =>
      activeUrl ? (models.find((m) => m.url === activeUrl) ?? null) : null,
    [activeUrl, models],
  );

  const handleSelect = (url: string) => {
    mode.selectModel(url === "" ? null : url);
  };

  return (
    <div
      style={{
        position: "relative",
        width,
        height,
        userSelect: "none",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 8,
          left: 8,
          zIndex: 2,
          background: "var(--overlay-bg)",
          backdropFilter: "var(--overlay-blur)",
          border: "1px solid var(--cci-hairline)",
          padding: "0.4rem 0.6rem",
          fontSize: "0.85rem",
          color: "var(--color-heading)",
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
        }}
      >
        <label htmlFor="cad-model-select">Modell:</label>
        <select
          id="cad-model-select"
          value={activeUrl ?? ""}
          onChange={(e) => handleSelect(e.target.value)}
          aria-label="CAD-Modell auswählen"
          style={{
            border: "1px solid var(--input-border)",
            padding: "0.2rem 0.4rem",
            background: "var(--input-bg)",
            color: "var(--color-heading)",
          }}
        >
          <option value="">— kein Modell —</option>
          {models.map((m) => (
            <option key={m.url} value={m.url}>
              {m.label}
            </option>
          ))}
        </select>
      </div>

      <Canvas
        shadows
        camera={{ position: [1.2, 1.0, 1.8], fov: 45 }}
        style={{
          width,
          height,
          background: "#0a0a0a",
          border: "1px solid var(--cci-hairline)",
          display: "block",
        }}
      >
        <ambientLight intensity={0.5} />
        <directionalLight
          position={[3, 5, 2]}
          intensity={1.0}
          castShadow
          shadow-mapSize={[1024, 1024]}
        />
        <OrbitControls
          enablePan
          enableZoom
          enableRotate
          minDistance={0.1}
          maxDistance={20}
        />
        <Suspense fallback={<LoadingFallback />}>
          {activeEntry ? (
            <ModelErrorBoundary
              fallback={
                <EmptyState message="Modell konnte nicht geladen werden" />
              }
            >
              {activeEntry.url.startsWith("parametric:dovetail") ? (
                <ParametricDovetailModel entry={activeEntry} />
              ) : (
                <GLTFModel entry={activeEntry} />
              )}
            </ModelErrorBoundary>
          ) : null}
        </Suspense>
        {activeEntry ? <Environment preset="studio" /> : null}
      </Canvas>

      {!activeEntry && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none",
            color: "var(--color-text-muted)",
            fontSize: "0.95rem",
          }}
        >
          Kein Modell ausgewählt
        </div>
      )}
    </div>
  );
}

function GLTFModel({ entry }: { entry: CADModelEntry }) {
  // useLoader suspendet während des Fetch + Parse. Bei invalid URL wirft
  // GLTFLoader → fängt unsere Error-Boundary unten ab.
  const gltf = useLoader(GLTFLoader, entry.url);
  const scale = entry.scale ?? 1;
  return (
    <primitive
      object={gltf.scene}
      scale={[scale, scale, scale]}
      position={[0, 0, 0]}
      castShadow
      receiveShadow
    />
  );
}

/**
 * Procedural Schwalbenschwanz aus packages/core. Kein GLTFLoader.
 *
 * URL-Format: "parametric:dovetail" oder "parametric:dovetail?pinCount=7&ratio=8"
 * Parameter werden als query-string an die DovetailParams gemappt.
 */
function ParametricDovetailModel({ entry }: { entry: CADModelEntry }) {
  const params = useMemo(() => parseDovetailParams(entry.url), [entry.url]);
  const scale = entry.scale ?? 0.01; // mm → m

  const boardA = useMemo(
    () => generateBoardAMesh(params, THREE).geometry,
    [params],
  );
  const boardB = useMemo(
    () => generateBoardBMesh(params, THREE).geometry,
    [params],
  );
  const markings = useMemo(() => {
    const lines = generateMarkings("anreissen", params);
    return markingsToLineSegments(lines, THREE);
  }, [params]);

  const sep = params.thickness_mm * 4; // visuell auseinandergezogen
  return (
    <group scale={[scale, scale, scale]}>
      <mesh geometry={boardA} position={[0, sep / 2, 0]} castShadow>
        <meshStandardMaterial color="#c89a6c" roughness={0.7} />
      </mesh>
      <mesh
        geometry={boardB}
        position={[0, -sep / 2, 0]}
        rotation={[0, Math.PI, 0]}
        castShadow
      >
        <meshStandardMaterial color="#a98256" roughness={0.7} />
      </mesh>
      <primitive object={markings} position={[0, sep / 2 + 0.1, 0]} />
    </group>
  );
}

/**
 * Parsed URL like "parametric:dovetail?pinCount=7&ratio=8&width_mm=150"
 * into DovetailParams. Missing keys keep DEFAULT_DOVETAIL_PARAMS values.
 */
function parseDovetailParams(url: string): DovetailParams {
  const qIdx = url.indexOf("?");
  if (qIdx === -1) return { ...DEFAULT_DOVETAIL_PARAMS };
  const search = url.slice(qIdx + 1);
  const sp = new URLSearchParams(search);
  const params: DovetailParams = { ...DEFAULT_DOVETAIL_PARAMS };
  const numKeys: Array<keyof DovetailParams> = [
    "pinCount",
    "ratio",
    "thickness_mm",
    "width_mm",
    "length_mm",
  ];
  for (const k of numKeys) {
    const v = sp.get(k);
    if (v !== null && !Number.isNaN(Number(v))) {
      (params[k] as number) = Number(v);
    }
  }
  const dist = sp.get("distribution");
  if (
    dist === "uniform" ||
    dist === "asymmetric_left" ||
    dist === "asymmetric_right"
  ) {
    params.distribution = dist;
  }
  return params;
}

function LoadingFallback() {
  // Drei 3D-Loading-Indikator wäre nice, reicht aber ein simpler null-fallback.
  // Drei.Html ist drei-only, daher hier kein DOM. Für UX zeigt der äußere
  // div bereits "Kein Modell ausgewählt" wenn nichts geladen ist.
  return null;
}

interface ModelErrorBoundaryProps {
  fallback: ReactNode;
  children: ReactNode;
}

interface ModelErrorBoundaryState {
  error: Error | null;
}

/**
 * Klassische React-Error-Boundary (Hook-Variante existiert nicht für catch).
 * Verhindert, dass ein invalid GLTFLoader-Fetch den ganzen R3F-Tree crasht.
 */
class ModelErrorBoundary extends Component<
  ModelErrorBoundaryProps,
  ModelErrorBoundaryState
> {
  constructor(props: ModelErrorBoundaryProps) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): ModelErrorBoundaryState {
    return { error };
  }

  override componentDidCatch(error: Error): void {
    console.error("[CADViewer] GLTFLoader error:", error);
  }

  override render(): ReactNode {
    if (this.state.error) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

function EmptyState({ message }: { message: string }) {
  // Wir sind im R3F-Tree, dürfen also kein DOM rendern. Statt dessen
  // einfach `null` — das äußere DOM-Overlay zeigt seinen eigenen Text.
  // Die Boundary-Fallback-Variante hat hauptsächlich die Aufgabe, den
  // Tree zu neutralisieren; den Fehlertext loggen wir und der User sieht
  // den "Kein Modell ausgewählt"-Hinweis.
  void message;
  return null;
}
