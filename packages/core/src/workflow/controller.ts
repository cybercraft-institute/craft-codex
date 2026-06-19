/**
 * WorkflowController — reine State-Machine über eine WorkflowDefinition.
 *
 * Kein Timer, kein Storage, keine Frames, kein React. Persistenz + Rendering
 * leben im Consumer. Pub/Sub-Idiom wie ManualPlacementProvider (Set von
 * Callbacks, Unsubscribe-Closure).
 */

import type {
  WorkflowDefinition,
  WorkflowState,
  WorkflowStep,
} from "./types.js";

export class WorkflowController {
  private readonly def: WorkflowDefinition;
  private state: WorkflowState;
  private readonly listeners = new Set<(state: WorkflowState) => void>();

  constructor(def: WorkflowDefinition, initial?: Partial<WorkflowState>) {
    if (def.steps.length === 0) {
      throw new Error("WorkflowController: definition has no steps");
    }
    this.def = def;
    this.state = WorkflowController.hydrate(def, initial);
  }

  /** Read-only Schrittliste. */
  getSteps(): readonly WorkflowStep[] {
    return this.def.steps;
  }

  /** Aktueller Schritt (immer gültig — index ist geklemmt). */
  getCurrentStep(): WorkflowStep {
    return this.def.steps[this.state.index]!;
  }

  /** Defensive Kopie des aktuellen Zustands. */
  getState(): WorkflowState {
    return {
      index: this.state.index,
      completed: { ...this.state.completed },
      checkedItems: { ...this.state.checkedItems },
    };
  }

  /** Alias — semantisch „für Persistenz serialisieren". */
  serialize(): WorkflowState {
    return this.getState();
  }

  // — Navigation —————————————————————————————————————————————————————————

  next(): void {
    this.goTo(this.state.index + 1);
  }

  prev(): void {
    this.goTo(this.state.index - 1);
  }

  /** Springt zu Index (geklemmt auf [0, steps-1]); No-op bei gleichem Index. */
  goTo(index: number): void {
    const clamped = clampIndex(index, this.def.steps.length);
    if (clamped === this.state.index) return;
    this.state = { ...this.state, index: clamped };
    this.emit();
  }

  /** Springt zum Schritt mit der gegebenen ID; No-op wenn unbekannt. */
  goToStep(stepId: string): void {
    const idx = this.def.steps.findIndex((s) => s.id === stepId);
    if (idx === -1) return;
    this.goTo(idx);
  }

  // — Fortschritt ————————————————————————————————————————————————————————

  markComplete(stepId: string = this.getCurrentStep().id): void {
    this.setCompleted(stepId, true);
  }

  markIncomplete(stepId: string = this.getCurrentStep().id): void {
    this.setCompleted(stepId, false);
  }

  isComplete(stepId: string = this.getCurrentStep().id): boolean {
    return this.state.completed[stepId] === true;
  }

  private setCompleted(stepId: string, value: boolean): void {
    if (!this.def.steps.some((s) => s.id === stepId)) return;
    if (this.isComplete(stepId) === value) return;
    this.state = {
      ...this.state,
      completed: { ...this.state.completed, [stepId]: value },
    };
    this.emit();
  }

  // — Checkliste —————————————————————————————————————————————————————————

  toggleChecklistItem(itemId: string): void {
    if (!this.knownChecklistIds().has(itemId)) return;
    const next = !this.state.checkedItems[itemId];
    this.state = {
      ...this.state,
      checkedItems: { ...this.state.checkedItems, [itemId]: next },
    };
    this.emit();
  }

  isChecked(itemId: string): boolean {
    return this.state.checkedItems[itemId] === true;
  }

  // — Pub/Sub ————————————————————————————————————————————————————————————

  onChange(cb: (state: WorkflowState) => void): () => void {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }

  private emit(): void {
    const snapshot = this.getState();
    this.listeners.forEach((cb) => cb(snapshot));
  }

  private knownChecklistIds(): Set<string> {
    return collectChecklistIds(this.def);
  }

  /**
   * Baut einen gültigen Zustand aus (teilweise/veralteten) persistierten Daten.
   * Verwirft unbekannte Schritt- und Checklisten-IDs und klemmt den Index —
   * so überlebt die App ein geändertes Definitions-Schema ohne Absturz.
   */
  static hydrate(
    def: WorkflowDefinition,
    persisted?: Partial<WorkflowState>,
  ): WorkflowState {
    const stepIds = new Set(def.steps.map((s) => s.id));
    const checklistIds = collectChecklistIds(def);

    const completed: Record<string, boolean> = {};
    for (const [id, done] of Object.entries(persisted?.completed ?? {})) {
      if (stepIds.has(id) && done) completed[id] = true;
    }

    const checkedItems: Record<string, boolean> = {};
    for (const [id, checked] of Object.entries(persisted?.checkedItems ?? {})) {
      if (checklistIds.has(id) && checked) checkedItems[id] = true;
    }

    return {
      index: clampIndex(persisted?.index ?? 0, def.steps.length),
      completed,
      checkedItems,
    };
  }
}

function clampIndex(index: number, length: number): number {
  if (!Number.isFinite(index)) return 0;
  return Math.max(0, Math.min(Math.trunc(index), length - 1));
}

function collectChecklistIds(def: WorkflowDefinition): Set<string> {
  const ids = new Set<string>();
  for (const step of def.steps) {
    for (const item of step.checklist ?? []) ids.add(item.id);
  }
  return ids;
}
