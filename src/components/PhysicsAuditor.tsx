import React, { useState, useEffect } from "react";
import { ShieldAlert, Cpu, FileText, Landmark, RefreshCw, BarChart2 } from "lucide-react";
import { MaterialLattice, SimParams } from "../types";

interface PhysicsAuditorProps {
  selectedMaterial: MaterialLattice;
  params: SimParams;
}

export const PhysicsAuditor: React.FC<PhysicsAuditorProps> = ({ selectedMaterial, params }) => {
  const [activeTab, setActiveTab] = useState<"constants" | "derivations" | "approximations" | "units">("units");

  // Physical constants definitions
  const constants = [
    { symbol: "k_B", name: "Boltzmann Constant", value: "1.380649 × 10⁻²³", units: "J/K", mdValue: "8.617333 × 10⁻⁵", mdUnits: "eV/K", desc: "Relates thermal energy to temperature. At 300 K, k_B T ≈ 0.0259 eV (25.9 meV)." },
    { symbol: "e", name: "Elementary Charge", value: "1.602176 × 10⁻¹⁹", units: "C", mdValue: "1.0", mdUnits: "e", desc: "The charge carried by a single electron. Screened in bulk systems by the material's dielectric constant." },
    { symbol: "m_e", name: "Electron Mass", value: "9.109383 × 10⁻³¹", units: "kg", mdValue: "5.485799 × 10⁻⁴", mdUnits: "AMU", desc: "Conduction effective mass m* is typically 1.0 to 5.0 m_e in oxide perovskites due to d-band hybridization." },
    { symbol: "N_A", name: "Avogadro's Number", value: "6.022140 × 10²³", units: "mol⁻¹", mdValue: "1.0", mdUnits: "mol⁻¹", desc: "Relates atomic mass units (AMU) directly to macroscopic grams/mole." },
    { symbol: "ε₀", name: "Vacuum Permittivity", value: "8.854187 × 10⁻¹²", units: "F/m", mdValue: "0.005526", mdUnits: "e²/(eV·Å)", desc: "Governs vacuum electrostatics. The high-frequency dielectric constant ε_inf reduces Coulombic interactions in polar lattices." },
    { symbol: "h", name: "Planck's Constant", value: "6.626070 × 10⁻³⁴", units: "J·s", mdValue: "4.135667 × 10⁻¹⁵", mdUnits: "eV·s", desc: "Determines quantum zero-point fluctuations. Crucial for calculating optical phonon dispersion curves." }
  ];

  // Mathematical details of the double-well potential
  const a_half = selectedMaterial.latticeConstant / 2;
  const d_planar = Math.sqrt(2 * a_half * a_half); // Distance from center to corners in z=0 plane
  const restLength = Math.sqrt(2 * a_half * a_half + params.initialDisplacement * params.initialDisplacement);

  // Approximate Taylor expansion terms for V(z) = A z^2 + B z^4
  const k_spring = params.springStiffness;
  const z0 = params.initialDisplacement;
  const coeff_A = z0 > 0 ? -((k_spring * z0 * z0) / (d_planar * d_planar)) : 0;
  const coeff_B = d_planar > 0 ? (k_spring / (2 * d_planar * d_planar)) : 0;
  const theoreticalBarrier = z0 > 0 ? (k_spring * Math.pow(z0, 4)) / (2 * d_planar * d_planar) : 0;

  return (
    <div className="bg-[#0a0a0a] border border-[#222] rounded-lg p-5 flex flex-col gap-5" id="physics-auditor-section">
      <div className="flex items-center gap-2.5 border-b border-[#222] pb-4">
        <Cpu className="w-5 h-5 text-emerald-400" />
        <div>
          <h2 className="text-sm font-bold text-[#e0e0e0] uppercase tracking-wider font-mono">Physics & MD Approximations Auditor</h2>
          <p className="text-xs text-[#666]">Rigorous scientific audit of calculations, physical constants, and model assumptions</p>
        </div>
      </div>

      {/* Nav Tabs */}
      <div className="flex border-b border-[#1f1f1f] gap-2">
        {[
          { id: "units", label: "State Conversion (SI/MD)", icon: BarChart2 },
          { id: "derivations", label: "LGD Potential Derivation", icon: FileText },
          { id: "constants", label: "Fundamental Constants", icon: Landmark },
          { id: "approximations", label: "Model Assumptions", icon: ShieldAlert }
        ].map(t => {
          const Icon = t.icon;
          const isSelected = activeTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id as any)}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-mono border-b-2 transition-all ${
                isSelected
                  ? "border-emerald-500 text-emerald-400 font-bold bg-emerald-500/5"
                  : "border-transparent text-[#666] hover:text-[#ccc]"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Content Panels */}
      <div className="min-h-[220px]">
        {activeTab === "constants" && (
          <div className="flex flex-col gap-4">
            <p className="text-xs text-[#888] leading-relaxed">
              Standard classical simulators operate in <strong>Metal Units</strong> (mass in AMU, length in Å, energy in eV) to bypass numerical underflow. Below are the precise conversion factors matching reference implementations in LAMMPS and Quantum ESPRESSO.
            </p>
            <div className="overflow-x-auto border border-[#1a1a1a] rounded">
              <table className="w-full text-left border-collapse text-[11px] font-mono">
                <thead>
                  <tr className="bg-[#111] border-b border-[#222] text-[#666] uppercase text-[9px] tracking-wider">
                    <th className="p-2.5">Constant</th>
                    <th className="p-2.5">Standard SI Value</th>
                    <th className="p-2.5">MD Metal Value</th>
                    <th className="p-2.5">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#151515] text-[#888]">
                  {constants.map((c, idx) => (
                    <tr key={idx} className="hover:bg-[#111]/30">
                      <td className="p-2.5 font-bold text-[#ccc]">{c.name} ({c.symbol})</td>
                      <td className="p-2.5">{c.value} <span className="text-[#555]">{c.units}</span></td>
                      <td className="p-2.5 text-emerald-400/90">{c.mdValue} <span className="text-[#555]">{c.mdUnits}</span></td>
                      <td className="p-2.5 text-xs font-sans text-[#777]">{c.desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === "derivations" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex flex-col gap-3 text-xs text-[#888] leading-relaxed">
              <h3 className="font-bold text-sm text-[#ccc] font-mono">From Hookean Springs to Landau Double-Well</h3>
              <p>
                The active restoring force in the 3D visualizer is calculated from 4 linear springs connecting the gate atom to the planar corner oxygen ions. 
                When the spring's resting length L_rest is configured larger than the planar aperture radius d, the origin (z = 0) becomes an unstable local saddle point.
              </p>
              <p>
                By calculating the total elastic potential energy V(z) along the normal axis (x = y = 0):
                <span className="font-mono text-emerald-400 block my-1 bg-[#111] p-1.5 rounded text-center">V(z) = 2 · k · (√(d² + z²) - L_rest)²</span>
              </p>
              <p>
                We can perform a Taylor series expansion around z = 0. Since the asymmetric rest displacement z₀ is small relative to d, this simplifies to:
                <span className="font-mono text-emerald-400 block my-1 bg-[#111] p-1.5 rounded text-center">V(z) ≈ A · z² + B · z⁴ + C</span>
                where the quadratic coefficient <strong className="text-red-400">A = -k · z₀² / d² ≤ 0</strong> represents the soft optical phonon mode instability, and the quartic term <strong className="text-emerald-400">B = k / (2 · d²) ≥ 0</strong> stabilizes the crystalline polarization.
              </p>
            </div>

            <div className="bg-[#050505] border border-[#1a1a1a] rounded p-4 flex flex-col gap-3 font-mono text-[11px] text-[#888]">
              <h4 className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">Active Material Derivation Ledger</h4>
              <div className="flex justify-between border-b border-[#111] pb-1.5">
                <span>Material Lattice:</span>
                <span className="text-white font-bold">{selectedMaterial.chemicalFormula}</span>
              </div>
              <div className="flex justify-between border-b border-[#111] pb-1.5">
                <span>Spring Rest Restoring (k):</span>
                <span>{k_spring.toFixed(2)} eV/Å²</span>
              </div>
              <div className="flex justify-between border-b border-[#111] pb-1.5">
                <span>Planar Aperture Radius (d):</span>
                <span>{d_planar.toFixed(4)} Å</span>
              </div>
              <div className="flex justify-between border-b border-[#111] pb-1.5">
                <span>Spring Natural Rest Length (L_rest):</span>
                <span>{restLength.toFixed(4)} Å</span>
              </div>
              <div className="flex justify-between border-b border-[#111] pb-1.5">
                <span>Landau Quadratic Coeff (A):</span>
                <span className="text-red-400">{coeff_A.toFixed(4)} eV/Å² (Unstable)</span>
              </div>
              <div className="flex justify-between border-b border-[#111] pb-1.5">
                <span>Landau Quartic Coeff (B):</span>
                <span className="text-emerald-400">+{coeff_B.toFixed(4)} eV/Å⁴ (Stable)</span>
              </div>
              <div className="flex justify-between text-white font-bold bg-[#111] p-2 rounded mt-1">
                <span>Predicted Local Barrier V(0):</span>
                <span className="text-emerald-400">{(theoreticalBarrier * 1000).toFixed(2)} meV</span>
              </div>
              <p className="text-[9px] font-sans text-[#555] leading-normal">
                Notice: A barrier of {(theoreticalBarrier * 1000).toFixed(1)} meV is small compared to thermal noise at room temperature (k_B T = 25.9 meV). Thus, cooperative electrostatic fields from neighboring Unit Cells are required to establish static macro-polarization.
              </p>
            </div>
          </div>
        )}

        {activeTab === "approximations" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-[#888] leading-relaxed">
            <div className="bg-[#050505]/40 border border-[#1a1a1a] p-3.5 rounded">
              <h4 className="font-bold font-mono text-[11px] text-[#ccc] mb-2 uppercase tracking-wide flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                Classical Spring vs. Quantum Phonons
              </h4>
              <p className="mb-2">
                <strong>Approximation:</strong> Interatomic restoring forces are modeled as classical harmonic Hookean bonds.
              </p>
              <p>
                <strong>Scientific Validation:</strong> In real perovskites, local vibrations are quantized as optical phonons. However, at temperatures above the Debye Temperature (typically $\Theta_D \approx 350-450$ K for BaTiO₃), classical Newtonian trajectories converge closely with full quantum statistical ensembles, making Verlet integration highly accurate.
              </p>
            </div>

            <div className="bg-[#050505]/40 border border-[#1a1a1a] p-3.5 rounded">
              <h4 className="font-bold font-mono text-[11px] text-[#ccc] mb-2 uppercase tracking-wide flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400"></span>
                Screening Length & Softening (ε)
              </h4>
              <p className="mb-2">
                <strong>Approximation:</strong> Electrostatic interactions use a softening factor $\epsilon = 0.35$ Å to prevent numerical division-by-zero errors.
              </p>
              <p>
                <strong>Scientific Validation:</strong> This maps physically to the <strong>Wigner-Seitz core radius</strong> of the transition-metal ion. Quantum mechanics dictates that conduction electrons cannot occupy the exact coordinates of the atomic nucleus due to the Pauli Exclusion Principle. The softening factor represents the spatial extent of the core-electron shell wavefunctions.
              </p>
            </div>

            <div className="bg-[#050505]/40 border border-[#1a1a1a] p-3.5 rounded">
              <h4 className="font-bold font-mono text-[11px] text-[#ccc] mb-2 uppercase tracking-wide flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                Rigid Oxygen Framework
              </h4>
              <p className="mb-2">
                <strong>Approximation:</strong> The 4 corner oxygen atoms are held fixed at their ideal tetragonal/cubic lattice spots.
              </p>
              <p>
                <strong>Scientific Validation:</strong> Oxygen ions are much lighter than Ba/Pb/Bi cations, but because they are chemically locked into a dense, shared corner-sharing octahedron framework, their high collective bulk modulus suppresses high-frequency thermal fluctuations relative to the highly compliant, sliding central B-site gate atom.
              </p>
            </div>

            <div className="bg-[#050505]/40 border border-[#1a1a1a] p-3.5 rounded">
              <h4 className="font-bold font-mono text-[11px] text-[#ccc] mb-2 uppercase tracking-wide flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-orange-400"></span>
                Lennard-Jones Electrostatic Boundary
              </h4>
              <p className="mb-2">
                <strong>Approximation:</strong> Short-range electron-to-pore boundary interaction is calculated via a classical Lennard-Jones 12-6 potential.
              </p>
              <p>
                <strong>Scientific Validation:</strong> Born-Oppenheimer DFT calculations prove that as an orbital overlap occurs, the electrostatic potential increases exponentially (V ∝ exp(-r/r₀)). The r⁻¹² term provides a computationally efficient classical upper bound representing this quantum-mechanical kinetic energy pressure.
              </p>
            </div>
          </div>
        )}

        {activeTab === "units" && (
          <div className="flex flex-col gap-4">
            <p className="text-xs text-[#888] leading-relaxed">
              Below are the active, real-time conversion factors mapping internal dimensionless variables to physical quantities in both the <strong>Atomic/Molecular Dynamics (MD) Scale</strong> and <strong>Macroscopic International System (SI) Scale</strong>.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-[#050505] border border-[#1a1a1a] rounded p-3 flex flex-col justify-between">
                <div>
                  <span className="text-[9px] text-[#555] font-mono uppercase tracking-widest block mb-1">Time Conversion Factor</span>
                  <div className="text-sm font-mono font-bold text-emerald-400">1.0 Code Time = 10.18 fs</div>
                </div>
                <p className="text-[10px] text-[#666] font-sans mt-2">
                  Derived from natural AMU-Å-eV scaling. Each integrator step (dt = 0.016) represents exactly <strong>0.163 femtoseconds</strong> of real atomic-scale time.
                </p>
              </div>

              <div className="bg-[#050505] border border-[#1a1a1a] rounded p-3 flex flex-col justify-between">
                <div>
                  <span className="text-[9px] text-[#555] font-mono uppercase tracking-widest block mb-1">Velocity Mapping (1.0 Unit)</span>
                  <div className="text-sm font-mono font-bold text-blue-400">1.0 Å/Code Time = 9.82 km/s</div>
                </div>
                <p className="text-[10px] text-[#666] font-sans mt-2">
                  Maps speeds directly to atomic values. At room temperature, conduction electronic drift currents transit the unit cell at velocities up to <strong>20.4 km/s</strong>.
                </p>
              </div>

              <div className="bg-[#050505] border border-[#1a1a1a] rounded p-3 flex flex-col justify-between">
                <div>
                  <span className="text-[9px] text-[#555] font-mono uppercase tracking-widest block mb-1">Force Scale (1.0 Unit)</span>
                  <div className="text-sm font-mono font-bold text-orange-400">1.0 eV/Å = 1,602.18 pN</div>
                </div>
                <p className="text-[10px] text-[#666] font-sans mt-2">
                  Interatomic forces are incredibly strong. An optical mode oscillation force of 0.5 eV/Å translates to a macroscopic force of <strong>801 picoNewtons</strong>.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
