import React, { useState } from "react";
import { BookOpen, Terminal, Download, Globe, Code2, Layers, CheckCircle2 } from "lucide-react";
import { MaterialLattice, SimParams } from "../types";

interface FossGuideProps {
  selectedMaterial: MaterialLattice;
  params: SimParams;
}

export const FossGuide: React.FC<FossGuideProps> = ({ selectedMaterial, params }) => {
  const [activeTab, setActiveTab] = useState<"ase" | "vesta" | "lammps">("ase");

  const a = selectedMaterial.latticeConstant;
  const z0 = params.initialDisplacement;
  const k = params.springStiffness;
  const q = params.gateCharge;
  const corner = selectedMaterial.cornerAtom;
  const gate = selectedMaterial.gateAtom;
  const temp = params.temperature;
  const formula = selectedMaterial.chemicalFormula;

  const codeSnippets = {
    ase: `from ase import Atoms
from ase.visualize import view
from ase.calculators.lj import LennardJones

# Dynamic simulation parameters for ${formula}
a = ${a.toFixed(2)}   # Lattice constant in Angstroms
z0 = ${z0.toFixed(2)}  # Asymmetric gate displacement out of plane
k_spring = ${k.toFixed(1)} # Stiffness of flexible gate bonds in eV/A^2

# Setup the cubic unit cell with displaced center gate atom
coordinates = [
    [-a/2, -a/2, 0.0],  # Corner 1 (${corner})
    [ a/2, -a/2, 0.0],  # Corner 2 (${corner})
    [ a/2,  a/2, 0.0],  # Corner 3 (${corner})
    [-a/2,  a/2, 0.0],  # Corner 4 (${corner})
    [ 0.0,   0.0,  z0 ]   # Displaced Gate (${gate})
]

symbols = '${corner}${corner}${corner}${corner}${gate}'

# Create ASE Atoms object
lattice = Atoms(symbols=symbols, positions=coordinates)

# Attach a classical calculator for dynamic interaction calculations
lattice.calc = LennardJones(sigma=1.8, epsilon=0.05)

print(f"Lattice created for ${formula} with gate atom displaced by {z0} Angstroms.")
view(lattice)  # Launches interactive FOSS 3D viewer`,

    vesta: `# VESTA Crystal Structure file generated for ${formula}
# To model the Maxwell asymmetric gate in VESTA:
# 1. Create a new structure in VESTA: File -> New Structure
# 2. Under Unit Cell tab, choose Tetragonal (or Cubic with custom sites)
# 3. Space Group: ${selectedMaterial.spaceGroup} - supports polar asymmetric displacement
# 4. Parameters: a = ${a.toFixed(2)}, c = ${a.toFixed(2)} Angstroms
# 5. Add atomic coordinates:
#    - Corner Atom (${corner}): (0.5, 0.5, 0.0)
#    - Gate Atom (${gate}): (0.5, 0.5, 0.5 + ${(z0 / a).toFixed(3)})  <- Asymmetric fractional shift!
# 6. Under Boundary, set x=(0,2), y=(0,2), z=(0,2) to tile the lattices.
# 7. Enable structural bonds (Style -> Bonds) to visualize the flexible connections.`,

    lammps: `# LAMMPS Molecular Dynamics input script for ${formula} Simulation
units           metal
atom_style      charge
boundary        p p p

# Create simulation box and atom types based on ${formula}
lattice         sc ${a.toFixed(2)}
region          box block 0 5 0 5 -5 5
create_box      2 box
create_atoms    1 box  # Type 1: ${corner} (corner atoms)

# Define asymmetric gate site manually with z0 = ${z0.toFixed(2)} Angstroms
create_atoms    2 single 2.0 2.0 ${z0.toFixed(2)}  # Type 2: ${gate} Gate shifted along Z

# Charge definitions derived from ionization
set             type 1 charge -2.0
set             type 2 charge ${(-q).toFixed(1)}

# Flexible harmonic bond coefficients (k=${k.toFixed(1)}, rest=${(a * 0.707).toFixed(2)})
bond_style      harmonic
bond_coeff      1 ${k.toFixed(1)} ${(a * 0.707).toFixed(2)}

# Initialize thermal velocity (temperature T = ${temp} K)
velocity        all create ${temp}.0 827453 dist gaussian

# Run Molecular Dynamics under NVT thermostat to track electron paths
fix             1 all nvt temp ${temp}.0 ${temp}.0 100.0
timestep        0.001
run             100000`
  };

  const fossPackages = [
    {
      name: "ASE (Atomic Simulation Environment)",
      role: "Simulation Controller & Setup",
      description: "The leading Python library for setting up, manipulating, and coordinating molecular-scale simulations. It provides an elegant API to manage atomic coordinates, connect classical or DFT calculators, and seamlessly export/visualize structures.",
      url: "https://wiki.fysik.dtu.dk/ase/",
      tag: "Best for Scripting"
    },
    {
      name: "VESTA",
      role: "3D Crystal Visualizer",
      description: "A state-of-the-art open-source crystallography visualization suite. It renders crystal lattices, polyhedra, and volumetric electron density maps with exceptional aesthetic quality. Perfect for modeling displacements in non-centrosymmetric space groups.",
      url: "https://jp-minerals.org/vesta/en/",
      tag: "Best for Crystal Geometry"
    },
    {
      name: "Ovito (Open Visualization Tool)",
      role: "MD Post-Processor",
      description: "High-performance scientific visualization and analysis software for atomistic simulation data. Ideal for loading LAMMPS/GROMACS trajectories to render thermal electron drift, atom displacements, and analyzing elastic stress vectors.",
      url: "https://www.ovito.org/",
      tag: "Best for Trajectory Analysis"
    },
    {
      name: "LAMMPS / GROMACS",
      role: "Molecular Dynamics Engine",
      description: "Massively parallel open-source molecular dynamics simulators. They calculate classical Newton equations of motion for millions of atoms under harmonic springs, electrostatic charges, and thermostats to model actual thermal-gated currents.",
      url: "https://www.lammps.org/",
      tag: "Best for Physics Scale"
    }
  ];

  return (
    <div className="bg-[#0a0a0a] border border-[#222] rounded p-5 flex flex-col gap-5" id="foss-guide-section">
      <div className="flex items-center gap-2.5 border-b border-[#222] pb-4">
        <BookOpen className="w-5 h-5 text-[#3b82f6]" />
        <div>
          <h2 className="text-sm font-bold text-[#e0e0e0] uppercase tracking-wider font-mono">FOSS Packages & Scientific Guide</h2>
          <p className="text-xs text-[#666]">Recommended free and open-source tools for modeling and visualizing microscopic lattices</p>
        </div>
      </div>

      {/* Recommended FOSS Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {fossPackages.map((pkg, idx) => (
          <div key={idx} className="bg-[#050505]/40 border border-[#1a1a1a] p-4 rounded flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-medium text-sm text-[#ccc]">{pkg.name}</h3>
                <span className="text-[9px] font-bold text-[#3b82f6] bg-[#3b82f6]/10 px-2 py-0.5 rounded border border-[#3b82f6]/20">{pkg.tag}</span>
              </div>
              <span className="text-[10px] font-mono text-[#555] block mb-2 uppercase tracking-wider">{pkg.role}</span>
              <p className="text-xs text-[#888] leading-relaxed mb-4">{pkg.description}</p>
            </div>
            <a
              href={pkg.url}
              target="_blank"
              rel="noreferrer referrer"
              className="text-xs text-[#3b82f6] hover:text-[#2563eb] font-medium flex items-center gap-1 mt-auto w-fit"
            >
              <Globe className="w-3.5 h-3.5" />
              <span>Official Website</span>
            </a>
          </div>
        ))}
      </div>

      {/* Scripting Code Playground Tabs */}
      <div className="bg-[#050505] rounded border border-[#222] overflow-hidden">
        <div className="flex justify-between items-center bg-[#0a0a0a] border-b border-[#222] px-4 py-2.5">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-[#3b82f6]" />
            <span className="text-xs font-bold text-[#ccc] font-mono">Lattice Script Templates</span>
          </div>
          <div className="flex gap-1.5">
            <button
              onClick={() => setActiveTab("ase")}
              className={`px-3 py-1 rounded text-xs font-mono transition-colors ${
                activeTab === "ase" ? "bg-[#151515] text-[#3b82f6] border border-[#222] font-bold" : "text-[#555] hover:text-[#ccc]"
              }`}
            >
              ASE (Python)
            </button>
            <button
              onClick={() => setActiveTab("vesta")}
              className={`px-3 py-1 rounded text-xs font-mono transition-colors ${
                activeTab === "vesta" ? "bg-[#151515] text-[#3b82f6] border border-[#222] font-bold" : "text-[#555] hover:text-[#ccc]"
              }`}
            >
              VESTA Config
            </button>
            <button
              onClick={() => setActiveTab("lammps")}
              className={`px-3 py-1 rounded text-xs font-mono transition-colors ${
                activeTab === "lammps" ? "bg-[#151515] text-[#3b82f6] border border-[#222] font-bold" : "text-[#555] hover:text-[#ccc]"
              }`}
            >
              LAMMPS Script
            </button>
          </div>
        </div>

        <div className="p-4 bg-[#050505] font-mono text-xs overflow-x-auto text-[#3b82f6]/90 leading-relaxed max-h-[280px]">
          <pre>{codeSnippets[activeTab]}</pre>
        </div>

        <div className="bg-[#0a0a0a] border-t border-[#222] px-4 py-2 flex items-center justify-between text-[10px] text-[#555] font-mono uppercase tracking-widest">
          <span>{activeTab === "ase" ? "Python 3.8+ with ase package" : activeTab === "vesta" ? "VESTA Crystallography Suite format" : "LAMMPS metal-units script"}</span>
          <span className="flex items-center gap-1 text-[#3b82f6]/80">
            <CheckCircle2 className="w-3.5 h-3.5" /> Ready for export
          </span>
        </div>
      </div>
    </div>
  );
};
