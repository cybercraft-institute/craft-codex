"use client";

import { useState } from "react";
import { Billboard, Text } from "@react-three/drei";
import type { UseWorkflowResult } from "../lib/workflow/useWorkflow";

/**
 * In-3D Schrittpanel für Headsets (Quest 3 / HoloLens) — dort gibt es kein
 * dom-overlay, also rendern wir das Anleitungspanel als Billboard im Raum.
 * Anklickbare Quader nutzen dasselbe R3F-Event-Idiom wie XRStepBar (Trigger +
 * Hand-Pinch). Maße in Metern.
 */
export function WorkflowPanel({
  wf,
  position = [0, 0.6, 0],
  onToggleRegister,
  registering = false,
}: {
  wf: UseWorkflowResult;
  position?: [number, number, number];
  /** Öffnet/schließt die 3-Punkt-Ausrichtung (nur im Headset sinnvoll). */
  onToggleRegister?: () => void;
  registering?: boolean;
}) {
  const { step, state, steps } = wf;
  const done = wf.isComplete();
  const instructions = step.instructions
    .map((line, i) => `${i + 1}. ${line}`)
    .join("\n");

  return (
    <Billboard position={position}>
      {/* Panel-Hintergrund (frosted-dunkel) */}
      <mesh position={[0, -0.05, -0.002]}>
        <planeGeometry args={[0.46, 0.4]} />
        <meshBasicMaterial color="#0e0e10" transparent opacity={0.82} />
      </mesh>
      {/* gelber Akzentbalken oben */}
      <mesh position={[-0.16, 0.135, 0]}>
        <planeGeometry args={[0.12, 0.006]} />
        <meshBasicMaterial color="#ffed00" />
      </mesh>

      <Text position={[-0.21, 0.12, 0]} anchorX="left" anchorY="top" fontSize={0.012} color="#a4a4ac">
        {`SCHRITT ${state.index + 1} / ${steps.length}`}
      </Text>
      <Text position={[-0.21, 0.1, 0]} anchorX="left" anchorY="top" fontSize={0.026} color="#f4f4f6">
        {step.label.toUpperCase()}
      </Text>
      <Text
        position={[-0.21, 0.055, 0]}
        anchorX="left"
        anchorY="top"
        fontSize={0.0125}
        color="#c7c7cd"
        maxWidth={0.42}
        lineHeight={1.45}
      >
        {instructions}
      </Text>

      <PanelButton position={[-0.14, -0.115, 0]} label="◀ Zurück" onClick={wf.prev} width={0.13} />
      <PanelButton
        position={[0, -0.115, 0]}
        label={done ? "Erledigt ✓" : "Erledigt"}
        onClick={wf.toggleComplete}
        width={0.13}
        active={done}
      />
      <PanelButton position={[0.14, -0.115, 0]} label="Weiter ▶" onClick={wf.next} width={0.13} accent />

      {onToggleRegister && (
        <PanelButton
          position={[0, -0.185, 0]}
          label={registering ? "Abbrechen" : "◎ Ausrichten (3 Pkt.)"}
          onClick={onToggleRegister}
          width={0.3}
          active={registering}
        />
      )}
    </Billboard>
  );
}

function PanelButton({
  position,
  label,
  onClick,
  width,
  accent = false,
  active = false,
}: {
  position: [number, number, number];
  label: string;
  onClick: () => void;
  width: number;
  accent?: boolean;
  active?: boolean;
}) {
  const [hovered, setHovered] = useState(false);

  const base = accent || active ? "#ffed00" : hovered ? "#32373c" : "#1c1c20";
  const labelColor = accent || active ? "#0a0a0a" : "#f4f4f6";

  return (
    <group position={position}>
      <mesh
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
        }}
        onPointerOut={() => setHovered(false)}
      >
        <boxGeometry args={[width, 0.04, 0.008]} />
        <meshStandardMaterial color={base} />
      </mesh>
      <Text position={[0, 0, 0.006]} fontSize={0.013} color={labelColor} anchorX="center" anchorY="middle">
        {label}
      </Text>
    </group>
  );
}
