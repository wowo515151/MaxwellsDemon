export enum SimBackend {
  LOCAL_JS = "LOCAL_JS",
  LAMMPS = "LAMMPS",
  QUANTUM_ESPRESSO = "QUANTUM_ESPRESSO"
}

export interface MaterialLattice {
  id: string;
  name: string;
  chemicalFormula: string;
  spaceGroup: string;
  description: string;
  cornerAtom: string;
  gateAtom: string;
  latticeConstant: number; // in Angstroms
  z0: number; // initial gate displacement out-of-plane, in Angstroms
  k: number; // spring stiffness, eV/A^2
  q: number; // gate charge, in e (elementary charge, negative values for negative ions)
  electronMobility: number; // cm^2/(V*s)
  isAiGenerated?: boolean;
}

export interface SimParams {
  temperature: number; // in Kelvin
  springStiffness: number; // eV/A^2 (stiffness of flexible bonds)
  gateCharge: number; // elementary charge -e
  initialDisplacement: number; // Angstroms (z0)
  electronSpeedMultiplier: number;
  flowRate: number; // rate of electron entry
  isRunning: boolean;
  showForces: boolean;
  showAperture: boolean;
  gateMass: number; // AMU
  activeBackend: SimBackend;
  singleElectronRegime?: boolean;
}

export interface SimStats {
  injectedLtoR: number;
  injectedRtoL: number;
  passedLtoR: number;
  passedRtoL: number;
  netCurrent: number; // net electron rate
  rectificationRatio: number; // (Passed L->R - Passed R->L) / Total Passed
  currentHistory: { time: number; net: number; lr: number; rl: number }[];
}
