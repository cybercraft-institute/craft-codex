import { describe, it, expect } from "vitest";
import {
  applyRigid,
  solveLeveledFrame,
  solveRigidFrom3Points,
  type Quat,
  type RigidTransform,
  type Vec3,
} from "./paired-point.js";

// R·v = applyRigid(t, v) − translation.
function rotate(t: RigidTransform, v: Vec3): Vec3 {
  const r = applyRigid(t, v);
  return [r[0] - t.position[0], r[1] - t.position[1], r[2] - t.position[2]];
}

// Normalised quaternion for a known rotation (axis (1,2,3), ~50°).
function quat(axis: Vec3, deg: number): Quat {
  const r = (deg * Math.PI) / 180;
  const l = Math.hypot(...axis);
  const s = Math.sin(r / 2);
  return [(axis[0] / l) * s, (axis[1] / l) * s, (axis[2] / l) * s, Math.cos(r / 2)];
}

const MODEL: [Vec3, Vec3, Vec3] = [
  [-0.05, 0.075, 0.1],
  [0.05, 0.075, 0.1],
  [0.05, 0.075, -0.1],
];

describe("solveRigidFrom3Points", () => {
  it("recovers a known rigid transform exactly (congruent points)", () => {
    const truth: RigidTransform = {
      position: [1.2, 0.4, -0.6],
      rotation: quat([1, 2, 3], 50),
      rmsError: 0,
    };
    const world = MODEL.map((p) => applyRigid(truth, p)) as [Vec3, Vec3, Vec3];

    const solved = solveRigidFrom3Points(MODEL, world);
    expect(solved).not.toBeNull();
    // Compare by re-applying — avoids quaternion double-cover sign ambiguity.
    for (let i = 0; i < 3; i++) {
      const got = applyRigid(solved!, MODEL[i]!);
      for (let k = 0; k < 3; k++) expect(got[k]).toBeCloseTo(world[i]![k]!, 6);
    }
    expect(solved!.rmsError).toBeCloseTo(0, 6);
  });

  it("maps the model origin (point 0) onto the touched world point", () => {
    const truth: RigidTransform = {
      position: [0.3, 1.0, 0.2],
      rotation: quat([0, 1, 0], 90),
      rmsError: 0,
    };
    const world = MODEL.map((p) => applyRigid(truth, p)) as [Vec3, Vec3, Vec3];
    const solved = solveRigidFrom3Points(MODEL, world)!;
    const o = applyRigid(solved, MODEL[0]);
    for (let k = 0; k < 3; k++) expect(o[k]).toBeCloseTo(world[0][k]!, 6);
  });

  it("produces an orthonormal (unit) quaternion", () => {
    const truth: RigidTransform = {
      position: [0, 0, 0],
      rotation: quat([2, -1, 0.5], 123),
      rmsError: 0,
    };
    const world = MODEL.map((p) => applyRigid(truth, p)) as [Vec3, Vec3, Vec3];
    const q = solveRigidFrom3Points(MODEL, world)!.rotation;
    expect(Math.hypot(...q)).toBeCloseTo(1, 6);
  });

  it("reports a non-zero rmsError when a touched point is off (measurement noise)", () => {
    const truth: RigidTransform = {
      position: [0.5, 0.5, 0.5],
      rotation: quat([1, 0, 0], 30),
      rmsError: 0,
    };
    const world = MODEL.map((p) => applyRigid(truth, p)) as [Vec3, Vec3, Vec3];
    world[2] = [world[2][0] + 0.004, world[2][1], world[2][2]]; // 4mm slip
    const solved = solveRigidFrom3Points(MODEL, world)!;
    expect(solved.rmsError).toBeGreaterThan(0);
    expect(solved.rmsError).toBeLessThan(0.004); // distributed, not the full slip
  });

  it("returns null for collinear points", () => {
    const collinear: [Vec3, Vec3, Vec3] = [
      [0, 0, 0],
      [1, 0, 0],
      [2, 0, 0],
    ];
    expect(solveRigidFrom3Points(collinear, MODEL)).toBeNull();
    expect(solveRigidFrom3Points(MODEL, collinear)).toBeNull();
  });
});

describe("solveLeveledFrame", () => {
  // Touched points with deliberate vertical slop (not level).
  const WORLD: [Vec3, Vec3, Vec3] = [
    [1.0, 0.5, 0.3], // origin
    [1.2, 0.55, 0.3], // X guide — 5cm higher than origin
    [1.0, 0.52, 0.1], // Y guide — 2cm higher
  ];

  it("maps the model origin exactly onto the first touched point", () => {
    const t = solveLeveledFrame(MODEL, WORLD)!;
    const o = applyRigid(t, MODEL[0]);
    for (let k = 0; k < 3; k++) expect(o[k]).toBeCloseTo(WORLD[0][k]!, 6);
  });

  it("forces the model up-axis to world-up (board stays level)", () => {
    const t = solveLeveledFrame(MODEL, WORLD)!;
    const up = rotate(t, [0, 1, 0]); // model frame up = +Y
    expect(up[0]).toBeCloseTo(0, 6);
    expect(up[1]).toBeCloseTo(1, 6);
    expect(up[2]).toBeCloseTo(0, 6);
  });

  it("keeps the X axis horizontal despite the tilted guide point", () => {
    const t = solveLeveledFrame(MODEL, WORLD)!;
    const x = rotate(t, [1, 0, 0]);
    expect(x[1]).toBeCloseTo(0, 6); // no vertical component
  });

  it("produces a unit quaternion and a non-zero rms (slop removed)", () => {
    const t = solveLeveledFrame(MODEL, WORLD)!;
    expect(Math.hypot(...t.rotation)).toBeCloseTo(1, 6);
    expect(t.rmsError).toBeGreaterThan(0);
  });

  it("returns null when the X guide is directly above the origin", () => {
    const bad: [Vec3, Vec3, Vec3] = [
      [0, 0, 0],
      [0, 0.2, 0],
      [0, 0, 0.2],
    ];
    expect(solveLeveledFrame(MODEL, bad)).toBeNull();
  });
});
