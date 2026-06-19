"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  WorkflowController,
  type DovetailStep,
  type WorkflowDefinition,
  type WorkflowState,
  type WorkflowStep,
} from "@craft-codex/core";
import { loadProgress, loadWorkflow, saveProgress, saveWorkflow } from "../storage/local";
import type { ProgressEntry } from "../storage/types";

export interface UseWorkflowResult {
  state: WorkflowState;
  steps: readonly WorkflowStep[];
  step: WorkflowStep;
  /** Aktuelle Schritt-ID — treibt Hologramm (generateMarkings) + XRStepBar. */
  stepId: DovetailStep;
  next: () => void;
  prev: () => void;
  goToStep: (id: string) => void;
  toggleComplete: () => void;
  toggleChecklistItem: (id: string) => void;
  isComplete: (id?: string) => boolean;
  isChecked: (id: string) => boolean;
}

/**
 * Bindet einen WorkflowController an React.
 *
 * Hydration läuft erst nach dem Mount (wie /dovetail liest aus localStorage in
 * useEffect), damit SSR und erstes Client-Render identisch bei Schritt 0
 * starten — kein Hydration-Mismatch. Jede Änderung wird gespiegelt nach
 * `craft-codex:dovetail:workflow` (Cursor) + `:progress` (erledigte Schritte).
 */
export function useWorkflow(def: WorkflowDefinition): UseWorkflowResult {
  const [state, setState] = useState<WorkflowState>(() =>
    WorkflowController.hydrate(def),
  );
  const ctrlRef = useRef<WorkflowController | null>(null);
  if (ctrlRef.current === null) ctrlRef.current = new WorkflowController(def);

  useEffect(() => {
    const cursor = loadWorkflow();
    const progress = loadProgress();
    const completed: Record<string, boolean> = {};
    if (progress) {
      for (const [id, entry] of Object.entries(progress)) {
        if (entry?.completed) completed[id] = true;
      }
    }

    const controller = new WorkflowController(def, {
      index: cursor?.index,
      checkedItems: cursor?.checkedItems,
      completed,
    });
    ctrlRef.current = controller;
    setState(controller.getState());

    return controller.onChange((next) => {
      setState(next);
      saveWorkflow({ index: next.index, checkedItems: next.checkedItems });
      persistProgress(def, next.completed);
    });
  }, [def]);

  const next = useCallback(() => ctrlRef.current?.next(), []);
  const prev = useCallback(() => ctrlRef.current?.prev(), []);
  const goToStep = useCallback((id: string) => ctrlRef.current?.goToStep(id), []);
  const toggleComplete = useCallback(() => {
    const c = ctrlRef.current;
    if (!c) return;
    if (c.isComplete()) c.markIncomplete();
    else c.markComplete();
  }, []);
  const toggleChecklistItem = useCallback(
    (id: string) => ctrlRef.current?.toggleChecklistItem(id),
    [],
  );
  const isComplete = useCallback(
    (id?: string) => ctrlRef.current?.isComplete(id) ?? false,
    [],
  );
  const isChecked = useCallback(
    (id: string) => ctrlRef.current?.isChecked(id) ?? false,
    [],
  );

  const step = def.steps[state.index]!;
  return {
    state,
    steps: def.steps,
    step,
    stepId: step.id as DovetailStep,
    next,
    prev,
    goToStep,
    toggleComplete,
    toggleChecklistItem,
    isComplete,
    isChecked,
  };
}

function persistProgress(
  def: WorkflowDefinition,
  completed: Record<string, boolean>,
): void {
  const record = {} as Record<DovetailStep, ProgressEntry>;
  for (const step of def.steps) {
    const id = step.id as DovetailStep;
    record[id] = { step: id, completed: completed[step.id] === true };
  }
  saveProgress(record);
}
