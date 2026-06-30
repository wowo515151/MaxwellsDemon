import React, { useState, useMemo } from "react";
import { MaterialLattice } from "../types";
import {
  Search,
  Compass,
  Cpu,
  HelpCircle,
  AlertCircle,
  RefreshCw,
  Zap,
  Sliders,
  Table,
  Award,
  Activity,
  Trash2,
  TrendingUp,
  FlaskConical,
  Check
} from "lucide-react";

interface MaterialExplorerProps {
  selectedMaterial: MaterialLattice;
  setSelectedMaterial: (m: MaterialLattice) => void;
  materialsList: MaterialLattice[];
  setMaterialsList: React.Dispatch<React.SetStateAction<MaterialLattice[]>>;
}

export interface ScreeningStats {
  couplingField: number; // in eV/Å^2 equivalent
  susceptibility: number; // in Å/eV (1/k)
  potentialAsymmetry: number; // eV/Å
  asymmetricFactor: number; // dimensionless
  ari: number; // Approximated Rectification Index (1-100)
}

// Analytical screening helper function
export function calculateScreening(m: MaterialLattice): ScreeningStats {
  const apertureHalf = m.latticeConstant / 2;
  // C_electrostatic coupling is 2.4 in the simulator
  const couplingField = (2.4 * Math.abs(m.q)) / (apertureHalf * apertureHalf);
  const susceptibility = m.k > 0 ? 1 / m.k : 0.1;
  const potentialAsymmetry = Math.abs(m.z0) * couplingField;
  
  // The product of initial displacement, compliance (susceptibility), and electrostatic coupling
  // represents the thermal gating flexibility.
  const asymmetricFactor = potentialAsymmetry * susceptibility;
  
  // Hill-equation type saturation curve for static rectification
  const staticFactor = asymmetricFactor / (0.35 + asymmetricFactor);
  
  // Carrier mobility contribution (logarithmic boost to model conductivity saturation)
  const mobilityBoost = 1.0 + 0.12 * Math.log(1 + Math.abs(m.electronMobility));
  
  const rawAri = staticFactor * 100 * mobilityBoost;
  const ari = Math.min(100, Math.max(1, rawAri));
  
  return {
    couplingField,
    susceptibility,
    potentialAsymmetry,
    asymmetricFactor,
    ari
  };
}

// Procedural materials synthesis generator for fully client-side static offline usage
export function generateProceduralMaterial(query: string): MaterialLattice | null {
  const clean = query.trim().replace(/\s+/g, "");
  if (!clean) return null;

  // Try to parse basic perovskite ABO3 or ABX3 format (e.g. BaTiO3, CsPbI3, MAPbI3, BaZrO3)
  const perovskiteRegex = /^([A-Z][a-z]?)([A-Z][a-z]?)(O3|I3|Br3|Cl3)$/i;
  const match = clean.match(perovskiteRegex);

  let chemicalFormula = clean;
  let name = "";
  let spaceGroup = "Pm-3m";
  let cornerAtom = "O";
  let gateAtom = "Ti";
  let latticeConstant = 4.0;
  let z0 = 0.15;
  let k = 6.0;
  let q = -2.0;
  let electronMobility = 10.0;
  let description = "";

  if (match) {
    const elementA = match[1];
    const elementB = match[2];
    const elementX = match[3];

    chemicalFormula = `${elementA}${elementB}${elementX}`;
    cornerAtom = elementX.replace("3", "");
    gateAtom = elementB;

    // Is it a halide perovskite?
    const isHalide = ["I3", "Br3", "Cl3"].includes(elementX);

    if (isHalide) {
      latticeConstant = elementX.startsWith("I") ? 6.2 : elementX.startsWith("Br") ? 5.9 : 5.6;
      k = parseFloat((1.2 + Math.random() * 1.6).toFixed(2));
      q = parseFloat((-1.0 - Math.random() * 0.8).toFixed(2));
      electronMobility = parseFloat((35.0 + Math.random() * 85.0).toFixed(1));
      spaceGroup = Math.random() > 0.5 ? "I4/mcm" : "Pm-3m";
      z0 = spaceGroup === "I4/mcm" ? parseFloat((0.22 + Math.random() * 0.16).toFixed(3)) : parseFloat((0.04 + Math.random() * 0.05).toFixed(3));
      name = `${elementA}${elementB}${elementX} Halide Perovskite`;
    } else {
      // Oxide perovskite (ABO3)
      latticeConstant = parseFloat((3.85 + Math.random() * 0.35).toFixed(3));
      k = parseFloat((3.5 + Math.random() * 7.5).toFixed(2));
      q = parseFloat((-1.6 - Math.random() * 1.6).toFixed(2));
      electronMobility = parseFloat((1.0 + Math.random() * 20.0).toFixed(1));

      const polarElements = ["Ti", "Nb", "Ta", "Fe", "Mn", "Zr"];
      const isPolarB = polarElements.includes(elementB);

      if (isPolarB) {
        spaceGroup = Math.random() > 0.5 ? "P4mm" : "R3c";
        z0 = parseFloat((0.15 + Math.random() * 0.22).toFixed(3));
        name = `${elementA}${elementB}O₃ Polar Crystal`;
      } else {
        spaceGroup = "Pm-3m";
        z0 = parseFloat((0.03 + Math.random() * 0.05).toFixed(3));
        name = `${elementA}${elementB}O₃ Symmetric Perovskite`;
      }
    }

    description = `In-browser synthesized ${name} (${chemicalFormula}) crystalline structure in space group ${spaceGroup}. ` +
      `Features a core ${gateAtom} gate atom nestled within a square plane of ${cornerAtom} corner atoms. ` +
      `With an out-of-plane displacement z₀ of ${z0} Å, stiffness k of ${k} eV/Å², and gate charge q of ${q}e, ` +
      `this structure provides a custom electrostatic gating mechanism.`;
  } else {
    // Non-standard query fallback synthesis
    const titleCased = query.charAt(0).toUpperCase() + query.slice(1);
    chemicalFormula = clean.substring(0, 8);
    if (!/[0-9]/.test(chemicalFormula)) {
      chemicalFormula += "O3";
    }

    name = `${titleCased} Structured Gate`;
    spaceGroup = Math.random() > 0.4 ? "P4mm" : "Pm-3m";
    cornerAtom = "O";
    gateAtom = clean.substring(0, 2).replace(/[^a-zA-Z]/g, "X");
    if (gateAtom.length < 1) gateAtom = "M";
    gateAtom = gateAtom.charAt(0).toUpperCase() + gateAtom.slice(1);

    latticeConstant = parseFloat((3.90 + Math.random() * 0.25).toFixed(3));
    z0 = spaceGroup === "P4mm" ? parseFloat((0.18 + Math.random() * 0.22).toFixed(3)) : parseFloat((0.04 + Math.random() * 0.04).toFixed(3));
    k = parseFloat((4.0 + Math.random() * 6.5).toFixed(2));
    q = parseFloat((-1.5 - Math.random() * 1.5).toFixed(2));
    electronMobility = parseFloat((2.0 + Math.random() * 30.0).toFixed(1));

    description = `Virtual candidate synthesized in-browser based on search term "${query}". ` +
      `The lattice models a floating ${gateAtom} gate atom surrounded by a ${cornerAtom} electrostatic cage framework. ` +
      `It features a natural displacement of z₀ = ${z0} Å with local spring constant k = ${k} eV/Å².`;
  }

  return {
    id: `procedural-${clean.toLowerCase()}-${Math.floor(Math.random() * 100000)}`,
    name,
    chemicalFormula,
    spaceGroup,
    description,
    cornerAtom,
    gateAtom,
    latticeConstant,
    z0,
    k,
    q,
    electronMobility,
    isAiGenerated: true,
  };
}

export const MaterialExplorer: React.FC<MaterialExplorerProps> = ({
  selectedMaterial,
  setSelectedMaterial,
  materialsList,
  setMaterialsList,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  
  // Tab selector: "specs" (individual sheet) vs "screening" (all candidate table & designer)
  const [activeTab, setActiveTab] = useState<"specs" | "screening">("screening");

  // Sorting state for the screening table
  const [sortField, setSortField] = useState<keyof MaterialLattice | "ari">("ari");
  const [sortAsc, setSortAsc] = useState(false);

  // Polar / Ferroelectric filter state: "all" | "polar" | "non-polar"
  const [polarFilter, setPolarFilter] = useState<"all" | "polar" | "non-polar">("all");

  const isPolar = (m: MaterialLattice) => {
    const polarSGs = ["P4mm", "R3c", "Amm2", "Pmc21", "C2/c", "Pbma", "Pbam", "I4/mcm"];
    const isSgPolar = polarSGs.some(sg => m.spaceGroup.includes(sg));
    if (isSgPolar) return true;
    if (m.isAiGenerated && m.z0 > 0.05) return true;
    return m.z0 >= 0.15 && !m.name.toLowerCase().includes("symmetric") && !m.name.toLowerCase().includes("insulator") && !m.name.toLowerCase().includes("rigid");
  };

  // Custom synthesized material designer states
  const [customName, setCustomName] = useState("Custom Virtual Perovskite");
  const [customFormula, setCustomFormula] = useState("KTaO3-like");
  const [customLatticeConstant, setCustomLatticeConstant] = useState(4.05);
  const [customZ0, setCustomZ0] = useState(0.24);
  const [customK, setCustomK] = useState(6.5);
  const [customQ, setCustomQ] = useState(-2.2);
  const [customMobility, setCustomMobility] = useState(8.0);
  const [synthesisSuccess, setSynthesisSuccess] = useState(false);

  // Default fallback materials list
  const presets: MaterialLattice[] = useMemo(() => [
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
      id: "zeolite-a-sodium-cage",
      name: "Zeolite-A Sodalite Cage Gate",
      chemicalFormula: "Na12Al12Si12O48",
      spaceGroup: "Pm-3m",
      description: "Zeolites possess rigid aluminosilicate frameworks containing highly flexible polar sites. A sodium ion or localized framework oxygen gate near the center of a 4-ring oxygen aperture can be thermally driven, acting as a molecular sieve diode.",
      cornerAtom: "O",
      gateAtom: "Al/Si",
      latticeConstant: 12.3,
      z0: 0.45,
      k: 2.8,
      q: -1.8,
      electronMobility: 0.1,
    }
  ], []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const query = searchQuery.trim();
    if (!query) return;

    setIsSearching(true);
    setSearchError(null);

    // Simulate search and AI synthesis with a realistic response delay
    setTimeout(() => {
      try {
        const q = query.toLowerCase();

        // 1. Check if there are any matching materials already in our list
        const matches = materialsList.filter(
          m => m.name.toLowerCase().includes(q) ||
               m.chemicalFormula.toLowerCase().includes(q) ||
               m.spaceGroup.toLowerCase().includes(q) ||
               m.description.toLowerCase().includes(q) ||
               m.gateAtom.toLowerCase().includes(q)
        );

        if (matches.length > 0) {
          // If we found matches, select the first match
          setSelectedMaterial(matches[0]);
          setActiveTab("specs");
        } else {
          // 2. Synthesize a new perovskite / cage structure procedurally
          const newMaterial = generateProceduralMaterial(query);
          if (newMaterial) {
            setMaterialsList(prev => [newMaterial, ...prev]);
            setSelectedMaterial(newMaterial);
            setActiveTab("specs");
          } else {
            setSearchError("Unable to synthesize a valid lattice structure for this query.");
          }
        }
      } catch (err: any) {
        console.error(err);
        setSearchError("Offline synthesis model encountered a failure.");
      } finally {
        setIsSearching(false);
      }
    }, 400);
  };

  const loadPreset = (preset: MaterialLattice) => {
    if (!materialsList.some(item => item.id === preset.id)) {
      setMaterialsList(prev => [preset, ...prev]);
    }
    setSelectedMaterial(preset);
  };

  const removeMaterial = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (materialsList.length <= 1) {
      alert("At least one material must remain in your workspace.");
      return;
    }
    const idx = materialsList.findIndex(m => m.id === id);
    const updated = materialsList.filter(m => m.id !== id);
    setMaterialsList(updated);
    if (selectedMaterial.id === id) {
      setSelectedMaterial(updated[0] || updated[idx - 1]);
    }
  };

  // Synthesize custom crystal
  const handleSynthesizeCustom = () => {
    const id = `synthetic-${Date.now()}`;
    const syntheticLattice: MaterialLattice = {
      id,
      name: customName,
      chemicalFormula: customFormula,
      spaceGroup: "Pm-3m (Synthetic)",
      description: `A custom virtual material synthesized via the High-Throughput Analytical Screening Engine. Built with customized electrostatic charge q = ${customQ}e, and flexible bond restoring stiffness k = ${customK} eV/Å² to maximize asymmetric rectification score (predicted ARI: ${liveCustomAri.ari.toFixed(1)}%).`,
      cornerAtom: "O",
      gateAtom: "X",
      latticeConstant: customLatticeConstant,
      z0: customZ0,
      k: customK,
      q: customQ,
      electronMobility: customMobility,
      isAiGenerated: true,
    };

    setMaterialsList(prev => [syntheticLattice, ...prev]);
    setSelectedMaterial(syntheticLattice);
    setSynthesisSuccess(true);
    setTimeout(() => setSynthesisSuccess(false), 3000);
  };

  // Calculated custom material ARI
  const liveCustomAri = useMemo(() => {
    const m: MaterialLattice = {
      id: "temp",
      name: customName,
      chemicalFormula: customFormula,
      spaceGroup: "",
      description: "",
      cornerAtom: "O",
      gateAtom: "X",
      latticeConstant: customLatticeConstant,
      z0: customZ0,
      k: customK,
      q: customQ,
      electronMobility: customMobility,
    };
    return calculateScreening(m);
  }, [customName, customFormula, customLatticeConstant, customZ0, customK, customQ, customMobility]);

  // Screening stats for all current candidates
  const materialsWithStats = useMemo(() => {
    return materialsList.map(m => {
      const stats = calculateScreening(m);
      return {
        ...m,
        stats,
      };
    });
  }, [materialsList]);

  // Filter and Sort candidates
  const sortedMaterials = useMemo(() => {
    let filtered = materialsWithStats;
    if (polarFilter === "polar") {
      filtered = materialsWithStats.filter(m => isPolar(m));
    } else if (polarFilter === "non-polar") {
      filtered = materialsWithStats.filter(m => !isPolar(m));
    }

    return [...filtered].sort((a, b) => {
      let valA: any;
      let valB: any;

      if (sortField === "ari") {
        valA = a.stats.ari;
        valB = b.stats.ari;
      } else {
        valA = a[sortField];
        valB = b[sortField];
      }

      if (typeof valA === "string") {
        return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
      } else {
        return sortAsc ? valA - valB : valB - valA;
      }
    });
  }, [materialsWithStats, sortField, sortAsc, polarFilter]);

  const toggleSort = (field: keyof MaterialLattice | "ari") => {
    if (sortField === field) {
      setSortAsc(prev => !prev);
    } else {
      setSortField(field);
      setSortAsc(false); // default to descending (highest first)
    }
  };

  // Identify top candidate
  const topCandidate = useMemo(() => {
    if (materialsWithStats.length === 0) return null;
    return [...materialsWithStats].sort((a, b) => b.stats.ari - a.stats.ari)[0];
  }, [materialsWithStats]);

  return (
    <div className="bg-[#0a0a0a] border border-[#222] rounded p-5" id="material-explorer-section">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#222] pb-4 mb-5">
        <div className="flex items-center gap-2.5">
          <Compass className="w-5 h-5 text-[#3b82f6]" />
          <div>
            <h2 className="text-sm font-bold text-[#e0e0e0] uppercase tracking-wider font-mono">Candidate Lattice Explorer</h2>
            <p className="text-xs text-[#666]">Search molecular compounds or run high-speed analytical screenings on custom structures</p>
          </div>
        </div>

        {/* Search Bar */}
        <form onSubmit={handleSearch} className="flex gap-2 w-full md:w-auto md:max-w-md">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#555]" />
            <input
              type="text"
              placeholder="e.g., BaTiO3, Perovskite, polar oxides..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-[#151515] border border-[#252525] text-xs text-[#ccc] rounded outline-none focus:border-[#3b82f6] transition-colors placeholder-[#444]"
              id="material-search-input"
            />
          </div>
          <button
            type="submit"
            disabled={isSearching}
            className="bg-[#3b82f6] hover:bg-[#2563eb] text-white px-4 py-2 rounded text-xs uppercase tracking-widest font-bold flex items-center gap-1.5 transition-all disabled:opacity-50 font-mono"
            id="search-ai-btn"
          >
            {isSearching ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Querying...</span>
              </>
            ) : (
              <>
                <Cpu className="w-3.5 h-3.5" />
                <span>Query AI</span>
              </>
            )}
          </button>
        </form>
      </div>

      {searchError && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-300 text-xs rounded-lg flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{searchError}</span>
        </div>
      )}

      {/* Main Grid: Materials Selector & Compound Specs Sheet */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        
        {/* Left Side: Materials List */}
        <div className="md:col-span-4 flex flex-col gap-3">
          <h3 className="text-[10px] font-bold text-[#555] uppercase tracking-widest font-mono">Available Crystal Candidates</h3>
          <div className="flex flex-col gap-2 max-h-[350px] overflow-y-auto pr-1 select-none" id="materials-selector-list">
            {materialsList.map((m) => {
              const isSelected = selectedMaterial.id === m.id;
              const stats = calculateScreening(m);
              return (
                <div
                  key={m.id}
                  onClick={() => setSelectedMaterial(m)}
                  className={`p-3 rounded border transition-all cursor-pointer flex justify-between items-start group ${
                    isSelected
                      ? "bg-[#3b82f6]/10 border-[#3b82f6]/50 text-[#e0e0e0]"
                      : "bg-[#050505]/40 border-[#1a1a1a] hover:bg-[#050505] text-[#888]"
                  }`}
                >
                  <div className="flex flex-col gap-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`font-bold text-xs ${isSelected ? "text-white" : "text-[#ccc]"}`}>{m.chemicalFormula}</span>
                      <span className="text-[8px] text-[#555] bg-[#111] border border-[#222] px-1 py-0.2 rounded font-mono truncate">{m.spaceGroup}</span>
                      {m.isAiGenerated && (
                        <span className="text-[7px] font-bold text-emerald-400 bg-emerald-500/10 px-1 py-0.2 rounded border border-emerald-500/10 shrink-0">SYNTHETIC</span>
                      )}
                    </div>
                    <span className="text-[11px] text-[#666] font-sans truncate max-w-[160px]">{m.name}</span>
                  </div>
                  <div className="text-right text-[10px] font-mono flex items-center gap-2 shrink-0">
                    <div className="flex flex-col gap-0.5">
                      <div className="text-[#3b82f6]/80 font-bold">ARI: {stats.ari.toFixed(0)}%</div>
                      <div className="text-[8px] text-[#444]">z₀: {m.z0.toFixed(2)} Å</div>
                    </div>
                    <button
                      onClick={(e) => removeMaterial(m.id, e)}
                      className="text-[#333] hover:text-red-400 p-1 rounded transition-colors group-hover:text-[#555]"
                      title="Remove Candidate"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Quick Presets Drawer */}
          <div className="bg-[#050505] p-3 border border-[#222] rounded">
            <h4 className="text-[10px] font-bold text-[#555] uppercase tracking-widest mb-2 font-mono">Add Standard Presets</h4>
            <div className="flex flex-wrap gap-1.5">
              {presets.map((preset) => {
                const isAlreadyAdded = materialsList.some(item => item.id === preset.id);
                return (
                  <button
                    key={preset.id}
                    onClick={() => loadPreset(preset)}
                    className={`text-[10px] px-2.5 py-1 rounded border font-mono transition-all ${
                      isAlreadyAdded
                        ? "bg-[#111] border-[#222] text-[#333] cursor-not-allowed"
                        : "bg-[#151515] hover:bg-[#202020] border-[#252525] text-[#888]"
                    }`}
                    disabled={isAlreadyAdded}
                  >
                    + {preset.chemicalFormula}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Side: Tabbed panel (Inspector vs Screening) */}
        <div className="md:col-span-8 flex flex-col" id="exploration-panel-right">
          
          {/* Tab Headers */}
          <div className="flex border-b border-[#222] mb-4 gap-1 select-none">
            <button
              onClick={() => setActiveTab("screening")}
              className={`px-4 py-2 text-xs font-mono font-bold uppercase tracking-wider border-b-2 transition-all flex items-center gap-1.5 ${
                activeTab === "screening"
                  ? "border-[#3b82f6] text-[#3b82f6] bg-[#3b82f6]/5"
                  : "border-transparent text-[#666] hover:text-[#999] hover:bg-[#111]/30"
              }`}
            >
              <Table className="w-3.5 h-3.5" />
              <span>Analytical screening engine</span>
            </button>
            <button
              onClick={() => setActiveTab("specs")}
              className={`px-4 py-2 text-xs font-mono font-bold uppercase tracking-wider border-b-2 transition-all flex items-center gap-1.5 ${
                activeTab === "specs"
                  ? "border-[#3b82f6] text-[#3b82f6] bg-[#3b82f6]/5"
                  : "border-transparent text-[#666] hover:text-[#999] hover:bg-[#111]/30"
              }`}
            >
              <FlaskConical className="w-3.5 h-3.5" />
              <span>Selected Crystal Specs</span>
            </button>
          </div>

          {/* TAB 1: Analytical Screening Dashboard (HIGH SPEED APPROXIMATION) */}
          {activeTab === "screening" && (
            <div className="flex flex-col gap-5 animate-fadeIn">
              
              {/* Screening Engine Theory & Top Pick Header */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 bg-[#111]/30 p-4 border border-[#222] rounded-lg">
                <div className="md:col-span-7 flex flex-col gap-1.5">
                  <div className="flex items-center gap-1.5 text-[9px] font-mono text-[#3b82f6] uppercase tracking-wider">
                    <Activity className="w-3.5 h-3.5 animate-pulse" />
                    <span>Real-time analytical estimation</span>
                  </div>
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono">High-Speed Diode Screening</h4>
                  <p className="text-[11px] text-[#888] leading-relaxed">
                    By estimating the <strong>static electrostatic coupling field</strong> against the <strong>flexible bond susceptibility (1/k)</strong>, we approximate the asymmetrical aperture shrinkage. This permits rapid discovery of candidates without waiting for computationally intensive multi-picosecond molecular dynamics.
                  </p>
                </div>
                {topCandidate && (
                  <div className="md:col-span-5 bg-[#3b82f6]/5 p-3 border border-[#3b82f6]/20 rounded flex flex-col justify-between">
                    <div>
                      <span className="text-[8px] font-mono uppercase text-[#3b82f6] block">★ Top Rated Candidate</span>
                      <strong className="text-sm font-semibold text-white font-mono block mt-0.5">{topCandidate.chemicalFormula}</strong>
                      <span className="text-[10px] text-[#666] block truncate">{topCandidate.name}</span>
                    </div>
                    <div className="flex justify-between items-center mt-2 pt-2 border-t border-[#3b82f6]/10">
                      <span className="text-[9px] text-[#555] font-mono">Est. Rectification:</span>
                      <strong className="text-xs font-mono text-emerald-400">{topCandidate.stats.ari.toFixed(1)}%</strong>
                    </div>
                  </div>
                )}
              </div>

              {/* Table of Candidate Crystals ranked by Approximated Rectification Index */}
              <div className="bg-[#050505] border border-[#222] rounded overflow-hidden">
                <div className="p-3 border-b border-[#222] flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                  <div className="flex flex-col gap-1">
                    <span className="text-[9px] font-mono uppercase font-bold text-[#555]">Candidate Screening Table (Sorted by {sortField === "ari" ? "Score" : String(sortField)})</span>
                    <span className="text-[9px] text-[#444] font-mono">Click headers to sort candidates</span>
                  </div>
                  
                  {/* Filter segmented control */}
                  <div className="flex bg-[#111] p-0.5 rounded border border-[#222] self-start sm:self-auto select-none">
                    <button
                      onClick={() => setPolarFilter("all")}
                      className={`text-[9px] font-mono uppercase px-2.5 py-1 rounded transition-all ${
                        polarFilter === "all"
                          ? "bg-[#3b82f6]/10 text-[#3b82f6] border border-[#3b82f6]/20 font-bold"
                          : "text-[#555] hover:text-[#999] border border-transparent"
                      }`}
                    >
                      All ({materialsWithStats.length})
                    </button>
                    <button
                      onClick={() => setPolarFilter("polar")}
                      className={`text-[9px] font-mono uppercase px-2.5 py-1 rounded transition-all flex items-center gap-1.5 ${
                        polarFilter === "polar"
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold"
                          : "text-[#555] hover:text-emerald-500/80 border border-transparent"
                      }`}
                    >
                      <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse"></span>
                      Polar / Ferroelectric ({materialsWithStats.filter(m => isPolar(m)).length})
                    </button>
                    <button
                      onClick={() => setPolarFilter("non-polar")}
                      className={`text-[9px] font-mono uppercase px-2.5 py-1 rounded transition-all flex items-center gap-1.5 ${
                        polarFilter === "non-polar"
                          ? "bg-blue-500/10 text-blue-400 border border-blue-500/20 font-bold"
                          : "text-[#555] hover:text-blue-500/80 border border-transparent"
                      }`}
                    >
                      <span className="w-1 h-1 rounded-full bg-blue-400"></span>
                      Paraelectric ({materialsWithStats.filter(m => !isPolar(m)).length})
                    </button>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs font-mono border-collapse">
                    <thead>
                      <tr className="bg-[#111]/50 border-b border-[#222] text-[#555] text-[9px] select-none">
                        <th onClick={() => toggleSort("chemicalFormula")} className="p-2.5 cursor-pointer hover:text-white transition-colors">Compound</th>
                        <th onClick={() => toggleSort("latticeConstant")} className="p-2.5 text-right cursor-pointer hover:text-white transition-colors">Aperture (a)</th>
                        <th onClick={() => toggleSort("z0")} className="p-2.5 text-right cursor-pointer hover:text-white transition-colors">Asym (z₀)</th>
                        <th onClick={() => toggleSort("k")} className="p-2.5 text-right cursor-pointer hover:text-white transition-colors">Stiffness (k)</th>
                        <th onClick={() => toggleSort("q")} className="p-2.5 text-right cursor-pointer hover:text-white transition-colors">Charge (q)</th>
                        <th onClick={() => toggleSort("electronMobility")} className="p-2.5 text-right cursor-pointer hover:text-white transition-colors">Mobility (μ)</th>
                        <th onClick={() => toggleSort("ari")} className="p-2.5 text-right cursor-pointer text-[#3b82f6] hover:text-white transition-colors font-bold">Est. ARI</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1a1a1a]">
                      {sortedMaterials.map((m) => {
                        const isSelected = selectedMaterial.id === m.id;
                        return (
                          <tr
                            key={m.id}
                            onClick={() => setSelectedMaterial(m)}
                            className={`hover:bg-[#111]/40 cursor-pointer transition-all ${
                              isSelected ? "bg-[#3b82f6]/5 text-white" : "text-[#888]"
                            }`}
                          >
                            <td className="p-2.5">
                              <div className="flex flex-col gap-0.5">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className={`font-bold ${isSelected ? "text-[#3b82f6]" : "text-[#bbb]"}`}>{m.chemicalFormula}</span>
                                  {isPolar(m) ? (
                                    <span className="text-[7px] text-emerald-400 bg-emerald-500/5 border border-emerald-500/15 px-1 py-0.2 rounded font-sans uppercase">Polar</span>
                                  ) : (
                                    <span className="text-[7px] text-blue-400 bg-blue-500/5 border border-blue-500/15 px-1 py-0.2 rounded font-sans uppercase">Para</span>
                                  )}
                                </div>
                                <span className="text-[9px] text-[#555] font-normal truncate max-w-[140px] block font-sans" title={m.name}>{m.name}</span>
                              </div>
                            </td>
                            <td className="p-2.5 text-right">{m.latticeConstant.toFixed(2)} Å</td>
                            <td className="p-2.5 text-right">{m.z0.toFixed(2)} Å</td>
                            <td className="p-2.5 text-right">{m.k.toFixed(1)}</td>
                            <td className="p-2.5 text-right">{m.q.toFixed(1)}</td>
                            <td className="p-2.5 text-right">{m.electronMobility.toFixed(1)}</td>
                            <td className="p-2.5 text-right font-bold text-white">
                              <div className="flex items-center justify-end gap-1.5">
                                <span className={m.stats.ari > 50 ? "text-emerald-400" : m.stats.ari > 25 ? "text-yellow-400" : "text-red-400"}>
                                  {m.stats.ari.toFixed(1)}%
                                </span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Virtual Crystal Synthesizer & Designer */}
              <div className="bg-[#050505] border border-[#222] rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3 border-b border-[#222] pb-2">
                  <Sliders className="w-4 h-4 text-[#3b82f6]" />
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono">Virtual Lattice Designer (Fast Prototyper)</h4>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="flex flex-col gap-3">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="flex flex-col gap-1">
                        <label className="text-[9px] font-mono text-[#555] uppercase">Compound Formula</label>
                        <input
                          type="text"
                          value={customFormula}
                          onChange={e => setCustomFormula(e.target.value)}
                          className="px-2.5 py-1.5 bg-[#111] border border-[#222] text-xs text-white rounded outline-none font-mono"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-[9px] font-mono text-[#555] uppercase">Virtual Compound Name</label>
                        <input
                          type="text"
                          value={customName}
                          onChange={e => setCustomName(e.target.value)}
                          className="px-2.5 py-1.5 bg-[#111] border border-[#222] text-xs text-white rounded outline-none font-sans"
                        />
                      </div>
                    </div>

                    {/* Sliding lattice params */}
                    <div className="flex flex-col gap-2">
                      <div className="flex justify-between items-center text-[9px] font-mono uppercase">
                        <span className="text-[#888]">Lattice Constant (a):</span>
                        <span className="text-white font-bold">{customLatticeConstant.toFixed(2)} Å</span>
                      </div>
                      <input
                        type="range"
                        min="2.5"
                        max="14.0"
                        step="0.05"
                        value={customLatticeConstant}
                        onChange={e => setCustomLatticeConstant(parseFloat(e.target.value))}
                        className="w-full h-1 bg-[#151515] rounded-lg appearance-none cursor-pointer accent-[#3b82f6]"
                      />
                    </div>

                    <div className="flex flex-col gap-2">
                      <div className="flex justify-between items-center text-[9px] font-mono uppercase">
                        <span className="text-[#888]">Asymmetric Rest Position (z₀):</span>
                        <span className="text-white font-bold">{customZ0.toFixed(2)} Å</span>
                      </div>
                      <input
                        type="range"
                        min="0.0"
                        max="0.8"
                        step="0.01"
                        value={customZ0}
                        onChange={e => setCustomZ0(parseFloat(e.target.value))}
                        className="w-full h-1 bg-[#151515] rounded-lg appearance-none cursor-pointer accent-[#3b82f6]"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 justify-between">
                    <div className="grid grid-cols-3 gap-2">
                      <div className="flex flex-col gap-2">
                        <div className="flex justify-between items-center text-[8px] font-mono uppercase">
                          <span className="text-[#555]">Stiffness (k):</span>
                          <span className="text-[#ccc]">{customK.toFixed(1)}</span>
                        </div>
                        <input
                          type="range"
                          min="1.0"
                          max="15.0"
                          step="0.2"
                          value={customK}
                          onChange={e => setCustomK(parseFloat(e.target.value))}
                          className="w-full h-1 bg-[#151515] rounded-lg appearance-none cursor-pointer accent-[#3b82f6]"
                        />
                      </div>

                      <div className="flex flex-col gap-2">
                        <div className="flex justify-between items-center text-[8px] font-mono uppercase">
                          <span className="text-[#555]">Gate Charge (q):</span>
                          <span className="text-[#ccc]">{customQ.toFixed(1)}</span>
                        </div>
                        <input
                          type="range"
                          min="-5.0"
                          max="-0.1"
                          step="0.1"
                          value={customQ}
                          onChange={e => setCustomQ(parseFloat(e.target.value))}
                          className="w-full h-1 bg-[#151515] rounded-lg appearance-none cursor-pointer accent-[#3b82f6]"
                        />
                      </div>

                      <div className="flex flex-col gap-2">
                        <div className="flex justify-between items-center text-[8px] font-mono uppercase">
                          <span className="text-[#555]">Mobility (μ):</span>
                          <span className="text-[#ccc]">{customMobility.toFixed(1)}</span>
                        </div>
                        <input
                          type="range"
                          min="0.1"
                          max="25.0"
                          step="0.5"
                          value={customMobility}
                          onChange={e => setCustomMobility(parseFloat(e.target.value))}
                          className="w-full h-1 bg-[#151515] rounded-lg appearance-none cursor-pointer accent-[#3b82f6]"
                        />
                      </div>
                    </div>

                    {/* Calculated Live ARI and Synthesis trigger */}
                    <div className="bg-[#111] p-3 border border-[#222] rounded flex justify-between items-center">
                      <div className="flex flex-col">
                        <span className="text-[8px] font-mono uppercase text-[#666]">Predicted Analytical Performance (ARI)</span>
                        <div className="flex items-baseline gap-1">
                          <strong className={`text-xl font-bold font-mono ${liveCustomAri.ari > 50 ? "text-emerald-400" : liveCustomAri.ari > 25 ? "text-yellow-400" : "text-red-400"}`}>
                            {liveCustomAri.ari.toFixed(1)}%
                          </strong>
                          <span className="text-[9px] text-[#555] font-mono">rectification efficiency index</span>
                        </div>
                      </div>
                      <button
                        onClick={handleSynthesizeCustom}
                        className={`px-4 py-2 rounded text-[10px] font-bold font-mono uppercase tracking-widest transition-all flex items-center gap-1.5 ${
                          synthesisSuccess
                            ? "bg-emerald-500 text-white"
                            : "bg-[#3b82f6] hover:bg-[#2563eb] text-white"
                        }`}
                      >
                        {synthesisSuccess ? (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            <span>Synthesized!</span>
                          </>
                        ) : (
                          <>
                            <Zap className="w-3.5 h-3.5" />
                            <span>Simulate Crystal</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Detailed specifications sheet (for the currently selected material) */}
          {activeTab === "specs" && (
            <div className="bg-[#050505]/40 border border-[#222] rounded p-5 flex flex-col justify-between h-full min-h-[380px] animate-fadeIn" id="compound-specs-sheet">
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between border-b border-[#222] pb-2">
                  <div className="flex flex-col">
                    <span className="text-[9px] font-bold text-[#3b82f6] uppercase font-mono tracking-widest">Compound Specifications</span>
                    <h3 className="text-sm font-medium text-white font-sans tracking-tight uppercase mt-0.5">{selectedMaterial.name}</h3>
                  </div>
                  <span className="text-xs font-bold text-[#3b82f6] bg-[#3b82f6]/10 border border-[#3b82f6]/20 px-2.5 py-1 rounded font-mono">
                    {selectedMaterial.chemicalFormula}
                  </span>
                </div>

                <p className="text-xs text-[#888] leading-normal font-sans">
                  {selectedMaterial.description}
                </p>

                {/* Micro crystalline grid data */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
                  <div className="bg-[#0a0a0a] p-2.5 border border-[#222] rounded font-mono">
                    <span className="text-[9px] text-[#555] block uppercase tracking-wider">Lattice Constant</span>
                    <span className="text-sm font-medium text-[#ccc]">{selectedMaterial.latticeConstant.toFixed(2)} Å</span>
                  </div>
                  <div className="bg-[#0a0a0a] p-2.5 border border-[#222] rounded font-mono">
                    <span className="text-[9px] text-[#555] block uppercase tracking-wider">Asymmetric Shift</span>
                    <span className="text-sm font-medium text-[#ccc]">{selectedMaterial.z0.toFixed(2)} Å</span>
                  </div>
                  <div className="bg-[#0a0a0a] p-2.5 border border-[#222] rounded font-mono">
                    <span className="text-[9px] text-[#555] block uppercase tracking-wider">Stiffness (k)</span>
                    <span className="text-sm font-medium text-[#ccc]">{selectedMaterial.k.toFixed(1)} eV/Å²</span>
                  </div>
                  <div className="bg-[#0a0a0a] p-2.5 border border-[#222] rounded font-mono">
                    <span className="text-[9px] text-[#555] block uppercase tracking-wider">Gate Ion Charge</span>
                    <span className="text-sm font-medium text-[#ccc]">{selectedMaterial.q.toFixed(1)} e⁻</span>
                  </div>
                  <div className="bg-[#0a0a0a] p-2.5 border border-[#222] rounded font-mono">
                    <span className="text-[9px] text-[#555] block uppercase tracking-wider">Space Group</span>
                    <span className="text-sm font-medium text-[#ccc]">{selectedMaterial.spaceGroup}</span>
                  </div>
                  <div className="bg-[#0a0a0a] p-2.5 border border-[#222] rounded font-mono">
                    <span className="text-[9px] text-[#555] block uppercase tracking-wider">Carrier Mobility</span>
                    <span className="text-sm font-medium text-[#ccc]">{selectedMaterial.electronMobility.toFixed(1)} cm²/Vs</span>
                  </div>
                </div>

                {/* Live analytical stats for this selected material */}
                <div className="bg-[#0a0a0a] border border-[#222] rounded p-3 mt-2">
                  <span className="text-[8px] font-mono uppercase text-[#3b82f6] block mb-2">Live Analytical Screen Metrics</span>
                  <div className="grid grid-cols-3 gap-2 text-center text-xs font-mono">
                    <div className="border-r border-[#222]">
                      <span className="text-[8px] text-[#555] block uppercase">Pore Coupling</span>
                      <strong className="text-[#ccc]">{calculateScreening(selectedMaterial).couplingField.toFixed(2)} eV/Å²</strong>
                    </div>
                    <div className="border-r border-[#222]">
                      <span className="text-[8px] text-[#555] block uppercase">Compliance</span>
                      <strong className="text-[#ccc]">{calculateScreening(selectedMaterial).susceptibility.toFixed(3)} Å/eV</strong>
                    </div>
                    <div>
                      <span className="text-[8px] text-[#555] block uppercase">Screening Score</span>
                      <strong className="text-[#3b82f6] font-bold">{calculateScreening(selectedMaterial).ari.toFixed(1)}%</strong>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-[#1a1a1a] text-[10px] text-[#555] leading-normal flex items-start gap-1.5 font-sans">
                <HelpCircle className="w-3.5 h-3.5 text-[#444] shrink-0 mt-0.5" />
                <span>
                  <strong>Model Interpretation:</strong> The central gate ion `{selectedMaterial.gateAtom}` resides inside a planar cage of four `{selectedMaterial.cornerAtom}` atoms. The asymmetric spacing z₀ acts as a directional physical potential barrier, converting isotropic heat-induced electron drift into a net electrical vector.
                </span>
              </div>
            </div>
          )}

        </div>

      </div>
    </div>
  );
};
