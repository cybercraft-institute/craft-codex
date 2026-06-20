/**
 * Paired-Point-Registrierung — richtet ein digitales Modell präzise an einem
 * realen Objekt aus, ohne Kamera/Marker.
 *
 * Der Nutzer berührt drei bekannte Punkte am realen Werkstück (z. B. Brett-
 * ecken) mit der getrackten Controller-Spitze; aus den Korrespondenzen
 * Modell↔Welt wird die starre Transformation (Rotation + Translation, Maßstab
 * fix) berechnet, die das Modell auf das reale Objekt legt. Closed-form über
 * orthonormale Dreibeine — exakt für drei Punkte, robust für leichte Mess-
 * abweichungen (der Restfehler `rmsError` quantifiziert die Güte).
 *
 * Framework-agnostisch: reine Zahlen, kein three.js. Rotation als Quaternion
 * [x,y,z,w], passend zu Pose in tracking/types.
 */

export type Vec3 = [number, number, number];
export type Quat = [number, number, number, number];

export interface RigidTransform {
  /** Translation (Welt-Position des Modell-Ursprungs). */
  position: Vec3;
  /** Rotation als Quaternion [x, y, z, w]. */
  rotation: Quat;
  /** RMS-Restfehler über die Korrespondenzen (Welt-Einheiten, z. B. m). */
  rmsError: number;
}

// — Vektor-Helfer —————————————————————————————————————————————————————————
const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a: Vec3): number => Math.sqrt(dot(a, a));
const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const scaleV = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s];
function normalize(a: Vec3): Vec3 | null {
  const l = len(a);
  if (l < 1e-9) return null;
  return [a[0] / l, a[1] / l, a[2] / l];
}

// — 3×3-Matrix (row-major, m[row*3 + col]) ————————————————————————————————
type Mat3 = number[];
const colsToMat = (x: Vec3, y: Vec3, z: Vec3): Mat3 => [
  x[0], y[0], z[0],
  x[1], y[1], z[1],
  x[2], y[2], z[2],
];
const transpose = (m: Mat3): Mat3 => [
  m[0]!, m[3]!, m[6]!,
  m[1]!, m[4]!, m[7]!,
  m[2]!, m[5]!, m[8]!,
];
function mul(a: Mat3, b: Mat3): Mat3 {
  const r: number[] = new Array(9).fill(0);
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++)
      r[i * 3 + j] =
        a[i * 3]! * b[j]! + a[i * 3 + 1]! * b[3 + j]! + a[i * 3 + 2]! * b[6 + j]!;
  return r;
}
const applyMat = (m: Mat3, v: Vec3): Vec3 => [
  m[0]! * v[0] + m[1]! * v[1] + m[2]! * v[2],
  m[3]! * v[0] + m[4]! * v[1] + m[5]! * v[2],
  m[6]! * v[0] + m[7]! * v[1] + m[8]! * v[2],
];

/** Orthonormales rechtshändiges Dreibein aus drei Punkten (null bei kollinear). */
function frameFromPoints(p0: Vec3, p1: Vec3, p2: Vec3): Mat3 | null {
  const x = normalize(sub(p1, p0));
  if (!x) return null;
  const z = normalize(cross(x, sub(p2, p0)));
  if (!z) return null; // p2 kollinear zu p0→p1
  const y = cross(z, x); // bereits Einheitslänge
  return colsToMat(x, y, z);
}

/** Row-major-Rotationsmatrix → Quaternion [x, y, z, w]. */
function matToQuat(m: Mat3): Quat {
  const [m00, m01, m02, m10, m11, m12, m20, m21, m22] = m as [
    number, number, number, number, number, number, number, number, number,
  ];
  const trace = m00 + m11 + m22;
  let x: number, y: number, z: number, w: number;
  if (trace > 0) {
    const s = 0.5 / Math.sqrt(trace + 1.0);
    w = 0.25 / s;
    x = (m21 - m12) * s;
    y = (m02 - m20) * s;
    z = (m10 - m01) * s;
  } else if (m00 > m11 && m00 > m22) {
    const s = 2.0 * Math.sqrt(1.0 + m00 - m11 - m22);
    w = (m21 - m12) / s;
    x = 0.25 * s;
    y = (m01 + m10) / s;
    z = (m02 + m20) / s;
  } else if (m11 > m22) {
    const s = 2.0 * Math.sqrt(1.0 + m11 - m00 - m22);
    w = (m02 - m20) / s;
    x = (m01 + m10) / s;
    y = 0.25 * s;
    z = (m12 + m21) / s;
  } else {
    const s = 2.0 * Math.sqrt(1.0 + m22 - m00 - m11);
    w = (m10 - m01) / s;
    x = (m02 + m20) / s;
    y = (m12 + m21) / s;
    z = 0.25 * s;
  }
  return [x, y, z, w];
}

/** Wendet eine starre Transformation auf einen Punkt an: world = pos + R·v. */
export function applyRigid(t: RigidTransform, v: Vec3): Vec3 {
  const [qx, qy, qz, qw] = t.rotation;
  // v' = v + 2q_xyz × (q_xyz × v + q_w v)
  const tx = 2 * (qy * v[2] - qz * v[1]);
  const ty = 2 * (qz * v[0] - qx * v[2]);
  const tz = 2 * (qx * v[1] - qy * v[0]);
  return [
    t.position[0] + v[0] + qw * tx + (qy * tz - qz * ty),
    t.position[1] + v[1] + qw * ty + (qz * tx - qx * tz),
    t.position[2] + v[2] + qw * tz + (qx * ty - qy * tx),
  ];
}

/**
 * Berechnet die starre Transformation (Maßstab fix = 1), die `model` möglichst
 * gut auf `world` abbildet. Exakt für drei kongruente Punkte, sonst Best-Fit
 * über die Dreibeine. Gibt null bei kollinearen Punkten zurück.
 */
export function solveRigidFrom3Points(
  model: [Vec3, Vec3, Vec3],
  world: [Vec3, Vec3, Vec3],
): RigidTransform | null {
  const Fm = frameFromPoints(model[0], model[1], model[2]);
  const Fw = frameFromPoints(world[0], world[1], world[2]);
  if (!Fm || !Fw) return null;

  const R = mul(Fw, transpose(Fm)); // R = F_world · F_modelᵀ
  const rotation = matToQuat(R);
  const position = sub(world[0], applyMat(R, model[0]));
  const transform: RigidTransform = { position, rotation, rmsError: 0 };

  let sumSq = 0;
  for (let i = 0; i < 3; i++) {
    const d = sub(applyRigid(transform, model[i]!), world[i]!);
    sumSq += dot(d, d);
  }
  transform.rmsError = Math.sqrt(sumSq / 3);
  return transform;
}

/**
 * Wie solveRigidFrom3Points, aber die Ergebnis-Ebene wird auf die Welt-Horizontale
 * gezwungen (Modell-Hochachse → `up`). Nur Ursprung (Punkt 0) und die horizontale
 * Richtung von Punkt 0→1 bestimmen die Lage; Punkt 2 ist nur visuelle Stütze.
 * So bleibt das Brett immer eben, egal wie schief die realen Punkte getroffen
 * wurden. `rmsError` misst die so entfernte Schieflage.
 */
export function solveLeveledFrame(
  model: [Vec3, Vec3, Vec3],
  world: [Vec3, Vec3, Vec3],
  up: Vec3 = [0, 1, 0],
): RigidTransform | null {
  const Fm = frameFromPoints(model[0], model[1], model[2]);
  const upN = normalize(up);
  if (!Fm || !upN) return null;

  // Welt-Frame, auf die Horizontale nivelliert: x = horizontale Richtung 0→1,
  // z = up, y = z × x.
  const xRaw = sub(world[1], world[0]);
  const x = normalize(sub(xRaw, scaleV(upN, dot(xRaw, upN))));
  if (!x) return null; // Punkt 1 liegt senkrecht über Punkt 0
  const z = upN;
  const y = cross(z, x);
  const Fw = colsToMat(x, y, z);

  const R = mul(Fw, transpose(Fm));
  const rotation = matToQuat(R);
  const position = sub(world[0], applyMat(R, model[0]));
  const transform: RigidTransform = { position, rotation, rmsError: 0 };

  let sumSq = 0;
  for (let i = 0; i < 3; i++) {
    const d = sub(applyRigid(transform, model[i]!), world[i]!);
    sumSq += dot(d, d);
  }
  transform.rmsError = Math.sqrt(sumSq / 3);
  return transform;
}
