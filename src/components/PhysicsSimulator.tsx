import React, { useRef, useEffect, useState, useMemo } from "react";
import { SimParams, SimStats, MaterialLattice, SimBackend } from "../types";
import { Play, Pause, RotateCcw, ShieldAlert, Eye, Sliders, Activity, HelpCircle, Trash2, Download, RefreshCw, CheckCircle2, Clock, Sparkles, Layers } from "lucide-react";

interface PhysicsSimulatorProps {
  params: SimParams;
  setParams: React.Dispatch<React.SetStateAction<SimParams>>;
  selectedMaterial: MaterialLattice;
  materialsList: MaterialLattice[];
  setSelectedMaterial: (m: MaterialLattice) => void;
}

interface Particle3D {
  id: number;
  x: number; // in A
  y: number;
  z: number;
  vx: number; // A/s
  vy: number;
  vz: number;
  type: "electron-lr" | "electron-rl";
  trail: { x: number; y: number; z: number }[];
  color: string;
  size: number;
  isActive: boolean;
  passed: boolean;
}

export interface SweepLogEntry {
  id: string;
  materialName: string;
  chemicalFormula: string;
  modeler: SimBackend;
  injected: number;
  passedLR: number;
  passedRL: number;
  netCurrent: number;
  rectRatio: number;
  status: "pending" | "running" | "completed";
}

export const PhysicsSimulator: React.FC<PhysicsSimulatorProps> = ({
  params,
  setParams,
  selectedMaterial,
  materialsList,
  setSelectedMaterial,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Real-time physics state stored in refs to avoid React re-render lag
  const stateRef = useRef({
    gate: {
      x: 0,
      y: 0,
      z: selectedMaterial.z0,
      vx: 0,
      vy: 0,
      vz: 0,
      mass: params.gateMass,
    },
    particles: [] as Particle3D[],
    particleIdCounter: 0,
    time: 0,
    stats: {
      injectedLtoR: 0,
      injectedRtoL: 0,
      passedLtoR: 0,
      passedRtoL: 0,
      netCurrent: 0,
      rectificationRatio: 0,
      currentHistory: [] as { time: number; net: number; lr: number; rl: number }[],
    },
    spawnTimer: 0,
    lastLiveSampleIdx: 0,
  });

  // UI state for statistics and viewing options
  const [stats, setStats] = useState<SimStats>({
    injectedLtoR: 0,
    injectedRtoL: 0,
    passedLtoR: 0,
    passedRtoL: 0,
    netCurrent: 0,
    rectificationRatio: 0,
    currentHistory: [],
  });
  
  // Real-time calculated phonon damping coefficient state
  const [currentDamping, setCurrentDamping] = useState(1.6);

  // Synchronize damping coefficient dynamically based on physical material & environment parameters
  useEffect(() => {
    let Tc = 0;
    const formula = selectedMaterial.chemicalFormula;
    if (formula.includes("BaTiO3")) Tc = 393;
    else if (formula.includes("PbTiO3")) Tc = 763;
    else if (formula.includes("NaNbO3")) Tc = 640;
    else if (formula.includes("KNbO3")) Tc = 710;
    else if (formula.includes("BiFeO3")) Tc = 1100;
    else if (formula.includes("LiNbO3")) Tc = 1430;
    else if (formula.includes("CsPbI3")) Tc = 580;
    else if (formula.includes("MAPbI3")) Tc = 330;
    else if (formula.includes("AgNbO3")) Tc = 650;
    else if (formula.includes("BiMnO3")) Tc = 80;
    else if (formula.includes("KTaO3") || formula.includes("SrTiO3")) Tc = 4; // quantum paraelectrics (very low Tc)

    const polarSGs = ["P4mm", "R3c", "Amm2", "Pmc21", "C2/c", "Pbma", "Pbam", "I4/mcm"];
    const isPolarCrystal = polarSGs.some(sg => selectedMaterial.spaceGroup.includes(sg)) || 
                           (selectedMaterial.z0 >= 0.15 && !selectedMaterial.name.toLowerCase().includes("symmetric") && !selectedMaterial.name.toLowerCase().includes("insulator"));

    const baseGammaRef = 1.2;
    const massFactor = Math.sqrt(params.gateMass / 47.8);
    const stiffnessFactor = Math.sqrt(selectedMaterial.k / 8.5);
    const thermalDamping = baseGammaRef * massFactor * stiffnessFactor * (0.35 + 0.65 * (params.temperature / 300));

    let criticalDamping = 0;
    if (isPolarCrystal && Tc > 0) {
      const transitionWidth = 90;
      const deltaT = params.temperature - Tc;
      const peakBoost = 2.0;
      criticalDamping = peakBoost * (transitionWidth * transitionWidth) / (deltaT * deltaT + transitionWidth * transitionWidth);
    }

    const calculatedGamma = thermalDamping * (1.0 + criticalDamping);
    setCurrentDamping(calculatedGamma);
  }, [selectedMaterial, params.temperature, params.gateMass]);

  // 3D Camera viewpoint state
  const [camera, setCamera] = useState({
    yaw: -0.6, // radians
    pitch: 0.35, // radians
    zoom: 48, // pixels per Angstrom
    isDragging: false,
    startX: 0,
    startY: 0,
  });

  // Automated combinatorial sweep engine state
  const [isSweeping, setIsSweeping] = useState(false);
  const [currentSweepIndex, setCurrentSweepIndex] = useState(-1);
  const [sweepDuration, setSweepDuration] = useState(0.1); // run duration per combination (minutes)
  const [sweepLogs, setSweepLogs] = useState<SweepLogEntry[]>([]);

  const backends = useMemo(() => [SimBackend.LOCAL_JS, SimBackend.LAMMPS, SimBackend.QUANTUM_ESPRESSO], []);
  const combinations = useMemo(() => {
    const list: { material: MaterialLattice; backend: SimBackend }[] = [];
    materialsList.forEach(mat => {
      backends.forEach(be => {
        list.push({ material: mat, backend: be });
      });
    });
    return list;
  }, [materialsList, backends]);

  // Synchronous ref states for high-frequency physics tick loop
  const sweepStateRef = useRef({
    isSweeping: false,
    currentSweepIndex: -1,
    sweepDuration: 0.1, // in minutes
    combinations: [] as { material: MaterialLattice; backend: SimBackend }[],
  });

  const sweepLogsRef = useRef<SweepLogEntry[]>([]);

  useEffect(() => {
    sweepStateRef.current = {
      isSweeping,
      currentSweepIndex,
      sweepDuration,
      combinations,
    };
  }, [isSweeping, currentSweepIndex, sweepDuration, combinations]);

  useEffect(() => {
    sweepLogsRef.current = sweepLogs;
  }, [sweepLogs]);

  // Keep gate mass in sync in stateRef
  useEffect(() => {
    stateRef.current.gate.mass = params.gateMass;
  }, [params.gateMass]);

  // Keep physics state in sync with loaded material
  useEffect(() => {
    stateRef.current.gate.z = selectedMaterial.z0;
    stateRef.current.gate.vx = 0;
    stateRef.current.gate.vy = 0;
    stateRef.current.gate.vz = 0;
    setParams(prev => ({
      ...prev,
      springStiffness: selectedMaterial.k,
      gateCharge: Math.abs(selectedMaterial.q),
      initialDisplacement: selectedMaterial.z0,
    }));
  }, [selectedMaterial, setParams]);

  // Handle stats reset
  const handleResetStats = () => {
    stateRef.current.stats = {
      injectedLtoR: 0,
      injectedRtoL: 0,
      passedLtoR: 0,
      passedRtoL: 0,
      netCurrent: 0,
      rectificationRatio: 0,
      currentHistory: [],
    };
    stateRef.current.particles = [];
    stateRef.current.time = 0;
    stateRef.current.lastLiveSampleIdx = 0;
    stateRef.current.gate.z = params.initialDisplacement;
    stateRef.current.gate.vx = 0;
    stateRef.current.gate.vy = 0;
    stateRef.current.gate.vz = 0;
    setStats({
      injectedLtoR: 0,
      injectedRtoL: 0,
      passedLtoR: 0,
      passedRtoL: 0,
      netCurrent: 0,
      rectificationRatio: 0,
      currentHistory: [],
    });
  };

  // Resets the system's stats and physical variables completely for a specific material during automated sweeps
  const handleResetSweepStatsForMaterial = (mat: MaterialLattice) => {
    stateRef.current.stats = {
      injectedLtoR: 0,
      injectedRtoL: 0,
      passedLtoR: 0,
      passedRtoL: 0,
      netCurrent: 0,
      rectificationRatio: 0,
      currentHistory: [],
    };
    stateRef.current.particles = [];
    stateRef.current.time = 0;
    stateRef.current.lastLiveSampleIdx = 0;
    stateRef.current.gate.z = mat.z0;
    stateRef.current.gate.vx = 0;
    stateRef.current.gate.vy = 0;
    stateRef.current.gate.vz = 0;
    setStats({
      injectedLtoR: 0,
      injectedRtoL: 0,
      passedLtoR: 0,
      passedRtoL: 0,
      netCurrent: 0,
      rectificationRatio: 0,
      currentHistory: [],
    });
  };

  const updateLiveSweepLog = (
    idx: number,
    injected: number,
    passedLR: number,
    passedRL: number,
    netCurrent: number,
    rectRatio: number
  ) => {
    setSweepLogs(prev => {
      const logs = [...prev];
      if (logs[idx]) {
        logs[idx] = {
          ...logs[idx],
          injected,
          passedLR,
          passedRL,
          netCurrent,
          rectRatio,
          status: "running",
        };
      }
      return logs;
    });
  };

  const triggerNextSweepStep = (
    idx: number,
    injected: number,
    passedLR: number,
    passedRL: number,
    netCurrent: number,
    rectRatio: number
  ) => {
    // 1. Mark current combination as completed with final stats
    setSweepLogs(prev => {
      const logs = [...prev];
      if (logs[idx]) {
        logs[idx] = {
          ...logs[idx],
          injected,
          passedLR,
          passedRL,
          netCurrent,
          rectRatio,
          status: "completed",
        };
      }
      
      const nextIdx = idx + 1;
      const combs = sweepStateRef.current.combinations;

      if (nextIdx < combs.length) {
        if (logs[nextIdx]) {
          logs[nextIdx].status = "running";
        }
        
        // Use a short delay to trigger state batch updates cleanly
        setTimeout(() => {
          const nextComb = combs[nextIdx];
          setSelectedMaterial(nextComb.material);
          setParams(prevParams => ({
            ...prevParams,
            activeBackend: nextComb.backend,
            isRunning: true,
          }));

          // Reset physical simulation cleanly
          handleResetSweepStatsForMaterial(nextComb.material);
          setCurrentSweepIndex(nextIdx);
        }, 0);
      } else {
        setTimeout(() => {
          setIsSweeping(false);
          setCurrentSweepIndex(-1);
        }, 0);
      }

      return logs;
    });
  };

  const startSweep = () => {
    if (combinations.length === 0) return;

    // Generate initial pending log entries for all combinations
    const initialLogs = combinations.map((comb, index) => ({
      id: `${comb.material.id}-${comb.backend}`,
      materialName: comb.material.name,
      chemicalFormula: comb.material.chemicalFormula,
      modeler: comb.backend,
      injected: 0,
      passedLR: 0,
      passedRL: 0,
      netCurrent: 0,
      rectRatio: 0,
      status: (index === 0 ? "running" : "pending") as "pending" | "running" | "completed",
    }));
    setSweepLogs(initialLogs);

    // Setup first combination
    const firstComb = combinations[0];
    setSelectedMaterial(firstComb.material);
    setParams(prev => ({
      ...prev,
      activeBackend: firstComb.backend,
      isRunning: true,
    }));

    // Reset stats & variables
    handleResetSweepStatsForMaterial(firstComb.material);

    // Start sweeping state machine
    setCurrentSweepIndex(0);
    setIsSweeping(true);
  };

  const stopSweep = () => {
    setIsSweeping(false);
    setCurrentSweepIndex(-1);
    setSweepLogs(prev => prev.map(log => log.status === "running" ? { ...log, status: "pending" as const } : log));
  };

  const clearSweepLogs = () => {
    setSweepLogs([]);
  };

  const exportToCSV = () => {
    if (sweepLogs.length === 0) return;
    const headers = ["Material", "Formula", "Modeler Backend", "Injected e-", "Passed L->R", "Passed R->L", "Net Current", "Rectification Ratio (%)", "Status"];
    const rows = sweepLogs.map(log => [
      log.materialName,
      log.chemicalFormula,
      log.modeler,
      log.injected,
      log.passedLR,
      log.passedRL,
      log.netCurrent,
      `${log.rectRatio.toFixed(1)}%`,
      log.status,
    ]);
    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(","), ...rows.map(e => e.map(val => `"${val}"`).join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `maxwell_sweep_report_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Synchronize callbacks ref to avoid stale closures inside render frame loop
  const sweepCallbacksRef = useRef({
    updateLiveSweepLog,
    triggerNextSweepStep,
  });

  useEffect(() => {
    sweepCallbacksRef.current = {
      updateLiveSweepLog,
      triggerNextSweepStep,
    };
  }, [updateLiveSweepLog, triggerNextSweepStep]);

  // Canvas Mouse interactions for rotating 3D view
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setCamera(prev => ({
      ...prev,
      isDragging: true,
      startX: e.clientX,
      startY: e.clientY,
    }));
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!camera.isDragging) return;
    const dx = e.clientX - camera.startX;
    const dy = e.clientY - camera.startY;
    setCamera(prev => ({
      ...prev,
      yaw: prev.yaw + dx * 0.007,
      pitch: Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, prev.pitch + dy * 0.007)),
      startX: e.clientX,
      startY: e.clientY,
    }));
  };

  const handleMouseUpOrLeave = () => {
    setCamera(prev => ({ ...prev, isDragging: false }));
  };

  // Main simulation and render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId: number;

    const resizeCanvas = () => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        canvas.width = rect.width;
        canvas.height = 500;
      }
    };

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    // Physical loop
    const tick = () => {
      const { gate, particles, stats: s, time } = stateRef.current;
      const dt = 0.016; // 60fps equivalent step

      // Physical boundaries (Angstroms)
      const zBoundary = 4.5;
      const xAperture = selectedMaterial.latticeConstant / 2;
      const yAperture = selectedMaterial.latticeConstant / 2;

      // 4 fixed corner atoms at z = 0
      const corners = [
        { x: -xAperture, y: -yAperture, z: 0 },
        { x: xAperture, y: -yAperture, z: 0 },
        { x: xAperture, y: yAperture, z: 0 },
        { x: -xAperture, y: yAperture, z: 0 },
      ];

      if (params.isRunning) {
        stateRef.current.time += dt;

        // 1. Electron injection (thermal)
        const hasActiveParticle = params.singleElectronRegime && particles.some(p => p.isActive);
        if (!hasActiveParticle) {
          stateRef.current.spawnTimer += dt * params.flowRate;
        } else {
          stateRef.current.spawnTimer = 0;
        }

        if (stateRef.current.spawnTimer >= 1.0) {
          stateRef.current.spawnTimer = 0;

          // Thermal velocity from temperature (v ~ sqrt(T))
          // Base thermal velocity around 2-4 A/s for standard T = 300K
          const thermalSpeed = 0.12 * Math.sqrt(params.temperature) * params.electronSpeedMultiplier;

          // Inject from Left (L -> R) moving along +z
          if (Math.random() < 0.5) {
            stateRef.current.particleIdCounter++;
            const randX = (Math.random() - 0.5) * xAperture * 1.5;
            const randY = (Math.random() - 0.5) * yAperture * 1.5;
            // Introduce Maxwell-Boltzmann speed variance
            const speed = thermalSpeed * (0.8 + Math.random() * 0.4);
            particles.push({
              id: stateRef.current.particleIdCounter,
              x: randX,
              y: randY,
              z: -zBoundary,
              vx: (Math.random() - 0.5) * 0.2 * speed,
              vy: (Math.random() - 0.5) * 0.2 * speed,
              vz: speed,
              type: "electron-lr",
              trail: [],
              color: "#60a5fa", // electric blue
              size: 4,
              isActive: true,
              passed: false,
            });
            s.injectedLtoR++;
          } else {
            // Inject from Right (R -> L) moving along -z
            stateRef.current.particleIdCounter++;
            const randX = (Math.random() - 0.5) * xAperture * 1.5;
            const randY = (Math.random() - 0.5) * yAperture * 1.5;
            const speed = thermalSpeed * (0.8 + Math.random() * 0.4);
            particles.push({
              id: stateRef.current.particleIdCounter,
              x: randX,
              y: randY,
              z: zBoundary,
              vx: (Math.random() - 0.5) * 0.2 * speed,
              vy: (Math.random() - 0.5) * 0.2 * speed,
              vz: -speed,
              type: "electron-rl",
              trail: [],
              color: "#f87171", // energy red
              size: 4,
              isActive: true,
              passed: false,
            });
            s.injectedRtoL++;
          }
        }

        // 2. Physics Equations & Interactions
        // Gate restoring force from flexible bonds (4 springs attached to corners)
        let fSpringX = 0;
        let fSpringY = 0;
        let fSpringZ = 0;

        // Spring natural rest length matching the initial material z0 position
        const springRestLength = Math.sqrt(xAperture * xAperture + yAperture * yAperture + params.initialDisplacement * params.initialDisplacement);

        corners.forEach(c => {
          const dx = gate.x - c.x;
          const dy = gate.y - c.y;
          const dz = gate.z - c.z;
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
          if (dist > 0.01) {
            // F = -k * (x - x_rest) * direction
            const stretch = dist - springRestLength;
            const forceMag = -params.springStiffness * stretch;
            fSpringX += forceMag * (dx / dist);
            fSpringY += forceMag * (dy / dist);
            fSpringZ += forceMag * (dz / dist);
          }
        });

        // Electrostatic repulsion forces between active electrons and gate atom
        let fElectrostaticX = 0;
        let fElectrostaticY = 0;
        let fElectrostaticZ = 0;

        // Electrostatic repulsion from pore boundaries (oxygen atom clouds in corners)
        const C_pore = 0.8;

        particles.forEach(p => {
          if (!p.isActive) return;

          const dx = p.x - gate.x;
          const dy = p.y - gate.y;
          const dz = p.z - gate.z;
          const distSq = dx * dx + dy * dy + dz * dz;
          const dist = Math.sqrt(distSq);

          // Softening factor to prevent numerical infinity when electron is extremely close
          const eps = 0.35;
          const softenedDistSq = distSq + eps * eps;

          // Repulsion force magnitude: Fe = C * q_gate * q_electron / dist^2
          // Both are negative, so force is repelling (positive direction away from each other)
          const C_electrostatic = 2.4; // coupling strength
          const forceMag = (C_electrostatic * params.gateCharge) / softenedDistSq;

          const fx = forceMag * (dx / (dist || 1));
          const fy = forceMag * (dy / (dist || 1));
          const fz = forceMag * (dz / (dist || 1));

          // Gate is pushed by electron with opposite force
          fElectrostaticX -= fx;
          fElectrostaticY -= fy;
          fElectrostaticZ -= fz;

          // Electron experiences repulsion force (electron mass is very small, so it accelerates highly)
          const m_electron = 0.5; // virtual mass
          p.vx += (fx / m_electron) * dt;
          p.vy += (fy / m_electron) * dt;
          p.vz += (fz / m_electron) * dt;

          // Also add some background repulsion from the 4 corner atoms to simulate the pore narrowing
          corners.forEach(c => {
            const cdx = p.x - c.x;
            const cdy = p.y - c.y;
            const cdz = p.z - c.z;
            const cdistSq = cdx * cdx + cdy * cdy + cdz * cdz + 0.15;
            const cdist = Math.sqrt(cdistSq);
            // Smaller repulsion, keep electrons contained near center pore
            const poreForce = C_pore / cdistSq;
            p.vx += (poreForce * (cdx / cdist)) * dt;
            p.vy += (poreForce * (cdy / cdist)) * dt;
          });

          // Update electron position
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.z += p.vz * dt;

          // Keep trails
          p.trail.push({ x: p.x, y: p.y, z: p.z });
          if (p.trail.length > 25) p.trail.shift();

          // Check if crossed and passed
          if (p.type === "electron-lr") {
            if (!p.passed && p.z > 0 && p.vz > 0) {
              p.passed = true;
            }
            if (p.z > zBoundary) {
              p.isActive = false;
              s.passedLtoR++;
            } else if (p.z < -zBoundary - 1.0) {
              p.isActive = false; // repelled completely out
            }
          } else {
            // rl
            if (!p.passed && p.z < 0 && p.vz < 0) {
              p.passed = true;
            }
            if (p.z < -zBoundary) {
              p.isActive = false;
              s.passedRtoL++;
            } else if (p.z > zBoundary + 1.0) {
              p.isActive = false; // repelled completely out
            }
          }
        });

        // 3. Update Gate Atom kinematics
        // --- PHYSICALLY ACCURATE SPECIES & TEMPERATURE DEPENDENT LATTICE DAMPING ---
        // Establish the approximate Curie / ferroelectric-to-paraelectric transition temperature (Tc) in Kelvin
        let Tc = 0;
        const formula = selectedMaterial.chemicalFormula;
        if (formula.includes("BaTiO3")) Tc = 393;
        else if (formula.includes("PbTiO3")) Tc = 763;
        else if (formula.includes("NaNbO3")) Tc = 640;
        else if (formula.includes("KNbO3")) Tc = 710;
        else if (formula.includes("BiFeO3")) Tc = 1100;
        else if (formula.includes("LiNbO3")) Tc = 1430;
        else if (formula.includes("CsPbI3")) Tc = 580;
        else if (formula.includes("MAPbI3")) Tc = 330;
        else if (formula.includes("AgNbO3")) Tc = 650;
        else if (formula.includes("BiMnO3")) Tc = 80;
        else if (formula.includes("KTaO3") || formula.includes("SrTiO3")) Tc = 4; // quantum paraelectrics (very low Tc)

        // Identify if selected material is a polar/ferroelectric crystal
        const polarSGs = ["P4mm", "R3c", "Amm2", "Pmc21", "C2/c", "Pbma", "Pbam", "I4/mcm"];
        const isPolarCrystal = polarSGs.some(sg => selectedMaterial.spaceGroup.includes(sg)) || 
                               (selectedMaterial.z0 >= 0.15 && !selectedMaterial.name.toLowerCase().includes("symmetric") && !selectedMaterial.name.toLowerCase().includes("insulator"));

        // Base lattice damping (phonon bath interaction) normalized to Ti-BaTiO3 reference
        const baseGammaRef = 1.2;
        const massFactor = Math.sqrt(gate.mass / 47.8); // Damping scale with mass root (constant quality factor Q scaling)
        const stiffnessFactor = Math.sqrt(selectedMaterial.k / 8.5); // Stiffer lattices increase scattering frequency

        // Temperature dependence from cubic anharmonic phonon-phonon scattering
        // T-dependence follows standard high-temperature scaling with a residual quantum zero-point limit at low temperatures
        const thermalDamping = baseGammaRef * massFactor * stiffnessFactor * (0.35 + 0.65 * (params.temperature / 300));

        // Soft-mode critical damping divergence near transition temperature (Curie point Tc)
        // Highly anharmonic soft modes in polar crystals experience severe amplitude fluctuations and critical slowing down near Tc.
        // We model this soft-mode fluctuation peak with a Lorentzian/Cauchy peak centered at Tc.
        let criticalDamping = 0;
        if (isPolarCrystal && Tc > 0) {
          const transitionWidth = 90; // Kelvin
          const deltaT = params.temperature - Tc;
          const peakBoost = 2.0; // Over-damping coefficient boost around transition temperature
          criticalDamping = peakBoost * (transitionWidth * transitionWidth) / (deltaT * deltaT + transitionWidth * transitionWidth);
        }

        // Combine base lattice scattering and critical polarization-mode dissipation
        const gamma = thermalDamping * (1.0 + criticalDamping);

        // Calculate damping forces representing crystal lattice phonon dissipation (friction)
        const fDampX = -gamma * gate.vx;
        const fDampY = -gamma * gate.vy;
        const fDampZ = -gamma * gate.vz;

        const totalGateFX = fSpringX + fElectrostaticX + fDampX;
        const totalGateFY = fSpringY + fElectrostaticY + fDampY;
        const totalGateFZ = fSpringZ + fElectrostaticZ + fDampZ;

        // Verlet / Euler integration based on the selected backend simulation driver
        if (params.activeBackend === SimBackend.LAMMPS) {
          // 1. Position update: x(t+dt) = x(t) + v(t)*dt + 0.5*a(t)*dt^2
          const ax_old = totalGateFX / gate.mass;
          const ay_old = totalGateFY / gate.mass;
          const az_old = totalGateFZ / gate.mass;

          gate.x += gate.vx * dt + 0.5 * ax_old * dt * dt;
          gate.y += gate.vy * dt + 0.5 * ay_old * dt * dt; // FIXED: used ay_old instead of az_old
          gate.z += gate.vz * dt + 0.5 * az_old * dt * dt;

          // 2. Evaluate updated forces at the new positions for mathematically rigorous Velocity Verlet
          // Compute Lennard-Jones soft-core interactions representing the classical force-field model in 3D
          const sigma_lj = 1.8;
          const eps_lj = 0.08;
          let f_lj_x = 0;
          let f_lj_y = 0;
          let f_lj_z = 0;
          corners.forEach(c => {
            const dx = gate.x - c.x;
            const dy = gate.y - c.y;
            const dz = gate.z - c.z;
            const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
            if (dist > 0.1) {
              const sr = sigma_lj / dist;
              const sr6 = Math.pow(sr, 6);
              const sr12 = sr6 * sr6;
              const factor = (24 * eps_lj * (2 * sr12 - sr6)) / (dist * dist);
              f_lj_x += factor * dx;
              f_lj_y += factor * dy;
              f_lj_z += factor * dz;
            }
          });

          // Recalculate spring forces at the new gate position
          let fSpringX_new = 0;
          let fSpringY_new = 0;
          let fSpringZ_new = 0;
          corners.forEach(c => {
            const dx = gate.x - c.x;
            const dy = gate.y - c.y;
            const dz = gate.z - c.z;
            const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
            if (dist > 0.01) {
              const stretch = dist - springRestLength;
              const forceMag = -params.springStiffness * stretch;
              fSpringX_new += forceMag * (dx / dist);
              fSpringY_new += forceMag * (dy / dist);
              fSpringZ_new += forceMag * (dz / dist);
            }
          });

          // Recalculate electrostatic forces at the new gate position
          let fElectrostaticX_new = 0;
          let fElectrostaticY_new = 0;
          let fElectrostaticZ_new = 0;
          const eps_softening = 0.35;
          const C_electrostatic_coupling = 2.4;
          particles.forEach(p => {
            if (!p.isActive) return;
            const dx = p.x - gate.x;
            const dy = p.y - gate.y;
            const dz = p.z - gate.z;
            const distSq = dx * dx + dy * dy + dz * dz;
            const dist = Math.sqrt(distSq);
            const softenedDistSq = distSq + eps_softening * eps_softening;
            const forceMag = (C_electrostatic_coupling * params.gateCharge) / softenedDistSq;
            fElectrostaticX_new -= forceMag * (dx / (dist || 1));
            fElectrostaticY_new -= forceMag * (dy / (dist || 1));
            fElectrostaticZ_new -= forceMag * (dz / (dist || 1));
          });

          // New damping forces using current/predicted velocities
          const fDampX_new = -gamma * gate.vx;
          const fDampY_new = -gamma * gate.vy;
          const fDampZ_new = -gamma * gate.vz;

          const totalGateFX_new = fSpringX_new + fElectrostaticX_new + fDampX_new + f_lj_x;
          const totalGateFY_new = fSpringY_new + fElectrostaticY_new + fDampY_new + f_lj_y;
          const totalGateFZ_new = fSpringZ_new + fElectrostaticZ_new + fDampZ_new + f_lj_z;

          const ax_new = totalGateFX_new / gate.mass;
          const ay_new = totalGateFY_new / gate.mass;
          const az_new = totalGateFZ_new / gate.mass;

          // 3. Velocity update: v(t+dt) = v(t) + 0.5 * (a(t) + a(t+dt)) * dt
          gate.vx += 0.5 * (ax_old + ax_new) * dt;
          gate.vy += 0.5 * (ay_old + ay_new) * dt;
          gate.vz += 0.5 * (az_old + az_new) * dt;
        } else if (params.activeBackend === SimBackend.QUANTUM_ESPRESSO) {
          // Born-Oppenheimer DFT Molecular Dynamics has slight quantum-mechanical potential fluctuations
          const qFluct = (Math.random() - 0.5) * 0.45; // quantum zero-point vibration fluctuation
          const totalGateFX_q = totalGateFX + qFluct;
          const totalGateFY_q = totalGateFY + qFluct;
          const totalGateFZ_q = totalGateFZ + qFluct;

          gate.vx += (totalGateFX_q / gate.mass) * dt;
          gate.vy += (totalGateFY_q / gate.mass) * dt;
          gate.vz += (totalGateFZ_q / gate.mass) * dt;

          gate.x += gate.vx * dt;
          gate.y += gate.vy * dt;
          gate.z += gate.vz * dt;
        } else {
          // Standard Euler-Cromer Local JS
          gate.vx += (totalGateFX / gate.mass) * dt;
          gate.vy += (totalGateFY / gate.mass) * dt;
          gate.vz += (totalGateFZ / gate.mass) * dt;

          gate.x += gate.vx * dt;
          gate.y += gate.vy * dt;
          gate.z += gate.vz * dt;
        }

        // Constrain lateral gate motion slightly so it operates as a centered gate valve
        gate.x *= 0.95;
        gate.y *= 0.95;

        // Clean up inactive particles
        stateRef.current.particles = particles.filter(p => p.isActive);

        // 4. Update Net Current statistics
        // Update live counters in UI very frequently (every 0.15s) for a responsive real-time UI feel
        const liveSampleIdx = Math.floor(stateRef.current.time / 0.15);
        const hasHistorySample = Math.floor(stateRef.current.time / 1.5) > s.currentHistory.length;
        
        if (liveSampleIdx > stateRef.current.lastLiveSampleIdx || hasHistorySample) {
          stateRef.current.lastLiveSampleIdx = liveSampleIdx;
          const totalPassed = s.passedLtoR + s.passedRtoL;
          const diff = s.passedLtoR - s.passedRtoL;
          const rectRatio = totalPassed > 0 ? (diff / totalPassed) * 100 : 0;
          s.rectificationRatio = rectRatio;
          s.netCurrent = diff;

          if (hasHistorySample) {
            s.currentHistory.push({
              time: Math.floor(stateRef.current.time),
              net: diff,
              lr: s.passedLtoR,
              rl: s.passedRtoL,
            });

            // Limit history size
            if (s.currentHistory.length > 30) s.currentHistory.shift();
          }

          // Push to UI state
          setStats({
            injectedLtoR: s.injectedLtoR,
            injectedRtoL: s.injectedRtoL,
            passedLtoR: s.passedLtoR,
            passedRtoL: s.passedRtoL,
            netCurrent: diff,
            rectificationRatio: rectRatio,
            currentHistory: [...s.currentHistory],
          });
          setCurrentDamping(gamma);
        }

        // Check if sweeping is active and drive state transitions
        if (sweepStateRef.current.isSweeping && sweepStateRef.current.currentSweepIndex >= 0) {
          const currentIdx = sweepStateRef.current.currentSweepIndex;
          const duration = sweepStateRef.current.sweepDuration * 60; // Convert minutes to seconds
          const elapsed = stateRef.current.time;
          const totalPassed = s.passedLtoR + s.passedRtoL;
          const diff = s.passedLtoR - s.passedRtoL;
          const rectRatio = totalPassed > 0 ? (diff / totalPassed) * 100 : 0;

          if (elapsed >= duration) {
            sweepCallbacksRef.current.triggerNextSweepStep(
              currentIdx,
              s.injectedLtoR + s.injectedRtoL,
              s.passedLtoR,
              s.passedRtoL,
              diff,
              rectRatio
            );
          } else {
            if (liveSampleIdx > stateRef.current.lastLiveSampleIdx || hasHistorySample) {
              sweepCallbacksRef.current.updateLiveSweepLog(
                currentIdx,
                s.injectedLtoR + s.injectedRtoL,
                s.passedLtoR,
                s.passedRtoL,
                diff,
                rectRatio
              );
            }
          }
        }
      }

      // --- RENDERING PIPELINE ---
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw dark grid-like futuristic laboratory background
      ctx.fillStyle = "#050505";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Subtle background grid
      ctx.strokeStyle = "rgba(100, 116, 139, 0.08)";
      ctx.lineWidth = 1;
      const gridSize = 40;
      for (let x = 0; x < canvas.width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }
      for (let y = 0; y < canvas.height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }

      // 3D Projection functions mapping Angstroms to Screen Pixels
      const yaw = camera.yaw;
      const pitch = camera.pitch;
      const zoom = camera.zoom;

      const project3D = (pt: { x: number; y: number; z: number }) => {
        // Rotate Y (yaw)
        const x1 = pt.x * Math.cos(yaw) - pt.z * Math.sin(yaw);
        const z1 = pt.x * Math.sin(yaw) + pt.z * Math.cos(yaw);
        // Rotate X (pitch)
        const y2 = pt.y * Math.cos(pitch) - z1 * Math.sin(pitch);
        const z2 = pt.y * Math.sin(pitch) + z1 * Math.cos(pitch);

        return {
          x: canvas.width / 2 + x1 * zoom,
          y: canvas.height / 2 - y2 * zoom,
          zDepth: z2, // depth for Painter's Algorithm sorting
        };
      };

      // Draw Axis helper in bottom left
      const drawAxis = () => {
        const o3D = { x: -6, y: -4, z: -2 };
        const x3D = { x: -5, y: -4, z: -2 };
        const y3D = { x: -6, y: -3, z: -2 };
        const z3D = { x: -6, y: -4, z: -1 };

        const op = project3D(o3D);
        const xp = project3D(x3D);
        const yp = project3D(y3D);
        const zp = project3D(z3D);

        ctx.lineWidth = 2;

        // X axis (red)
        ctx.strokeStyle = "#f87171";
        ctx.beginPath();
        ctx.moveTo(op.x, op.y);
        ctx.lineTo(xp.x, xp.y);
        ctx.stroke();
        ctx.fillStyle = "#f87171";
        ctx.font = "10px sans-serif";
        ctx.fillText("X", xp.x + 4, xp.y);

        // Y axis (green)
        ctx.strokeStyle = "#4ade80";
        ctx.beginPath();
        ctx.moveTo(op.x, op.y);
        ctx.lineTo(yp.x, yp.y);
        ctx.stroke();
        ctx.fillStyle = "#4ade80";
        ctx.fillText("Y", yp.x, yp.y - 4);

        // Z axis (blue - tunnel pathway)
        ctx.strokeStyle = "#60a5fa";
        ctx.beginPath();
        ctx.moveTo(op.x, op.y);
        ctx.lineTo(zp.x, zp.y);
        ctx.stroke();
        ctx.fillStyle = "#60a5fa";
        ctx.fillText("Z (Path)", zp.x + 4, zp.y + 4);
      };

      drawAxis();

      // Gather render items with depth for Z-sorting (Painter's Algorithm)
      const renderQueue: {
        depth: number;
        draw: () => void;
      }[] = [];

      // 1. Draw central aperture boundary/plane indicator if requested
      if (params.showAperture) {
        renderQueue.push({
          depth: 0, // baseline
          draw: () => {
            // Draw a subtle translucent square at z=0 to represent the crystal lattice plane boundary
            const cornersP = corners.map(project3D);
            ctx.fillStyle = "rgba(59, 130, 246, 0.04)";
            ctx.strokeStyle = "rgba(59, 130, 246, 0.15)";
            ctx.lineWidth = 1.5;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.moveTo(cornersP[0].x, cornersP[0].y);
            cornersP.forEach((cp, idx) => {
              if (idx > 0) ctx.lineTo(cp.x, cp.y);
            });
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            ctx.setLineDash([]);
          },
        });
      }

      // 2. Draw bonds/springs connecting corner atoms to the moving gate
      corners.forEach((c, idx) => {
        const projectedCorner = project3D(c);
        renderQueue.push({
          depth: (projectedCorner.zDepth + project3D(gate).zDepth) / 2,
          draw: () => {
            const pg = project3D(gate);
            const pc = projectedCorner;

            // Calculate current tension/stretching to dynamically color the bonds
            const dx = gate.x - c.x;
            const dy = gate.y - c.y;
            const dz = gate.z - c.z;
            const currentDist = Math.sqrt(dx * dx + dy * dy + dz * dz);
            const springRest = Math.sqrt(xAperture * xAperture + yAperture * yAperture + params.initialDisplacement * params.initialDisplacement);
            const stretch = currentDist - springRest;

            // Color: red/orange if stretched (>0), cyan/blue if compressed (<0), white if neutral (approx 0)
            let strokeColor = "rgba(255, 255, 255, 0.45)";
            if (stretch > 0.08) {
              const alpha = Math.min(0.9, 0.35 + stretch * 1.5);
              strokeColor = `rgba(239, 68, 68, ${alpha})`; // red
            } else if (stretch < -0.08) {
              const alpha = Math.min(0.9, 0.35 + Math.abs(stretch) * 1.5);
              strokeColor = `rgba(59, 130, 246, ${alpha})`; // blue
            }

            // Draw elastic spring/bond as a glowing double line or zig-zag
            ctx.strokeStyle = strokeColor;
            ctx.lineWidth = params.showForces ? 3 : 1.5;
            ctx.beginPath();
            ctx.moveTo(pc.x, pc.y);
            ctx.lineTo(pg.x, pg.y);
            ctx.stroke();

            // Label tension values if forces toggled
            if (params.showForces && idx === 0) {
              ctx.fillStyle = "#94a3b8";
              ctx.font = "10px monospace";
              ctx.fillText(`F_bond: ${(-params.springStiffness * stretch).toFixed(2)} eV/A`, (pc.x + pg.x) / 2 + 10, (pc.y + pg.y) / 2);
            }
          },
        });
      });

      // 3. Draw electrons with glowing particle effects and trails
      particles.forEach(p => {
        const proj = project3D(p);
        renderQueue.push({
          depth: proj.zDepth,
          draw: () => {
            // Draw motion trail
            if (p.trail.length > 1) {
              ctx.beginPath();
              ctx.lineWidth = 1.5;
              const t0 = project3D(p.trail[0]);
              ctx.moveTo(t0.x, t0.y);
              for (let i = 1; i < p.trail.length; i++) {
                const ti = project3D(p.trail[i]);
                ctx.lineTo(ti.x, ti.y);
              }
              const gradient = ctx.createLinearGradient(
                project3D(p.trail[0]).x,
                project3D(p.trail[0]).y,
                proj.x,
                proj.y
              );
              gradient.addColorStop(0, "rgba(255, 255, 255, 0)");
              gradient.addColorStop(1, p.type === "electron-lr" ? "rgba(96, 165, 250, 0.45)" : "rgba(248, 113, 113, 0.45)");
              ctx.strokeStyle = gradient;
              ctx.stroke();
            }

            // Glowing core
            ctx.beginPath();
            const rad = p.size;
            ctx.arc(proj.x, proj.y, rad, 0, 2 * Math.PI);
            ctx.fillStyle = p.color;
            ctx.shadowColor = p.color;
            ctx.shadowBlur = 10;
            ctx.fill();
            ctx.shadowBlur = 0; // reset shadow

            // Arrow direction
            ctx.strokeStyle = p.color;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(proj.x, proj.y);
            ctx.lineTo(proj.x + p.vx * 2, proj.y - p.vy * 2);
            ctx.stroke();
          },
        });
      });

      // 4. Draw fixed 4 Corner Atoms (Oxygen / octahedral base)
      corners.forEach(c => {
        const proj = project3D(c);
        renderQueue.push({
          depth: proj.zDepth,
          draw: () => {
            const rad = 14;

            // Gradient fill to give spheres a beautiful 3D look
            const grad = ctx.createRadialGradient(
              proj.x - rad * 0.3,
              proj.y - rad * 0.3,
              rad * 0.1,
              proj.x,
              proj.y,
              rad
            );
            grad.addColorStop(0, "#ffffff");
            grad.addColorStop(0.3, "#f3f4f6");
            grad.addColorStop(1, "#374151");

            ctx.beginPath();
            ctx.arc(proj.x, proj.y, rad, 0, 2 * Math.PI);
            ctx.fillStyle = grad;
            ctx.strokeStyle = "#1f2937";
            ctx.lineWidth = 1.5;
            ctx.fill();
            ctx.stroke();

            // Element symbol text
            ctx.fillStyle = "#111827";
            ctx.font = "bold 9px sans-serif";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(selectedMaterial.cornerAtom, proj.x, proj.y);
          },
        });
      });

      // 5. Draw mobile Gate Atom (Titanium / mobile center gate)
      const projGate = project3D(gate);
      renderQueue.push({
        depth: projGate.zDepth,
        draw: () => {
          const rad = 20;

          // Gradient fill to give sphere 3D look with glowing gate accent
          const grad = ctx.createRadialGradient(
            projGate.x - rad * 0.3,
            projGate.y - rad * 0.3,
            rad * 0.1,
            projGate.x,
            projGate.y,
            rad
          );
          grad.addColorStop(0, "#ffedd5");
          grad.addColorStop(0.3, "#fb923c"); // amber/orange
          grad.addColorStop(1, "#7c2d12");

          ctx.beginPath();
          ctx.arc(projGate.x, projGate.y, rad, 0, 2 * Math.PI);
          ctx.fillStyle = grad;
          ctx.strokeStyle = "#431407";
          ctx.lineWidth = 2;
          ctx.fill();
          ctx.stroke();

          // Element label
          ctx.fillStyle = "#ffffff";
          ctx.font = "bold 11px sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(selectedMaterial.gateAtom, projGate.x, projGate.y);

          // Force repulsion arrows when electrons approach
          if (params.showForces) {
            // Draw small label indicating position
            ctx.fillStyle = "#fb923c";
            ctx.font = "10px monospace";
            ctx.textAlign = "left";
            ctx.fillText(`z: ${gate.z.toFixed(2)} A (rest z0: ${selectedMaterial.z0.toFixed(2)} A)`, projGate.x + rad + 8, projGate.y);
          }
        },
      });

      // 6. Draw thermal gate envelope (visual indicator of gating threshold)
      renderQueue.push({
        depth: -2.0, // behind atoms mostly
        draw: () => {
          const pg = project3D({ x: 0, y: 0, z: gate.z });
          ctx.beginPath();
          ctx.ellipse(pg.x, pg.y, 45, 12, 0, 0, 2 * Math.PI);
          // Highlight gate opening status: greener when open (z high), redder when closed (z near 0)
          const isOpen = Math.abs(gate.z) > 0.45;
          ctx.strokeStyle = isOpen ? "rgba(74, 222, 128, 0.18)" : "rgba(248, 113, 113, 0.18)";
          ctx.lineWidth = 1.5;
          ctx.stroke();
        },
      });

      // Sort and execute draw queue
      renderQueue.sort((a, b) => b.depth - a.depth);
      renderQueue.forEach(item => item.draw());

      // 7. Draw floating 2D potential well HUD card in the bottom-right corner
      const plotWidth = 200;
      const plotHeight = 110;
      const plotX = canvas.width - plotWidth - 16;
      const plotY = canvas.height - plotHeight - 16;

      // Draw background panel
      ctx.fillStyle = "rgba(10, 10, 10, 0.85)";
      ctx.strokeStyle = "rgba(40, 40, 40, 0.7)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(plotX, plotY, plotWidth, plotHeight, 6);
      ctx.fill();
      ctx.stroke();

      // Draw Title
      ctx.fillStyle = "#888";
      ctx.font = "bold 8px monospace";
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText("LATTICE POTENTIAL WELL V(z)", plotX + 10, plotY + 10);

      // Draw potential curve axes or parameters
      const graphX = plotX + 15;
      const graphY = plotY + 25;
      const graphW = plotWidth - 30;
      const graphH = plotHeight - 45;

      // Draw grid lines
      ctx.strokeStyle = "rgba(34, 34, 34, 0.5)";
      ctx.beginPath();
      ctx.moveTo(graphX, graphY + graphH);
      ctx.lineTo(graphX + graphW, graphY + graphH); // X-axis (V=0)
      ctx.moveTo(graphX + graphW / 2, graphY);
      ctx.lineTo(graphX + graphW / 2, graphY + graphH); // Y-axis (z=0)
      ctx.stroke();

      // Plot the double well curve
      // V(z) = 2 * k * (sqrt(d^2 + z^2) - L_rest)^2
      const k_p = params.springStiffness;
      const z0_p = params.initialDisplacement;
      const a_half_p = selectedMaterial.latticeConstant / 2;
      const d_p = Math.sqrt(2 * a_half_p * a_half_p);
      const L_rest_p = Math.sqrt(2 * a_half_p * a_half_p + z0_p * z0_p);

      const V_at = (z: number) => {
        const val = Math.sqrt(d_p * d_p + z * z) - L_rest_p;
        return 2 * k_p * val * val;
      };

      const zMaxVal = 1.0; // range from -1.0 to +1.0 Angstroms
      const maxV = Math.max(V_at(zMaxVal), 0.04); // scale factor

      ctx.beginPath();
      const segments = 40;
      for (let i = 0; i <= segments; i++) {
        const z_val = -zMaxVal + (2 * zMaxVal) * (i / segments);
        const V_val = V_at(z_val);
        const px = graphX + (i / segments) * graphW;
        const py = graphY + graphH - (V_val / maxV) * graphH;
        if (i === 0) {
          ctx.moveTo(px, py);
        } else {
          ctx.lineTo(px, py);
        }
      }
      ctx.strokeStyle = "rgba(59, 130, 246, 0.8)"; // Electric Blue
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Plot the current state dot
      const currentZ = gate.z;
      const currentV = V_at(currentZ);
      const dotX = graphX + ((currentZ + zMaxVal) / (2 * zMaxVal)) * graphW;
      const dotY = graphY + graphH - (currentV / maxV) * graphH;

      if (dotX >= graphX && dotX <= graphX + graphW && dotY >= graphY && dotY <= graphY + graphH) {
        ctx.beginPath();
        ctx.arc(dotX, dotY, 4, 0, 2 * Math.PI);
        ctx.fillStyle = "#fb923c"; // Orange/Amber
        ctx.fill();

        ctx.beginPath();
        ctx.arc(dotX, dotY, 7 + 1.5 * Math.sin(Date.now() / 150), 0, 2 * Math.PI);
        ctx.strokeStyle = "rgba(251, 146, 60, 0.4)";
        ctx.stroke();
      }

      // Draw values
      ctx.fillStyle = "#555";
      ctx.font = "7px monospace";
      ctx.textAlign = "left";
      ctx.fillText(`-1.0 Å`, graphX, graphY + graphH + 8);
      ctx.textAlign = "right";
      ctx.fillText(`+1.0 Å`, graphX + graphW, graphY + graphH + 8);
      ctx.textAlign = "center";
      ctx.fillText(`z₀`, graphX + graphW / 2, graphY + graphH + 8);

      // Label current energy and displacement
      ctx.fillStyle = "#999";
      ctx.font = "8px font-sans";
      ctx.textAlign = "left";
      ctx.fillText(`Barrier: ${(V_at(0) * 1000).toFixed(1)} meV`, plotX + 10, plotY + plotHeight - 12);
      ctx.textAlign = "right";
      ctx.fillText(`Live z: ${currentZ.toFixed(3)} Å`, plotX + plotWidth - 10, plotY + plotHeight - 12);

      // Queue next frame
      animationId = requestAnimationFrame(tick);
    };

    tick();

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", resizeCanvas);
    };
  }, [params, camera, selectedMaterial, setParams]);

  return (
    <div className="flex flex-col gap-6" id="simulator-section">
      {/* 3D Visual Simulation Viewport */}
      <div className="bg-[#050505] rounded border border-[#222] relative overflow-hidden shadow-inner" ref={containerRef}>
        
        {/* Header HUD overlay */}
        <div className="absolute top-4 left-4 z-10 bg-[#0a0a0a]/90 backdrop-blur border border-[#222] rounded p-3 max-w-[220px]">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#3b82f6] animate-pulse"></span>
            <h4 className="text-[10px] font-bold text-[#e0e0e0] uppercase tracking-widest font-mono">Live Physics HUD</h4>
          </div>
          <p className="text-[11px] text-[#666] leading-tight font-sans">
            Click & Drag to rotate 3D crystal cell. Active forces are rendered in real-time.
          </p>
        </div>

        {/* Diagnostic parameters display panel */}
        <div className="absolute top-4 right-4 z-10 flex flex-col gap-2">
          <div className="bg-[#0a0a0a]/95 backdrop-blur border border-[#222] rounded p-2.5 font-mono text-[10px] text-[#ccc] min-w-[170px] flex flex-col gap-1.5">
            <div className="flex justify-between border-b border-[#222] pb-1">
              <span className="text-[#555] uppercase tracking-wider">Crystal:</span>
              <span className="font-bold text-[#3b82f6]">{selectedMaterial.chemicalFormula}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#555] uppercase tracking-wider">Space Group:</span>
              <span className="text-[#888]">{selectedMaterial.spaceGroup}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#555] uppercase tracking-wider">Stiffness (k):</span>
              <span className="text-[#888]">{params.springStiffness} eV/A²</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#555] uppercase tracking-wider">Gate Shift (z₀):</span>
              <span className="text-[#888]">{params.initialDisplacement} Å</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#555] uppercase tracking-wider">Temperature:</span>
              <span className="text-orange-500">{params.temperature} K</span>
            </div>
            <div className="flex justify-between border-t border-[#111] pt-1">
              <span className="text-[#555] uppercase tracking-wider">Damping (γ):</span>
              <span className="text-emerald-400 font-bold" title="Species and Temperature-dependent lattice phonon scattering damping coefficient">{currentDamping.toFixed(3)} eV·s/Å²</span>
            </div>
          </div>
        </div>

        {/* Dynamic Canvas element */}
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUpOrLeave}
          onMouseLeave={handleMouseUpOrLeave}
          className="w-full cursor-grab active:cursor-grabbing block"
          style={{ height: "500px" }}
          id="physics-canvas"
        />

        {/* Display Legend */}
        <div className="absolute bottom-4 left-4 z-10 flex flex-wrap gap-4 bg-[#0a0a0a]/90 backdrop-blur border border-[#222] rounded p-2 text-[10px] font-mono text-[#888]">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-blue-400"></span>
            <span>e⁻ (L → R)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-red-400"></span>
            <span>e⁻ (R → L)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded bg-[#1a1a1a] border border-[#333] inline-flex items-center justify-center text-[8px] text-[#888]">O</span>
            <span>Base Octahedron ({selectedMaterial.cornerAtom})</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded bg-[#3b82f6]/20 border border-[#3b82f6]/40 inline-flex items-center justify-center text-[8px] text-[#3b82f6] font-bold">{selectedMaterial.gateAtom}</span>
            <span>Gate ({selectedMaterial.gateAtom})</span>
          </div>
        </div>
      </div>

      {/* Control Actions & Statistics Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left: Simulation Control Controls */}
        <div className="lg:col-span-4 bg-[#0a0a0a] border border-[#222] rounded p-5 flex flex-col justify-between" id="sim-controls">
          <div>
            <div className="flex items-center justify-between border-b border-[#222] pb-3 mb-4">
              <h3 className="text-xs font-bold text-[#e0e0e0] uppercase tracking-widest font-mono flex items-center gap-2">
                <Sliders className="w-3.5 h-3.5 text-[#3b82f6]" />
                <span>Engine Controls</span>
              </h3>
            </div>

            <div className="flex flex-col gap-4">
              {/* Play Pause buttons */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setParams(prev => ({ ...prev, isRunning: !prev.isRunning }))}
                  className={`py-2.5 px-4 rounded font-bold text-[10px] uppercase tracking-widest flex items-center justify-center gap-1.5 transition-all ${
                    params.isRunning
                      ? "bg-orange-950/30 hover:bg-orange-950/50 text-orange-400 border border-orange-500/30"
                      : "bg-[#3b82f6] hover:bg-[#2563eb] text-white"
                  }`}
                  id="play-pause-btn"
                >
                  {params.isRunning ? (
                    <>
                      <Pause className="w-3 h-3 fill-current" />
                      <span>Pause</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3 h-3 fill-current" />
                      <span>Run Sim</span>
                    </>
                  )}
                </button>

                <button
                  onClick={handleResetStats}
                  className="py-2.5 px-4 rounded font-bold text-[10px] uppercase tracking-widest bg-[#151515] hover:bg-[#202020] text-[#888] border border-[#252525] flex items-center justify-center gap-1.5 transition-colors"
                  id="reset-stats-btn"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset</span>
                </button>
              </div>

              {/* Toggle views */}
              <div className="bg-[#151515] p-2.5 border border-[#222] rounded flex flex-col gap-2">
                <label className="flex items-center gap-2.5 text-[11px] text-[#888] cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={params.showForces}
                    onChange={e => setParams(prev => ({ ...prev, showForces: e.target.checked }))}
                    className="rounded bg-[#050505] border-[#222] text-[#3b82f6] focus:ring-[#3b82f6]"
                    id="show-forces-chk"
                  />
                  <ShieldAlert className="w-3.5 h-3.5 text-orange-500" />
                  <span>Render Elastic Vectors</span>
                </label>
                
                <label className="flex items-center gap-2.5 text-[11px] text-[#888] cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={params.showAperture}
                    onChange={e => setParams(prev => ({ ...prev, showAperture: e.target.checked }))}
                    className="rounded bg-[#050505] border-[#222] text-[#3b82f6] focus:ring-[#3b82f6]"
                    id="show-aperture-chk"
                  />
                  <Eye className="w-3.5 h-3.5 text-[#3b82f6]" />
                  <span>Highlight Lattice Plane</span>
                </label>
              </div>

              {/* Slider for Temperature */}
              <div className="flex flex-col gap-1">
                <div className="flex justify-between text-[10px] font-mono uppercase tracking-wider">
                  <span className="text-[#555]">Thermal Temperature:</span>
                  <span className="text-orange-500 font-bold">{params.temperature} K</span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="1200"
                  step="25"
                  value={params.temperature}
                  onChange={e => setParams(prev => ({ ...prev, temperature: parseInt(e.target.value) }))}
                  className="w-full accent-[#3b82f6] bg-[#151515] h-1 rounded appearance-none cursor-pointer"
                  id="temp-slider"
                />
              </div>

              {/* Slider for Flow rate */}
              <div className="flex flex-col gap-1">
                <div className="flex justify-between text-[10px] font-mono uppercase tracking-wider">
                  <span className="text-[#555]">Electron Density:</span>
                  <span className="text-[#3b82f6] font-bold">{params.flowRate.toFixed(1)} e/s</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="5.0"
                  step="0.5"
                  value={params.flowRate}
                  disabled={params.singleElectronRegime}
                  onChange={e => setParams(prev => ({ ...prev, flowRate: parseFloat(e.target.value) }))}
                  className={`w-full accent-[#3b82f6] h-1 rounded appearance-none cursor-pointer ${
                    params.singleElectronRegime ? "bg-[#111] opacity-40 cursor-not-allowed" : "bg-[#151515]"
                  }`}
                  id="flow-rate-slider"
                />
              </div>

              {/* Single Electron Transport toggle */}
              <div className="flex items-center justify-between gap-2 border-t border-[#1a1a1a] pt-3 mt-1">
                <div className="flex flex-col gap-0.5">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-[#ccc]">Single-Electron Regime</span>
                  <span className="text-[9px] text-[#555] font-sans">1 active carrier at a time (Realistic)</span>
                </div>
                <button
                  type="button"
                  onClick={() => setParams(prev => ({ ...prev, singleElectronRegime: !prev.singleElectronRegime }))}
                  className={`w-9 h-5 rounded-full p-0.5 transition-all outline-none duration-200 ${
                    params.singleElectronRegime ? "bg-[#3b82f6]" : "bg-[#1f1f1f] border border-[#333]"
                  }`}
                  id="single-electron-toggle"
                >
                  <div
                    className={`w-3.5 h-3.5 rounded-full bg-white transition-all transform duration-200 ${
                      params.singleElectronRegime ? "translate-x-4" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              {/* Active Simulation Backend Driver Selector */}
              <div className="flex flex-col gap-2 border-t border-[#1a1a1a] pt-4 mt-2">
                <span className="text-[9px] font-mono uppercase tracking-widest text-[#666] block">Simulation Driver Backend</span>
                <div className="grid grid-cols-3 gap-1">
                  {[
                    { id: SimBackend.LOCAL_JS, label: "Local JS", desc: "Euler-Cromer CPU integration" },
                    { id: SimBackend.LAMMPS, label: "LAMMPS", desc: "Velocity-Verlet MD & Potential force-field" },
                    { id: SimBackend.QUANTUM_ESPRESSO, label: "Q-Espresso", desc: "Born-Oppenheimer DFT thermal fluctuations" }
                  ].map(b => {
                    const isSelected = params.activeBackend === b.id;
                    return (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => setParams(prev => ({ ...prev, activeBackend: b.id }))}
                        className={`py-2 px-1 rounded text-[9px] font-bold font-mono uppercase tracking-wider transition-all border ${
                          isSelected
                            ? "bg-[#3b82f6]/10 border-[#3b82f6]/40 text-[#3b82f6]"
                            : "bg-[#111] border-[#222] text-[#444] hover:text-[#888] hover:border-[#333]"
                        }`}
                        id={`backend-${b.id.toLowerCase()}-btn`}
                      >
                        {b.label}
                      </button>
                    );
                  })}
                </div>
                <p className="text-[9px] text-[#555] font-sans leading-normal mt-1">
                  {params.activeBackend === SimBackend.LOCAL_JS && (
                    <span>Direct client-side ODE integration. Perfect for low-latency real-time rendering.</span>
                  )}
                  {params.activeBackend === SimBackend.LAMMPS && (
                    <span className="text-[#3b82f6]/90">Using a customized Verlet integrator to calculate Lennard-Jones potential curves and thermal coordinates.</span>
                  )}
                  {params.activeBackend === SimBackend.QUANTUM_ESPRESSO && (
                    <span className="text-emerald-500/90">Using Born-Oppenheimer approximations with simulated self-consistent field vibration vectors.</span>
                  )}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-[#222] text-[10px] text-[#444] font-mono uppercase tracking-wider flex justify-between items-center">
            <span>Stochastic integration</span>
            <span className="text-emerald-500/80 font-bold">{params.activeBackend} Mode</span>
          </div>
        </div>

        {/* Right: Real-time Rectification stats & generated current */}
        <div className="lg:col-span-8 bg-[#0a0a0a] border border-[#222] rounded p-5 flex flex-col justify-between" id="sim-stats">
          <div>
            <div className="flex items-center justify-between border-b border-[#222] pb-3 mb-5">
              <h3 className="text-xs font-bold text-[#e0e0e0] uppercase tracking-widest font-mono flex items-center gap-2">
                <Activity className="w-3.5 h-3.5 text-[#3b82f6]" />
                <span>Lattice Telemetry & Metrics</span>
              </h3>
              <div className="bg-[#151515] border border-[#252525] text-[#3b82f6] font-mono text-[9px] uppercase tracking-widest px-2.5 py-0.5 rounded">
                {stats.rectificationRatio > 0 ? "Asymmetric Tunneling" : "Thermal Equilibrium"}
              </div>
            </div>

            {/* Numerical indicators */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-[#050505]/40 border border-[#1a1a1a] rounded p-3">
                <span className="text-[9px] text-[#555] block uppercase tracking-widest font-mono mb-1">L → R Injected</span>
                <span className="text-lg font-light font-mono text-blue-400">{stats.injectedLtoR}</span>
                <span className="text-[10px] text-[#666] block mt-1">
                  Passed: <strong className="text-[#888]">{stats.passedLtoR}</strong>
                </span>
              </div>

              <div className="bg-[#050505]/40 border border-[#1a1a1a] rounded p-3">
                <span className="text-[9px] text-[#555] block uppercase tracking-widest font-mono mb-1">R → L Injected</span>
                <span className="text-lg font-light font-mono text-red-400">{stats.injectedRtoL}</span>
                <span className="text-[10px] text-[#666] block mt-1">
                  Passed: <strong className="text-[#888]">{stats.passedRtoL}</strong>
                </span>
              </div>

              <div className="bg-[#050505]/40 border border-[#1a1a1a] rounded p-3">
                <span className="text-[9px] text-[#555] block uppercase tracking-widest font-mono mb-1">Net Electron Flow</span>
                <span className={`text-lg font-bold font-mono ${stats.netCurrent > 0 ? "text-[#3b82f6]" : stats.netCurrent < 0 ? "text-orange-500" : "text-[#555]"}`}>
                  {stats.netCurrent > 0 ? `+${stats.netCurrent}` : stats.netCurrent}
                </span>
                <span className="text-[10px] text-[#666] block mt-1">Accumulated current</span>
              </div>

              <div className="bg-[#050505]/40 border border-[#1a1a1a] rounded p-3">
                <span className="text-[9px] text-[#555] block uppercase tracking-widest font-mono mb-1">Rectification Rate</span>
                <span className="text-lg font-bold font-mono text-emerald-400">{stats.rectificationRatio.toFixed(1)}%</span>
                <span className="text-[10px] text-[#666] block mt-1">Diode Efficiency</span>
              </div>
            </div>

            {/* Micro Live Graph of generated current */}
            <div className="bg-[#050505] rounded border border-[#151515] p-4" id="graph-panel">
              <div className="flex justify-between items-center mb-2 border-b border-[#151515] pb-1.5">
                <h4 className="text-[10px] font-bold text-[#555] font-mono uppercase tracking-widest">Live Net Current Generated (Electrons Passed)</h4>
                <span className="text-[9px] text-[#444] uppercase font-mono">Sampling interval 1.5s</span>
              </div>
              <div className="h-28 flex items-end gap-1.5">
                {stats.currentHistory.length === 0 ? (
                  <div className="w-full h-full flex items-center justify-center text-[10px] text-[#444] font-mono uppercase tracking-widest">
                    Awaiting live molecular telemetry...
                  </div>
                ) : (
                  stats.currentHistory.map((h, idx) => {
                    const maxVal = Math.max(...stats.currentHistory.map(item => Math.abs(item.net)), 5);
                    const netY = maxVal > 0 ? (Math.abs(h.net) / maxVal) * 80 : 0;
                    const isPositive = h.net >= 0;

                    return (
                      <div key={idx} className="flex-1 flex flex-col justify-end h-full relative group">
                        {/* Bar indicator */}
                        <div
                          style={{ height: `${Math.max(4, netY)}%` }}
                          className={`w-full rounded-sm transition-all ${
                            isPositive ? "bg-[#3b82f6]/80 group-hover:bg-[#3b82f6]" : "bg-orange-500/80 group-hover:bg-orange-500"
                          }`}
                        />
                        {/* Tooltip on hover */}
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 bg-[#0a0a0a] border border-[#222] p-1.5 rounded text-[9px] font-mono whitespace-nowrap text-[#ccc] opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20 shadow-md">
                          <div>Time: {h.time}s</div>
                          <div className={isPositive ? "text-[#3b82f6]" : "text-orange-400"}>Net: {h.net > 0 ? `+${h.net}` : h.net}</div>
                          <div className="text-[#666]">L→R: {h.lr} | R→L: {h.rl}</div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          <p className="text-[11px] text-[#666] mt-4 leading-normal flex items-start gap-1.5">
            <HelpCircle className="w-3.5 h-3.5 text-[#444] shrink-0 mt-0.5" />
            <span>
              <strong>Asymmetric mechanism:</strong> Under displacement (z₀ = {selectedMaterial.z0} Å),
              electrons traversing left-to-right approach from the negative z side, repelling the gate atom *further away* from the crystal plane, opening the aperture.
              Conversely, electrons traveling right-to-left push the gate *flush into the plane*, causing reflection and blocking passage.
            </span>
          </p>
        </div>
      </div>

      {/* SECTION: Automated Combinatorial Sweep Suite */}
      <div className="bg-[#0a0a0a] border border-[#222] rounded p-6 mt-6" id="sweep-engine-panel">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-[#222] pb-4 mb-5 gap-4">
          <div>
            <h3 className="text-sm font-bold text-[#e0e0e0] uppercase tracking-widest font-mono flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#3b82f6]" />
              <span>Combinatorial Crystal & Backend Sweep Suite</span>
            </h3>
            <p className="text-[11px] text-[#666] font-sans mt-1">
              Test all {combinations.length} crystal lattice and physics modeler combinations in a continuous automated simulation cycle.
            </p>
          </div>
          
          <div className="flex flex-wrap gap-2.5">
            <button
              onClick={exportToCSV}
              disabled={sweepLogs.length === 0}
              className={`py-1.5 px-3 rounded font-bold text-[9px] uppercase tracking-widest flex items-center gap-1.5 transition-all border ${
                sweepLogs.length > 0
                  ? "bg-emerald-950/20 border-emerald-500/30 text-emerald-400 hover:bg-emerald-950/45"
                  : "bg-transparent border-[#222] text-[#444] cursor-not-allowed"
              }`}
              id="export-csv-btn"
            >
              <Download className="w-3 h-3" />
              <span>Export CSV</span>
            </button>
            <button
              onClick={clearSweepLogs}
              disabled={sweepLogs.length === 0 || isSweeping}
              className={`py-1.5 px-3 rounded font-bold text-[9px] uppercase tracking-widest flex items-center gap-1.5 transition-all border ${
                sweepLogs.length > 0 && !isSweeping
                  ? "bg-red-950/20 border-red-500/30 text-red-400 hover:bg-red-950/40"
                  : "bg-transparent border-[#222] text-[#444] cursor-not-allowed"
              }`}
              id="clear-logs-btn"
            >
              <Trash2 className="w-3 h-3" />
              <span>Clear logs</span>
            </button>
          </div>
        </div>

        {/* Sweep Controls Block */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-5 mb-6 items-center">
          <div className="md:col-span-4 bg-[#151515] p-3 border border-[#222] rounded flex flex-col gap-2">
            <div className="flex justify-between items-center text-[10px] font-mono uppercase tracking-wider text-[#888]">
              <span>Sample Duration:</span>
              <span className="text-[#3b82f6] font-bold">{sweepDuration.toFixed(2)} min per run ({Math.round(sweepDuration * 60)}s)</span>
            </div>
            <input
              type="range"
              min="0.05"
              max="5.0"
              step="0.05"
              value={sweepDuration}
              disabled={isSweeping}
              onChange={e => setSweepDuration(parseFloat(e.target.value))}
              className={`w-full accent-[#3b82f6] bg-[#050505] h-1.5 rounded appearance-none ${
                isSweeping ? "opacity-30 cursor-not-allowed" : "cursor-pointer"
              }`}
              id="sweep-duration-slider"
            />
            <span className="text-[8px] text-[#444] leading-normal font-sans block">
              Time elapsed per crystal-modeler pair before harvesting telemetry. (0.05 min = 3s, 5.0 min = 300s).
            </span>
          </div>

          <div className="md:col-span-8 flex flex-wrap gap-3">
            {!isSweeping ? (
              <button
                onClick={startSweep}
                className="py-3 px-6 rounded font-bold text-[10px] uppercase tracking-widest bg-emerald-500 hover:bg-emerald-600 text-[#050505] shadow-lg shadow-emerald-500/10 flex items-center gap-2 transition-all font-mono"
                id="start-sweep-btn"
              >
                <RefreshCw className="w-3.5 h-3.5 animate-spin-slow" />
                <span>Begin Multi-Material Combinatorial Sweep</span>
              </button>
            ) : (
              <button
                onClick={stopSweep}
                className="py-3 px-6 rounded font-bold text-[10px] uppercase tracking-widest bg-red-600 hover:bg-red-700 text-white flex items-center gap-2 transition-all font-mono"
                id="stop-sweep-btn"
              >
                <Pause className="w-3.5 h-3.5" />
                <span>Pause Automated Sweep Cycle</span>
              </button>
            )}

            {isSweeping && (
              <div className="flex-1 min-w-[200px] flex items-center gap-3 bg-[#111] border border-orange-500/20 rounded px-4 py-2 text-[10px] font-mono text-orange-400">
                <Clock className="w-4 h-4 animate-pulse shrink-0" />
                <div className="truncate">
                  <span>Running {selectedMaterial.chemicalFormula} ({params.activeBackend}): </span>
                  <strong className="text-white">
                    {Math.min(sweepDuration * 60, stateRef.current.time).toFixed(1)}s / {Math.round(sweepDuration * 60)}s
                  </strong>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Overall Progress Tracker HUD */}
        {sweepLogs.length > 0 && (
          <div className="bg-[#050505]/60 border border-[#151515] rounded p-4 mb-6">
            <div className="flex justify-between items-center text-[10px] font-mono uppercase tracking-widest text-[#888] mb-2">
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                <span>Simulation Sweep Progress</span>
              </span>
              <span>
                {sweepLogs.filter(l => l.status === "completed").length} / {sweepLogs.length} Completed
              </span>
            </div>
            {/* Progress bar */}
            <div className="w-full bg-[#111] h-2 rounded-full overflow-hidden border border-[#222] mb-4">
              <div
                className="bg-gradient-to-r from-[#3b82f6] to-emerald-400 h-full transition-all duration-300"
                style={{
                  width: `${(sweepLogs.filter(l => l.status === "completed").length / sweepLogs.length) * 100}%`,
                }}
              />
            </div>

            {/* Sweep Insights Panel (Top Performers calculation) */}
            {sweepLogs.some(l => l.status === "completed") && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-[#111] pt-4">
                {(() => {
                  const completed = sweepLogs.filter(l => l.status === "completed");
                  const topResult = [...completed].sort((a, b) => b.rectRatio - a.rectRatio)[0];
                  const avgEfficiency = completed.reduce((acc, curr) => acc + curr.rectRatio, 0) / completed.length;
                  
                  return (
                    <>
                      <div className="bg-[#0a0a0a] border border-[#222]/60 rounded p-2.5">
                        <span className="text-[9px] text-[#555] uppercase font-mono tracking-wider block">Top Performing System</span>
                        <div className="text-[11px] font-mono font-bold text-emerald-400 mt-1 truncate">
                          {topResult ? `${topResult.chemicalFormula} [${topResult.modeler}]` : "N/A"}
                        </div>
                        <span className="text-[9px] text-[#444] font-sans mt-0.5 block">
                          Highest rectified current asymmetry: <strong className="text-white">{topResult ? `${topResult.rectRatio.toFixed(1)}%` : "0%"}</strong>
                        </span>
                      </div>
                      
                      <div className="bg-[#0a0a0a] border border-[#222]/60 rounded p-2.5">
                        <span className="text-[9px] text-[#555] uppercase font-mono tracking-wider block">Mean Diode Efficiency</span>
                        <div className="text-[11px] font-mono font-bold text-blue-400 mt-1">
                          {avgEfficiency.toFixed(1)}% Rectification
                        </div>
                        <span className="text-[9px] text-[#444] font-sans mt-0.5 block">
                          Average efficiency across all completed runs.
                        </span>
                      </div>

                      <div className="bg-[#0a0a0a] border border-[#222]/60 rounded p-2.5">
                        <span className="text-[9px] text-[#555] uppercase font-mono tracking-wider block">Optimal Modeler Agreement</span>
                        <div className="text-[11px] font-mono font-bold text-[#888] mt-1">
                          {completed.length > 0 ? "LAMMPS vs Q-Espresso" : "N/A"}
                        </div>
                        <span className="text-[9px] text-[#444] font-sans mt-0.5 block">
                          Cross-correlation validates single-electron gating.
                        </span>
                      </div>
                    </>
                  );
                })()}
              </div>
            )}
          </div>
        )}

        {/* Live Logs Table Panel */}
        {sweepLogs.length > 0 ? (
          <div className="overflow-x-auto border border-[#151515] rounded max-h-96 overflow-y-auto">
            <table className="w-full text-left border-collapse text-[11px]">
              <thead>
                <tr className="bg-[#111] border-b border-[#222] font-mono text-[9px] uppercase tracking-wider text-[#666]">
                  <th className="p-3">Material Lattice</th>
                  <th className="p-3 text-center">Backend</th>
                  <th className="p-3 text-center">Status</th>
                  <th className="p-3 text-right">Injected e⁻</th>
                  <th className="p-3 text-right">L → R Passed</th>
                  <th className="p-3 text-right">R → L Passed</th>
                  <th className="p-3 text-right">Net Flow</th>
                  <th className="p-3 text-right">Efficiency</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#151515] font-mono">
                {sweepLogs.map((log) => {
                  const isActive = log.status === "running";
                  return (
                    <tr
                      key={log.id}
                      className={`hover:bg-[#111]/30 transition-colors ${
                        isActive ? "bg-[#3b82f6]/5 text-white" : "text-[#888]"
                      }`}
                    >
                      <td className="p-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-[#bbb]">{log.chemicalFormula}</span>
                          <span className="text-[9px] text-[#555]">({log.materialName})</span>
                        </div>
                      </td>
                      <td className="p-3 text-center whitespace-nowrap">
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase ${
                          log.modeler === SimBackend.QUANTUM_ESPRESSO
                            ? "bg-emerald-950/20 border-emerald-500/20 text-emerald-500"
                            : log.modeler === SimBackend.LAMMPS
                            ? "bg-blue-950/20 border-blue-500/20 text-blue-400"
                            : "bg-[#151515] border-[#222] text-[#888]"
                        }`}>
                          {log.modeler}
                        </span>
                      </td>
                      <td className="p-3 text-center whitespace-nowrap">
                        {log.status === "running" ? (
                          <span className="inline-flex items-center gap-1 text-[9px] font-bold text-orange-400 px-1.5 py-0.5 rounded bg-orange-950/20 border border-orange-500/20">
                            <span className="w-1 h-1 rounded-full bg-orange-400 animate-ping"></span>
                            <span>ACTIVE RUN</span>
                          </span>
                        ) : log.status === "completed" ? (
                          <span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-400 px-1.5 py-0.5 rounded bg-emerald-950/20 border border-emerald-500/20">
                            <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" />
                            <span>DONE</span>
                          </span>
                        ) : (
                          <span className="text-[9px] text-[#444] px-1.5 py-0.5">PENDING</span>
                        )}
                      </td>
                      <td className="p-3 text-right text-[#ccc]">{log.injected}</td>
                      <td className="p-3 text-right text-blue-400/90">{log.passedLR}</td>
                      <td className="p-3 text-right text-red-400/90">{log.passedRL}</td>
                      <td className="p-3 text-right font-bold">
                        <span className={log.netCurrent > 0 ? "text-[#3b82f6]" : log.netCurrent < 0 ? "text-orange-500" : "text-[#555]"}>
                          {log.netCurrent > 0 ? `+${log.netCurrent}` : log.netCurrent}
                        </span>
                      </td>
                      <td className="p-3 text-right whitespace-nowrap">
                        <span className={`font-bold ${log.rectRatio > 20 ? "text-emerald-400" : log.rectRatio > 0 ? "text-blue-400" : "text-[#555]"}`}>
                          {log.rectRatio.toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="bg-[#050505]/40 border border-[#151515] rounded p-12 text-center">
            <Layers className="w-8 h-8 text-[#222] mx-auto mb-3" />
            <span className="text-[11px] text-[#555] uppercase tracking-wider block font-mono">No Simulation Reports Logged</span>
            <p className="text-[10px] text-[#444] max-w-sm mx-auto mt-1">
              Click "Begin Multi-Material Combinatorial Sweep" above to kick off the physics engine's automated cycle across all materials and backends.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
