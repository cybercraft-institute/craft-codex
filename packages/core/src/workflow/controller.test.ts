import { describe, it, expect, vi } from "vitest";
import { WorkflowController } from "./controller.js";
import type { WorkflowDefinition } from "./types.js";

const DEF: WorkflowDefinition = {
  id: "test",
  label: "Test",
  steps: [
    {
      id: "a",
      label: "A",
      instructions: ["do a"],
      tools: ["t1"],
      relatedMarkingIds: ["mark_a"],
      checklist: [{ id: "a.1", label: "a one" }],
    },
    { id: "b", label: "B", instructions: ["do b"], tools: [], relatedMarkingIds: [] },
    { id: "c", label: "C", instructions: ["do c"], tools: [], relatedMarkingIds: [] },
  ],
};

describe("WorkflowController", () => {
  it("throws on an empty definition", () => {
    expect(() => new WorkflowController({ id: "x", label: "x", steps: [] })).toThrow();
  });

  it("starts at index 0 on the first step", () => {
    const c = new WorkflowController(DEF);
    expect(c.getState().index).toBe(0);
    expect(c.getCurrentStep().id).toBe("a");
  });

  it("next/prev clamp at both ends", () => {
    const c = new WorkflowController(DEF);
    c.prev();
    expect(c.getState().index).toBe(0); // clamped low
    c.next();
    c.next();
    c.next(); // past the end
    expect(c.getState().index).toBe(2); // clamped high
    expect(c.getCurrentStep().id).toBe("c");
  });

  it("goToStep jumps by id and ignores unknown ids", () => {
    const c = new WorkflowController(DEF);
    c.goToStep("b");
    expect(c.getCurrentStep().id).toBe("b");
    c.goToStep("does-not-exist");
    expect(c.getCurrentStep().id).toBe("b");
  });

  it("marks steps complete/incomplete", () => {
    const c = new WorkflowController(DEF);
    expect(c.isComplete("a")).toBe(false);
    c.markComplete(); // current = a
    expect(c.isComplete("a")).toBe(true);
    c.markIncomplete("a");
    expect(c.isComplete("a")).toBe(false);
  });

  it("ignores completion for unknown steps", () => {
    const c = new WorkflowController(DEF);
    c.markComplete("ghost");
    expect(c.getState().completed).toEqual({});
  });

  it("toggles only known checklist items", () => {
    const c = new WorkflowController(DEF);
    c.toggleChecklistItem("a.1");
    expect(c.isChecked("a.1")).toBe(true);
    c.toggleChecklistItem("a.1");
    expect(c.isChecked("a.1")).toBe(false);
    c.toggleChecklistItem("unknown.item");
    expect(c.isChecked("unknown.item")).toBe(false);
  });

  it("notifies subscribers on change and stops after unsubscribe", () => {
    const c = new WorkflowController(DEF);
    const cb = vi.fn();
    const unsub = c.onChange(cb);
    c.next();
    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb.mock.calls[0]![0].index).toBe(1);
    unsub();
    c.next();
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("does not emit when state is unchanged (no-op goTo)", () => {
    const c = new WorkflowController(DEF);
    const cb = vi.fn();
    c.onChange(cb);
    c.goTo(0); // already there
    expect(cb).not.toHaveBeenCalled();
  });

  it("hydrate drops unknown step/checklist ids and clamps the index", () => {
    const state = WorkflowController.hydrate(DEF, {
      index: 99,
      completed: { a: true, ghost: true },
      checkedItems: { "a.1": true, "bogus.id": true },
    });
    expect(state.index).toBe(2); // clamped to last
    expect(state.completed).toEqual({ a: true });
    expect(state.checkedItems).toEqual({ "a.1": true });
  });

  it("hydrate coerces a non-finite index to 0", () => {
    const state = WorkflowController.hydrate(DEF, { index: NaN });
    expect(state.index).toBe(0);
  });

  it("round-trips serialize → hydrate", () => {
    const c = new WorkflowController(DEF);
    c.next();
    c.markComplete("a");
    c.toggleChecklistItem("a.1");
    const restored = new WorkflowController(DEF, c.serialize());
    expect(restored.getState()).toEqual(c.getState());
  });
});
