import { describe, it, expect } from "vitest";
import {
  DEFAULT_DOVETAIL_PARAMS,
  generateMarkings,
  type DovetailStep,
} from "@craft-codex/core";
import { DOVETAIL_WORKFLOW } from "./dovetail-workflow";
import { getDemoCorpus } from "../rag/corpus";

const EXPECTED_STEPS: DovetailStep[] = [
  "anreissen",
  "saegen",
  "stemmen",
  "passen",
  "pruefen",
];

describe("DOVETAIL_WORKFLOW", () => {
  it("covers the five dovetail steps in order", () => {
    expect(DOVETAIL_WORKFLOW.steps.map((s) => s.id)).toEqual(EXPECTED_STEPS);
  });

  it("every relatedMarkingId prefix matches a real marking for its step", () => {
    for (const step of DOVETAIL_WORKFLOW.steps) {
      const markingIds = generateMarkings(
        step.id as DovetailStep,
        DEFAULT_DOVETAIL_PARAMS,
      ).map((m) => m.id);
      for (const prefix of step.relatedMarkingIds) {
        const hit = markingIds.some((id) => id.startsWith(prefix));
        expect(hit, `step "${step.id}" prefix "${prefix}"`).toBe(true);
      }
    }
  });

  it("every ragTopic exists in the corpus", () => {
    const topics = new Set(
      getDemoCorpus().map((d) => d.metadata.topic as string | undefined),
    );
    for (const step of DOVETAIL_WORKFLOW.steps) {
      if (step.ragTopic) {
        expect(topics.has(step.ragTopic), `ragTopic "${step.ragTopic}"`).toBe(
          true,
        );
      }
    }
  });

  it("checklist item ids are globally unique", () => {
    const ids = DOVETAIL_WORKFLOW.steps.flatMap((s) =>
      (s.checklist ?? []).map((c) => c.id),
    );
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("each step has at least one instruction and a non-empty label", () => {
    for (const step of DOVETAIL_WORKFLOW.steps) {
      expect(step.instructions.length).toBeGreaterThan(0);
      expect(step.label.length).toBeGreaterThan(0);
    }
  });
});
