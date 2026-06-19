/**
 * Guided-Workflow Domänenmodell.
 *
 * Framework-agnostisch — kein React/Three/DOM. Beschreibt eine geführte
 * Schritt-für-Schritt-Anleitung („workflow") über die Lernschritte eines
 * Werkstücks. Die konkreten Schritt-Texte (DE-Pädagogik) leben im Consumer
 * (apps/tischler/lib/workflow), der Core liefert nur Typen + Controller.
 */

/** Ein abhakbarer Checklisten-Punkt innerhalb eines Schritts. */
export interface WorkflowChecklistItem {
  /** Global eindeutige ID (über alle Schritte) — Persistenz-Key. */
  id: string;
  label: string;
}

/**
 * Ein Schritt der geführten Anleitung.
 *
 * `id` ist bewusst ein freier String (statt an DovetailStep gebunden), damit
 * der Core gewerk-agnostisch bleibt — die Tischler-Definition setzt dort die
 * DovetailStep-Werte ein.
 */
export interface WorkflowStep {
  /** Schritt-ID (im Tischler-Fall == DovetailStep, z. B. "anreissen"). */
  id: string;
  /** Anzeigename (z. B. "Anreißen"). */
  label: string;
  /** Kurze, knappe Handlungsanweisungen — eine pro Zeile. */
  instructions: string[];
  /** Benötigte Werkzeuge für diesen Schritt. */
  tools: string[];
  /**
   * Präfixe der Markierungs-IDs (MarkingLine.id), die zu diesem Schritt
   * gehören — z. B. "winkel_pin" matcht "winkel_pin_0_left". Erlaubt späteres
   * Hervorheben einzelner Hologramm-Linien ohne die Pin-Anzahl zu kennen.
   */
  relatedMarkingIds: string[];
  /** Optionale Checkliste, die der Lehrling abhaken kann. */
  checklist?: WorkflowChecklistItem[];
  /**
   * RAG-Topic (== corpus metadata.topic) zum Eingrenzen der Sprach-Q&A auf
   * diesen Schritt. Reines Routing-Metadatum — kein Anleitungstext.
   */
  ragTopic?: string;
}

/** Vollständige geführte Anleitung für ein Werkstück. */
export interface WorkflowDefinition {
  id: string;
  label: string;
  steps: WorkflowStep[];
}

/**
 * Serialisierbarer Fortschritt — was persistiert/hydratisiert wird.
 * Bewusst flach + JSON-rein (keine Maps), damit localStorage es direkt trägt.
 */
export interface WorkflowState {
  /** Index des aktuellen Schritts in def.steps. */
  index: number;
  /** stepId → erledigt. */
  completed: Record<string, boolean>;
  /** checklistItemId → abgehakt. */
  checkedItems: Record<string, boolean>;
}
