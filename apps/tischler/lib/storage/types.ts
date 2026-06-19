/**
 * MVP Storage-Layer (browser-only, localStorage).
 *
 * Phase C wird DB-Layer hinzufuegen (better-sqlite3 server-side, oder
 * IndexedDB browser-side fuer offline). better-sqlite3 in Phase B verworfen
 * wegen Node 25 native-build inkompatibilitaet.
 */

import type {
  DovetailParams,
  DovetailStep,
  Pose,
} from "@craft-codex/core";

export interface DovetailSessionState {
  params: DovetailParams;
  step: DovetailStep;
  updatedAt: number;
}

export interface ProgressEntry {
  step: DovetailStep;
  completed: boolean;
  notes?: string;
}

export interface ModesPersistedState {
  activeMode: "tafel" | "cad" | "video" | null;
  modeStates: Record<string, Record<string, unknown>>;
}

export interface PlacementsPersistedState {
  /** targetId → Pose (Position + Rotation + Confidence) */
  poses: Record<string, Pose>;
  updatedAt: number;
}

/**
 * Cursor der geführten Anleitung (getrennt vom step-Fortschritt in
 * ProgressEntry, damit erledigte Schritte ein Cursor-Schema-Update überleben).
 */
export interface WorkflowCursorState {
  /** Index des aktuellen Schritts. */
  index: number;
  /** checklistItemId → abgehakt. */
  checkedItems: Record<string, boolean>;
  updatedAt: number;
}
