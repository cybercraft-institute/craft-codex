import { WorkflowRoot } from "../../../components/WorkflowRoot";
import { SiteFooter } from "../../../components/SiteFooter";

export default function DovetailXRPage() {
  return (
    <>
      <main className="cc-page" style={{ maxWidth: 1080 }}>
        <p className="cc-kicker">Werkstück 03</p>
        <h1
          style={{
            margin: "0.5rem 0 0.75rem",
            fontSize: "clamp(1.8rem, 4vw, 2.6rem)",
            textTransform: "uppercase",
          }}
        >
          Schwalbenschwanz <span className="cc-mark">geführt</span> bauen
        </h1>
        <p className="cc-muted" style={{ lineHeight: 1.6, margin: 0, maxWidth: "62ch" }}>
          Schritt für Schritt vom Anreißen bis zum Prüfen — mit Hologramm,
          Werkzeugliste und Checkliste. Quest 3 &amp; HoloLens fahren die
          immersive AR-Session, Tablets die Kamera-Vorschau. Dasselbe Werkstück,
          jedes Gerät.
        </p>

        <WorkflowRoot />
      </main>
      <SiteFooter />
    </>
  );
}
