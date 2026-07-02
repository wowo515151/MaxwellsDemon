import { useState } from "react";
import { MaterialLattice, SimParams, SimBackend } from "./types";
import { PhysicsSimulator } from "./components/PhysicsSimulator";
import { PhysicsAuditor } from "./components/PhysicsAuditor";
import { MaterialExplorer } from "./components/MaterialExplorer";
import { FossGuide } from "./components/FossGuide";
import { Sparkles, HelpCircle, Layers, ShieldAlert } from "lucide-react";

export default function App() {
  // Initial materials list starting with high-quality local compounds
  const [materialsList, setMaterialsList] = useState<MaterialLattice[]>([
    {
      id: "barium-titanate-cubic",
      name: "Barium Titanate (Displaced Ti)",
      chemicalFormula: "BaTiO3",
      spaceGroup: "P4mm",
      description: "A classic non-centrosymmetric perovskite where the central Titanium (Ti4+) is displaced relative to the Oxygen (O2-) octahedron faces. While Ti is normally positive, the surrounding oxygen planes create a localized electron-repelling gate profile when modeled in relative potential coordinates.",
      cornerAtom: "O",
      gateAtom: "Ti",
      latticeConstant: 4.01,
      z0: 0.15,
      k: 8.5,
      q: -2.0,
      electronMobility: 1.0,
    },
    {
      id: "lead-titanate-ferroelectric",
      name: "Lead Titanate Polar Lattice",
      chemicalFormula: "PbTiO3",
      spaceGroup: "P4mm",
      description: "Features a larger spontaneous polarization than BaTiO3. The Ti central atom exhibits a major displacement of ~0.30 Angstroms out of the oxygen face plane, creating a highly stable asymmetric electrostatic gate.",
      cornerAtom: "O",
      gateAtom: "Ti",
      latticeConstant: 3.90,
      z0: 0.30,
      k: 6.2,
      q: -2.5,
      electronMobility: 5.0,
    },
    {
      id: "sodium-niobate-perovskite",
      name: "Sodium Niobate Asymmetric Cage",
      chemicalFormula: "NaNbO3",
      spaceGroup: "Pbma",
      description: "Sodium Niobate exhibits complex antiferroelectric distortions. The Niobium (Nb) atom acts as a mobile gate sitting within a highly flexible octahedron of Oxygen corner atoms, allowing significant thermal displacement.",
      cornerAtom: "O",
      gateAtom: "Nb",
      latticeConstant: 3.94,
      z0: 0.22,
      k: 4.5,
      q: -3.0,
      electronMobility: 12.0,
    },
    {
      id: "potassium-tantalate-soft-mode",
      name: "Potassium Tantalate (Soft Phonon)",
      chemicalFormula: "KTaO3",
      spaceGroup: "Pm-3m",
      description: "An incipient ferroelectric with an exceptionally compliant 'soft' transverse optical phonon mode. The Tantalum (Ta5+) gate is highly responsive to thermal fields and exhibits very high low-temperature mobility.",
      cornerAtom: "O",
      gateAtom: "Ta",
      latticeConstant: 3.99,
      z0: 0.18,
      k: 3.2,
      q: -3.2,
      electronMobility: 30.0,
    },
    {
      id: "strontium-titanate-paraelectric",
      name: "Strontium Titanate (High-Mobility)",
      chemicalFormula: "SrTiO3",
      spaceGroup: "Pm-3m",
      description: "A quantum paraelectric material known for hosting highly mobile two-dimensional electron gases. The Ti gate is extremely compliant, yielding a soft electrostatic confinement channel with ultra-high carrier mobility.",
      cornerAtom: "O",
      gateAtom: "Ti",
      latticeConstant: 3.905,
      z0: 0.08,
      k: 2.4,
      q: -2.0,
      electronMobility: 150.0,
    },
    {
      id: "bismuth-ferrite-multiferroic",
      name: "Bismuth Ferrite Polar Perovskite",
      chemicalFormula: "BiFeO3",
      spaceGroup: "R3c",
      description: "A famous multiferroic demonstrating simultaneous ferroelectricity and antiferromagnetism. Features a massive spontaneous displacement of the central Iron (Fe3+) gate with high electrostatic repulsion.",
      cornerAtom: "O",
      gateAtom: "Fe",
      latticeConstant: 3.96,
      z0: 0.35,
      k: 9.5,
      q: -1.8,
      electronMobility: 0.1,
    },
    {
      id: "potassium-niobate",
      name: "Potassium Niobate Ferroelectric",
      chemicalFormula: "KNbO3",
      spaceGroup: "Amm2",
      description: "Exhibits a sequence of ferroelectric phase transitions similar to BaTiO3 but with a Nb5+ B-site cation. Offers strong ionic polarization and moderate carrier mobility.",
      cornerAtom: "O",
      gateAtom: "Nb",
      latticeConstant: 4.01,
      z0: 0.25,
      k: 5.8,
      q: -2.8,
      electronMobility: 8.0,
    },
    {
      id: "calcium-titanate-ortho",
      name: "Calcium Titanate (Tilted Octahedra)",
      chemicalFormula: "CaTiO3",
      spaceGroup: "Pbnm",
      description: "The prototype perovskite mineral. It exhibits tilting of the oxygen octahedra cage that introduces small local symmetry breaking and moderate gate stiffness.",
      cornerAtom: "O",
      gateAtom: "Ti",
      latticeConstant: 3.82,
      z0: 0.12,
      k: 7.8,
      q: -2.1,
      electronMobility: 2.5,
    },
    {
      id: "barium-zirconate-conducting",
      name: "Barium Zirconate Rigid Cage",
      chemicalFormula: "BaZrO3",
      spaceGroup: "Pm-3m",
      description: "A proton-conducting ceramic with a larger, more stable and rigid lattice structure. The Zirconium (Zr4+) gate has high stiffness, leading to low compliance but excellent thermal stability.",
      cornerAtom: "O",
      gateAtom: "Zr",
      latticeConstant: 4.19,
      z0: 0.05,
      k: 11.2,
      q: -2.2,
      electronMobility: 1.5,
    },
    {
      id: "lead-zirconate-antiferro",
      name: "Lead Zirconate Antiferroelectric",
      chemicalFormula: "PbZrO3",
      spaceGroup: "Pbam",
      description: "The classic antiferroelectric material, showcasing complex anti-parallel displacements of Zr ions. Excellent candidate for energy storage and high-frequency polarization switches.",
      cornerAtom: "O",
      gateAtom: "Zr",
      latticeConstant: 4.15,
      z0: 0.28,
      k: 5.5,
      q: -2.4,
      electronMobility: 4.0,
    },
    {
      id: "lithium-niobate-dense",
      name: "Lithium Niobate High-Asymmetry",
      chemicalFormula: "LiNbO3",
      spaceGroup: "R3c",
      description: "While trigonal in bulk, its pseudo-cubic sub-unit contains an extremely displaced Nb5+ ion out of the oxygen face, yielding one of the most highly asymmetric electrostatic diode geometries.",
      cornerAtom: "O",
      gateAtom: "Nb",
      latticeConstant: 3.76,
      z0: 0.40,
      k: 12.0,
      q: -3.1,
      electronMobility: 0.05,
    },
    {
      id: "cesium-lead-iodide-halide",
      name: "Cesium Lead Iodide (Halide Perovskite)",
      chemicalFormula: "CsPbI3",
      spaceGroup: "Pm-3m",
      description: "An inorganic halide perovskite possessing highly compliant Pb-I soft bonds. The large iodide (I-) corner atoms create a wide, highly mobile gate channel with outstanding electron transport parameters.",
      cornerAtom: "I",
      gateAtom: "Pb",
      latticeConstant: 6.18,
      z0: 0.25,
      k: 1.8,
      q: -1.5,
      electronMobility: 45.0,
    },
    {
      id: "mapbi3-hybrid-halide",
      name: "Methylammonium Lead Iodide",
      chemicalFormula: "MAPbI3",
      spaceGroup: "I4/mcm",
      description: "A famous hybrid organic-inorganic solar cell absorber. The dynamic rotations of the organic methylammonium cation produce highly fluctuating, ultra-soft polar fields with a highly compliant Lead (Pb2+) gate.",
      cornerAtom: "I",
      gateAtom: "Pb",
      latticeConstant: 6.26,
      z0: 0.38,
      k: 1.1,
      q: -1.2,
      electronMobility: 65.0,
    },
    {
      id: "sodium-niob-tantalate",
      name: "Ta-Doped Sodium Niobate Mix",
      chemicalFormula: "NaNb0.9Ta0.1O3",
      spaceGroup: "Pbma",
      description: "A solid solution material where partial substitution of Nb with Ta optimizes both the dielectric permittivity and polar gating compliance, resulting in a balanced high-speed molecular rectifier.",
      cornerAtom: "O",
      gateAtom: "Nb/Ta",
      latticeConstant: 3.95,
      z0: 0.23,
      k: 4.1,
      q: -3.0,
      electronMobility: 14.0,
    },
    {
      id: "silver-niobate-polar",
      name: "Silver Niobate Polar Perovskite",
      chemicalFormula: "AgNbO3",
      spaceGroup: "Pmc21",
      description: "Exhibits robust ferrielectricity and large polarization. The Silver (Ag+) and Niobium (Nb5+) mutual displacement produces a complex potential landscape with high electrostatic response.",
      cornerAtom: "O",
      gateAtom: "Nb",
      latticeConstant: 3.94,
      z0: 0.27,
      k: 5.0,
      q: -2.9,
      electronMobility: 2.0,
    },
    {
      id: "bismuth-manganite-magneto",
      name: "Bismuth Manganite Ferromagnetic",
      chemicalFormula: "BiMnO3",
      spaceGroup: "C2/c",
      description: "A heavily distorted ferromagnetic perovskite showing strong orbital ordering. The Manganese (Mn) gate sits in an asymmetric, highly compressed Oxygen octahedron.",
      cornerAtom: "O",
      gateAtom: "Mn",
      latticeConstant: 3.93,
      z0: 0.19,
      k: 8.0,
      q: -1.9,
      electronMobility: 0.5,
    },
    {
      id: "europium-titanate-magnetic",
      name: "Europium Titanate Quantum State",
      chemicalFormula: "EuTiO3",
      spaceGroup: "Pm-3m",
      description: "Features a strong spin-lattice coupling where the dielectric constant and Ti gate compliance can be tuned dynamically via external magnetic fields.",
      cornerAtom: "O",
      gateAtom: "Ti",
      latticeConstant: 3.90,
      z0: 0.06,
      k: 6.8,
      q: -2.0,
      electronMobility: 10.0,
    },
    {
      id: "lanthanum-aluminate-rigid",
      name: "Lanthanum Aluminate Insulator",
      chemicalFormula: "LaAlO3",
      spaceGroup: "R-3c",
      description: "A highly stable, wide-bandgap insulator with extremely rigid Al-O bonds. The Aluminium (Al3+) gate shows negligible displacement, serving as an excellent benchmark for low-compliance symmetric states.",
      cornerAtom: "O",
      gateAtom: "Al",
      latticeConstant: 3.79,
      z0: 0.04,
      k: 14.5,
      q: -1.6,
      electronMobility: 12.0,
    }
  ]);

  const [selectedMaterial, setSelectedMaterial] = useState<MaterialLattice>(materialsList[0]);

  // Simulation parameter controls
  const [params, setParams] = useState<SimParams>({
    temperature: 300, // Kelvin
    springStiffness: selectedMaterial.k,
    gateCharge: Math.abs(selectedMaterial.q),
    initialDisplacement: selectedMaterial.z0,
    electronSpeedMultiplier: 1.0,
    flowRate: 2.0, // e/s
    isRunning: true,
    showForces: true,
    showAperture: true,
    gateMass: 47.8, // Ti atom mass in AMU
    activeBackend: SimBackend.LOCAL_JS,
    singleElectronRegime: true,
  });

  return (
    <div className="min-h-screen bg-[#050505] text-[#e0e0e0] selection:bg-[#3b82f6]/20 selection:text-white">
      
      {/* Main Container */}
      <div className="max-w-7xl mx-auto px-6 py-8 flex flex-col gap-8 relative z-10">
        
        {/* Top Header branding section */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#222] pb-6 bg-[#050505]">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <span className="bg-[#3b82f6] text-white font-mono text-[9px] font-bold px-2 py-0.5 rounded tracking-widest uppercase">
                MAXWELL DYNAMICS
              </span>
              <span className="text-[#333] text-xs">//</span>
              <span className="text-[#666] font-mono text-[9px] tracking-widest uppercase">Lattice Modeler</span>
            </div>
            <h1 className="text-xl md:text-2xl font-medium tracking-tight uppercase text-white">
              Maxwell's Heat-to-Electricity Simulator
            </h1>
            <p className="text-xs text-[#888] leading-normal max-w-2xl font-sans">
              Explore James Clerk Maxwell's theoretical molecular thermal gate.
              Model asymmetric electrostatic forces, spring-stiffness, and investigate candidate FOSS tools for crystallographic engineering.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="bg-[#0a0a0a] border border-[#222] rounded px-4 py-2 flex flex-col items-end">
              <span className="text-[9px] text-[#555] uppercase tracking-widest font-mono">Engine Status</span>
              <span className="text-xs font-semibold text-[#3b82f6] flex items-center gap-1.5 font-mono tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                STABLE
              </span>
            </div>
          </div>
        </header>

        {/* Theoretical Introduction Hero panel */}
        <section className="bg-[#0a0a0a] border border-[#222] rounded-lg p-5" id="thermodynamics-introduction">
          <div className="flex items-start gap-4">
            <div className="bg-[#1a1a1a] p-3 rounded border border-[#222] shrink-0 hidden sm:block">
              <Sparkles className="w-4 h-4 text-[#3b82f6]" />
            </div>
            <div className="flex flex-col gap-2">
              <h2 className="text-xs font-bold text-[#e0e0e0] uppercase tracking-wider font-mono">
                The Physics Concept: Maxwell vs. The Second Law of Thermodynamics
              </h2>
              <p className="text-xs text-[#888] leading-relaxed">
                Under standard thermodynamics, direct ambient heat-to-electricity is barred by entropy rules. However, 
                James Clerk Maxwell hypothesized a microscopic gating structure where natural thermal movements could produce a directional vector.
              </p>
              <p className="text-xs text-[#666] leading-relaxed">
                Consider a <strong>cubic crystal lattice</strong>: four corner atoms arranged as a flat square plane, with a mobile negative gate atom situated slightly out-of-plane.
                Electrons traveling from one direction push the gate atom <em>into</em> the plane, compressing the pore size and closing the aperture.
                Electrons arriving from the opposite direction push the gate atom <em>further away</em>, clearing the passage and allowing transit.
                This asymmetric mechanical barrier acts as a molecular thermal diode, producing a steady electrical vector powered purely by ambient temperature kinetic energy.
              </p>
            </div>
          </div>
        </section>

        {/* Main interactive grid section */}
        <main className="grid grid-cols-1 gap-8" id="primary-app-workspace">
          
          {/* 1. Real-time visual physics engine */}
          <section aria-labelledby="live-sim-title">
            <PhysicsSimulator
              params={params}
              setParams={setParams}
              selectedMaterial={selectedMaterial}
              materialsList={materialsList}
              setSelectedMaterial={setSelectedMaterial}
            />
          </section>

          {/* 2. Candidate database & AI material selector */}
          <section aria-labelledby="lattice-db-title">
            <MaterialExplorer
              selectedMaterial={selectedMaterial}
              setSelectedMaterial={setSelectedMaterial}
              materialsList={materialsList}
              setMaterialsList={setMaterialsList}
            />
          </section>

          {/* 3. FOSS Packages and scripting guide */}
          <section aria-labelledby="foss-guide-title">
            <FossGuide selectedMaterial={selectedMaterial} params={params} />
          </section>

          {/* 4. Physics Auditor and Derivations Dashboard */}
          <section aria-labelledby="physics-auditor-title">
            <PhysicsAuditor selectedMaterial={selectedMaterial} params={params} />
          </section>

        </main>

        {/* Footer info brand */}
        <footer className="border-t border-slate-800/80 pt-6 mt-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-[10px] text-slate-500 font-mono">
          <span>Maxwell Thermal Diode Simulator — Designed for AI Studio Build</span>
          <div className="flex gap-4">
            <a href="https://wiki.fysik.dtu.dk/ase/" target="_blank" rel="noreferrer referrer" className="hover:text-slate-400 transition-colors">ASE Wiki</a>
            <a href="https://jp-minerals.org/vesta/en/" target="_blank" rel="noreferrer referrer" className="hover:text-slate-400 transition-colors">VESTA Documentation</a>
            <a href="https://www.lammps.org/" target="_blank" rel="noreferrer referrer" className="hover:text-slate-400 transition-colors">LAMMPS Docs</a>
          </div>
        </footer>

      </div>
    </div>
  );
}
