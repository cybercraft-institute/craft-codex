/**
 * Geführte Anleitung für den Schwalbenschwanz (Tischler).
 *
 * Die Schritt-IDs == DovetailStep, sodass der Cursor direkt das Hologramm
 * (generateMarkings(step)) und die XRStepBar steuert. Anweisungstexte sind
 * bewusst knapp (Handlungsschritte, nicht Lehrbuch) — Vertiefung liefert die
 * Sprach-Q&A über `ragTopic`. `relatedMarkingIds` sind Präfixe der
 * MarkingLine-IDs aus packages/core/src/geometry/dovetail.ts.
 */

import type { DovetailStep, WorkflowDefinition } from "@craft-codex/core";

// Schritt-IDs typsicher an DovetailStep binden (Tippfehler fallen beim Build auf).
type DovetailWorkflowStep = WorkflowDefinition["steps"][number] & {
  id: DovetailStep;
};

const STEPS: DovetailWorkflowStep[] = [
  {
    id: "anreissen",
    label: "Anreißen",
    instructions: [
      "Streichmaß auf die Brettstärke einstellen und umlaufend anreißen — das ist der Grund.",
      "Schwalben auf dem Hirnholz markieren, die Streichmaß-Linie als Anschlag nehmen.",
      "Mit der Schmiege im Winkel 1:6 (Hartholz) bzw. 1:8 (Weichholz) anreißen.",
      "Abfallflächen schraffieren — was später weg muss, klar kennzeichnen.",
    ],
    tools: ["Streichmaß", "Schmiege / Anreißwinkel", "Anreißmesser", "Bleistift"],
    relatedMarkingIds: ["streichmass_brettstaerke", "winkel_pin"],
    checklist: [
      { id: "anreissen.streichmass", label: "Streichmaß umlaufend angerissen" },
      { id: "anreissen.winkel", label: "Schwalbenwinkel angerissen" },
      { id: "anreissen.abfall", label: "Abfallflächen schraffiert" },
    ],
    ragTopic: "anreissen",
  },
  {
    id: "saegen",
    label: "Sägen",
    instructions: [
      "Brett aufrecht einspannen, die Anrisslinie gut ausleuchten.",
      "Exakt auf der Abfallseite der Linie sägen — die Anrisslinie stehen lassen.",
      "Nur bis zur Streichmaß-Linie (Grund) sägen, nicht tiefer.",
      "Senkrecht und gleichmäßig führen — erst die Schwalben, dann die Absätze.",
    ],
    tools: ["Feinsäge / Dozuki", "Hobelbank / Schraubzwinge"],
    relatedMarkingIds: ["saege_pin"],
    checklist: [
      { id: "saegen.abfallseite", label: "Auf der Abfallseite gesägt" },
      { id: "saegen.grund", label: "Bis zum Grund, nicht tiefer" },
    ],
    ragTopic: "saegen",
  },
  {
    id: "stemmen",
    label: "Stemmen",
    instructions: [
      "Werkstück flach auf eine feste Unterlage zwingen.",
      "Abfallholz zwischen den Schwalben mit dem Stechbeitel ausstemmen.",
      "Von beiden Seiten zur Mitte arbeiten, damit das Hirnholz nicht ausbricht.",
      "Bis zur Streichmaß-Linie stemmen — sie ist die Stopp-Marke.",
    ],
    tools: ["Stechbeitel (Stemmeisen)", "Klüpfel / Holzhammer", "Schraubzwinge"],
    relatedMarkingIds: ["stemm_stopp_linie"],
    checklist: [
      { id: "stemmen.beidseitig", label: "Von beiden Seiten gestemmt" },
      { id: "stemmen.grund", label: "Grund sauber bis zur Linie" },
    ],
    ragTopic: "stemmen",
  },
  {
    id: "passen",
    label: "Passen",
    instructions: [
      "Fertige Schwalben aufs zweite Brett auflegen und die Pins anreißen.",
      "Pins auf der Abfallseite aussägen und ausstemmen wie zuvor.",
      "Trocken zusammenfügen — nur leicht andrücken, nie mit Gewalt.",
      "Zu stramme Stellen gezielt nacharbeiten, bis die Verbindung satt schließt.",
    ],
    tools: ["Anreißmesser", "Feinsäge", "Stechbeitel", "Klüpfel"],
    relatedMarkingIds: ["transfer_pin"],
    checklist: [
      { id: "passen.uebertragen", label: "Pins übertragen" },
      { id: "passen.trockenprobe", label: "Trockenprobe satt geschlossen" },
    ],
    ragTopic: "passen",
  },
  {
    id: "pruefen",
    label: "Prüfen",
    instructions: [
      "Verbindung gegen das grüne Soll-Hologramm halten und vergleichen.",
      "Auf Spaltmaße, bündige Flächen und sauberen Sitz prüfen.",
      "Mit dem Anschlagwinkel die Rechtwinkligkeit der Ecke kontrollieren.",
      "Erst wenn alles passt: verleimen, zwingen und verputzen.",
    ],
    tools: ["Anschlagwinkel", "Haarwinkel / Lineal", "Leim", "Zwingen"],
    relatedMarkingIds: ["soll_geometry"],
    checklist: [
      { id: "pruefen.spaltmass", label: "Keine sichtbaren Spalten" },
      { id: "pruefen.winkel", label: "Ecke rechtwinklig" },
    ],
    ragTopic: "pruefen",
  },
];

export const DOVETAIL_WORKFLOW: WorkflowDefinition = {
  id: "dovetail",
  label: "Schwalbenschwanz",
  steps: STEPS,
};
