"use client";

import type { UseWorkflowResult } from "../lib/workflow/useWorkflow";

/**
 * Backend-agnostisches HTML-Schrittpanel für die geführte Anleitung
 * (Preview + Magic-Window). Headsets bekommen stattdessen das 3D-WorkflowPanel.
 */
export function WorkflowOverlay({ wf }: { wf: UseWorkflowResult }) {
  const { state, steps, step } = wf;
  const idx = state.index;
  const done = wf.isComplete();

  return (
    <div
      data-testid="workflow-overlay"
      className="cc-card"
      style={{ display: "flex", flexDirection: "column", gap: "0.9rem" }}
    >
      {/* Fortschritt — anklickbare Schritt-Tabs */}
      <div className="cc-tabbar" role="tablist" aria-label="Lernschritte">
        {steps.map((s, i) => (
          <button
            key={s.id}
            role="tab"
            aria-selected={i === idx}
            className="cc-tab"
            onClick={() => wf.goToStep(s.id)}
          >
            <span className="cc-tab-step" aria-hidden="true">
              {i + 1}
            </span>
            {s.label}
            {wf.isComplete(s.id) ? " ✓" : ""}
          </button>
        ))}
      </div>

      <header>
        <p className="cc-kicker">
          Schritt {idx + 1} / {steps.length}
        </p>
        <h2
          data-testid="workflow-step-title"
          style={{ fontSize: "1.4rem", textTransform: "uppercase", marginTop: "0.4rem" }}
        >
          {step.label}
        </h2>
      </header>

      <ol style={{ margin: 0, paddingLeft: "1.2rem", lineHeight: 1.55, fontSize: "0.92rem" }}>
        {step.instructions.map((line, i) => (
          <li key={i} style={{ marginBottom: "0.35rem" }}>
            {line}
          </li>
        ))}
      </ol>

      {step.tools.length > 0 && (
        <div>
          <p className="cc-kicker" style={{ marginBottom: "0.5rem" }}>
            Werkzeug
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
            {step.tools.map((t) => (
              <span key={t} className="cc-chip" style={{ cursor: "default" }}>
                {t}
              </span>
            ))}
          </div>
        </div>
      )}

      {step.checklist && step.checklist.length > 0 && (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "0.4rem" }}>
          {step.checklist.map((item) => (
            <li key={item.id}>
              <label style={{ display: "flex", gap: "0.5rem", alignItems: "center", fontSize: "0.9rem", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={wf.isChecked(item.id)}
                  onChange={() => wf.toggleChecklistItem(item.id)}
                />
                {item.label}
              </label>
            </li>
          ))}
        </ul>
      )}

      <footer style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginTop: "0.2rem" }}>
        <button
          type="button"
          data-testid="workflow-prev"
          className="cc-btn cc-btn--sm"
          onClick={wf.prev}
          disabled={idx === 0}
        >
          ← Zurück
        </button>
        <button
          type="button"
          data-testid="workflow-complete"
          className={`cc-btn cc-btn--sm${done ? " cc-btn--dark" : ""}`}
          onClick={wf.toggleComplete}
          aria-pressed={done}
        >
          {done ? "Erledigt ✓" : "Als erledigt markieren"}
        </button>
        <button
          type="button"
          data-testid="workflow-next"
          className="cc-btn cc-btn--sm cc-btn--primary"
          onClick={wf.next}
          disabled={idx === steps.length - 1}
          style={{ marginLeft: "auto" }}
        >
          Weiter →
        </button>
      </footer>
    </div>
  );
}
