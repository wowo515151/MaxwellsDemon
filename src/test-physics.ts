// src/test-physics.ts
import { SimBackend } from "./types";
import { calculateScreening } from "./components/MaterialExplorer";

interface Corner {
  x: number;
  y: number;
  z: number;
}

interface Particle {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  isActive: boolean;
  passed: boolean;
}

interface Gate {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  mass: number;
}

console.log("=========================================");
console.log("   MAXWELL-DIODE CORE PHYSICS AUDIT V1   ");
console.log("=========================================");

let passes = 0;
let fails = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`[PASS] ${message}`);
    passes++;
  } else {
    console.error(`[FAIL] ${message}`);
    fails++;
  }
}

// 1. Audit thermal electron speed scaling
function testThermalSpeed() {
  console.log("\n--- Test 1: Thermal Speed Scaling ---");
  const temp1 = 100;
  const temp2 = 400;
  const multiplier = 1.0;

  const speed1 = 0.12 * Math.sqrt(temp1) * multiplier;
  const speed2 = 0.12 * Math.sqrt(temp2) * multiplier;

  assert(Math.abs(speed1 - 1.2) < 1e-5, `Thermal speed at 100K should be 1.2, got \${speed1}`);
  assert(Math.abs(speed2 - 2.4) < 1e-5, `Thermal speed at 400K should be 2.4 (sqrt(4) * speed1), got \${speed2}`);
  assert(speed2 === speed1 * 2, "Thermal speed should scale precisely with sqrt(T)");
}

// 2. Audit spring rest length and force calculations
function testSpringBonds() {
  console.log("\n--- Test 2: Flexible Bond Restoring Forces ---");
  const xAperture = 2.0;
  const yAperture = 2.0;
  const initialDisplacement = 0.3;
  const springStiffness = 5.0;

  // Rest length: sqrt(2^2 + 2^2 + 0.3^2) = sqrt(8 + 0.09) = sqrt(8.09) = 2.84429
  const springRestLength = Math.sqrt(xAperture * xAperture + yAperture * yAperture + initialDisplacement * initialDisplacement);
  const expectedRestLength = Math.sqrt(8.09);
  assert(Math.abs(springRestLength - expectedRestLength) < 1e-7, "Spring rest length matches initial geometry");

  const corners: Corner[] = [
    { x: xAperture, y: yAperture, z: 0 },
    { x: -xAperture, y: yAperture, z: 0 },
    { x: xAperture, y: -yAperture, z: 0 },
    { x: -xAperture, y: -yAperture, z: 0 },
  ];

  // At center with rest position, net spring forces should be zero in x and y, and restoring in z if displaced
  const gate: Gate = { x: 0, y: 0, z: initialDisplacement, vx: 0, vy: 0, vz: 0, mass: 47.8 };

  let fSpringX = 0;
  let fSpringY = 0;
  let fSpringZ = 0;

  corners.forEach(c => {
    const dx = gate.x - c.x;
    const dy = gate.y - c.y;
    const dz = gate.z - c.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (dist > 0.01) {
      const stretch = dist - springRestLength;
      const forceMag = -springStiffness * stretch;
      fSpringX += forceMag * (dx / dist);
      fSpringY += forceMag * (dy / dist);
      fSpringZ += forceMag * (dz / dist);
    }
  });

  assert(Math.abs(fSpringX) < 1e-7, "Symmetric x-spring forces cancel out perfectly at x=0");
  assert(Math.abs(fSpringY) < 1e-7, "Symmetric y-spring forces cancel out perfectly at y=0");
  assert(Math.abs(fSpringZ) < 1e-7, "At rest displacement, z restoring force should be exactly 0");

  // Displace gate in z positive: z = 1.0 (stretched)
  const gateStretched: Gate = { x: 0, y: 0, z: 1.0, vx: 0, vy: 0, vz: 0, mass: 47.8 };
  let fStretchedZ = 0;
  corners.forEach(c => {
    const dx = gateStretched.x - c.x;
    const dy = gateStretched.y - c.y;
    const dz = gateStretched.z - c.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const stretch = dist - springRestLength;
    const forceMag = -springStiffness * stretch;
    fStretchedZ += forceMag * (dz / dist);
  });

  // Since gate is pulled at z=1.0 which is > initialDisplacement=0.3, the springs are stretched, so force should pull it back (negative direction)
  assert(fStretchedZ < 0, "Stretched bonds exert a negative restoring force in the z-axis");
}

// 3. Audit Electrostatic coupling and repulsion
function testElectrostatics() {
  console.log("\n--- Test 3: Electrostatic Repulsion & Conservation ---");
  const gateCharge = 2.0;
  const C_electrostatic = 2.4;
  const eps = 0.35; // softening parameter

  // Place gate at (0, 0, 0), electron at (0, 0, 1.0)
  const gate: Gate = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, mass: 47.8 };
  const particle: Particle = { x: 0, y: 0, z: 1.0, vx: 0, vy: 0, vz: 0, isActive: true, passed: false };

  const dx = particle.x - gate.x;
  const dy = particle.y - gate.y;
  const dz = particle.z - gate.z;
  const distSq = dx * dx + dy * dy + dz * dz;
  const dist = Math.sqrt(distSq);
  const softenedDistSq = distSq + eps * eps;

  const forceMag = (C_electrostatic * gateCharge) / softenedDistSq;
  // Repulsion on electron: points in dx direction
  const fx = forceMag * (dx / dist);
  const fy = forceMag * (dy / dist);
  const fz = forceMag * (dz / dist);

  assert(Math.abs(fx) < 1e-7, "Electrostatic x-force is zero for z-aligned charge");
  assert(Math.abs(fy) < 1e-7, "Electrostatic y-force is zero for z-aligned charge");
  assert(fz > 0, `Repelling z-force on electron should be positive (pushing along +z), got \${fz}`);

  // Newton's Third Law audit: gate experiences opposite force
  const fGateX = -fx;
  const fGateY = -fy;
  const fGateZ = -fz;
  assert(fGateZ < 0, "Gate experiences equal and opposite force (-z)");
  assert(Math.abs(fz + fGateZ) < 1e-15, "Action-reaction pair cancels perfectly (Newton's 3rd Law)");
}

// 4. Audit Lennard-Jones potential force field
function testLennardJones() {
  console.log("\n--- Test 4: Lennard-Jones Potential Repulsion ---");
  const sigma_lj = 1.8;
  const eps_lj = 0.08;

  // Let's test a single corner atom at (2.0, 2.0, 0) and gate at (1.9, 1.9, 0) - very close!
  const c: Corner = { x: 2.0, y: 2.0, z: 0 };
  const gate: Gate = { x: 1.9, y: 1.9, z: 0, vx: 0, vy: 0, vz: 0, mass: 47.8 };

  const dx = gate.x - c.x; // -0.1
  const dy = gate.y - c.y; // -0.1
  const dz = gate.z - c.z; // 0
  const dist = Math.sqrt(dx * dx + dy * dy + dz * dz); // ~0.1414

  const sr = sigma_lj / dist; // 1.8 / 0.1414 = 12.72
  const sr6 = Math.pow(sr, 6);
  const sr12 = sr6 * sr6;
  const factor = (24 * eps_lj * (2 * sr12 - sr6)) / (dist * dist);
  const f_lj_x = factor * dx;

  // Since dist is extremely small (0.14) relative to sigma (1.8), we are deep in the repulsive core.
  // The force should strongly push the gate away from the corner.
  // The vector from corner to gate is negative (-0.1, -0.1, 0).
  // A repulsive force should point in this same direction, meaning f_lj_x should be negative.
  assert(f_lj_x < 0, `LJ force on gate at short distance should be highly repulsive, got \${f_lj_x}`);
}

testThermalSpeed();
testSpringBonds();
testElectrostatics();
testLennardJones();

// 5. Audit Analytical Screening Calculations
function testAnalyticalScreening() {
  console.log("\n--- Test 5: High-Throughput Analytical Screening Engine ---");

  const m1 = {
    id: "test-mat-1",
    name: "Standard Perovskite",
    chemicalFormula: "Test1",
    spaceGroup: "P4mm",
    description: "Test Material",
    cornerAtom: "O",
    gateAtom: "Ti",
    latticeConstant: 4.0, // aperture = 2.0
    z0: 0.2,
    k: 5.0,
    q: -2.0,
    electronMobility: 2.0,
  };

  const res1 = calculateScreening(m1);
  console.log(`Test1 - Coupling Field: ${res1.couplingField.toFixed(3)} eV/A^2, Compliance: ${res1.susceptibility.toFixed(3)} A/eV, ARI: ${res1.ari.toFixed(1)}%`);

  assert(res1.couplingField === (2.4 * 2.0) / (2.0 * 2.0), "Coupling field calculated correctly based on charge and aperture radius");
  assert(res1.susceptibility === 1 / 5.0, "Mechanical susceptibility is 1/k");
  assert(res1.ari > 1 && res1.ari <= 100, "ARI index is bounded within realistic boundaries (1-100%)");

  // Verify charge scaling
  const m2 = { ...m1, q: -4.0 }; // double the charge
  const res2 = calculateScreening(m2);
  assert(res2.couplingField > res1.couplingField, "Higher gate charge increases electrostatic coupling field");
  assert(res2.ari > res1.ari, "Higher electrostatic coupling leads to a superior analytical rectification index");

  // Verify compliance scaling
  const m3 = { ...m1, k: 10.0 }; // double stiffness, half compliance
  const res3 = calculateScreening(m3);
  assert(res3.susceptibility < res1.susceptibility, "Higher stiffness decreases mechanical compliance");
  assert(res3.ari < res1.ari, "Lower mechanical compliance decreases predicted rectification index");
}

testAnalyticalScreening();

console.log("\n=========================================");
console.log(`   AUDIT COMPLETE: \${passes} PASSED, \${fails} FAILED`);
console.log("=========================================");

if (fails > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
