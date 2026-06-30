# Maxwell's Demon: Perovskite Lattice Physics & Molecular Dynamics Simulator

An interactive, high-fidelity 3D classical Molecular Dynamics (MD) simulator designed to explore soft-mode optical phonon dynamics, local electrostatic gating, and Landau-Ginzburg-Devonshire (LGD) double-well phase transitions in perovskite-structured crystals (ABO₃ / ABX₃), simulating a virtual "demon" guiding directional thermal-to-electric energy conversion.

---

## 🔬 Scientific & Theoretical Background

The simulator models a single perovskite unit cell where a central gate atom ($B$-site cation) resides in an electrostatic cage formed by four planar corner atoms ($X$-site anions, e.g., Oxygen or Halides) and out-of-plane elements.

### 1. The Double-Well Potential Energy Landscape $V(z)$
When the spring's resting length $L_{\text{rest}}$ is configured to be larger than the planar aperture radius $d$ (where $d = a/2$ and $a$ is the lattice constant), the origin ($z = 0$) becomes an unstable saddle point, representing a soft optical phonon mode instability. 

By calculating the total elastic potential energy along the normal displacement axis:
$$V(z) = 2k \left(\sqrt{d^2 + z^2} - L_{\text{rest}}\right)^2$$

Performing a Taylor series expansion around the symmetric origin $z = 0$ yields the classic Landau double-well expansion:
$$V(z) \approx A z^2 + B z^4 + C$$

*   **Quadratic Coefficient $A = -\frac{k z_0^2}{d^2} \le 0$**: Represents the soft-mode destabilization driving ferroelectric displacement.
*   **Quartic Coefficient $B = \frac{k}{2 d^2} \ge 0$**: Represents the anharmonic lattice restoration stabilizing spontaneous polarization.

### 2. Temperature-Dependent Phonon Scattering (Damping $\gamma$)
To model thermal bath interactions, the gate atom is coupled to a crystal lattice phonon bath. The scattering rate and damping coefficient are calculated dynamically based on temperature ($T$) and material species, implementing the soft-mode critical damping divergence near the Curie point ($T_c$):
$$\gamma(T) = \gamma_0 + \gamma_{\text{peak}} \exp\left(-\frac{(T - T_c)^2}{2\sigma^2}\right)$$

---

## 🚀 Key Features

*   **3D Crystal Lattice Visualizer**: An interactive, hardware-accelerated 3D canvas rendering unit cell atomic coordinates, real-time kinetic vector trails, and spring-mesh stress lines.
*   **Potential Well HUD Overlay**: A real-time, 2D vector-drawn potential energy landscape $V(z)$ displaying the active displacement of the gate atom as it slides across the local potential barrier.
*   **Candidate Material Explorer**: A fully client-side database featuring classic ferroelectrics ($\text{BaTiO}_3$, $\text{PbTiO}_3$) alongside a **Procedural Synthesis Engine** that translates any custom molecular search (like halide perovskites $\text{CsPbI}_3$, $\text{MAPbBr}_3$) into structural models.
*   **Physics & MD Approximations Auditor**: A dedicated, live-updating calculation auditor showing conversion factors, Taylor expansion coefficients, and quantum-to-classical approximations.
*   **FOSS Integration Guide**: Built-in documentation bridging this client-side educational interactive app with high-performance production tools like **LAMMPS** (Lennard-Jones/Coulomb pairwise setups) and **Quantum ESPRESSO** (DFT Plane-Wave configurations).

---

## ⚖️ Licensing & Legal Audit

The application is licensed under the permissive **MIT License**. Below is an audit of the direct dependency tree, confirming full compliance and compatibility with the MIT licensing terms.

| Dependency | Package Name | Upstream License | MIT Compatibility | Role in Application |
| :--- | :--- | :--- | :--- | :--- |
| **React** | `react` / `react-dom` | **MIT** | ✅ Fully Compatible | Core component architecture |
| **Vite** | `vite` / `@vitejs/plugin-react` | **MIT** | ✅ Fully Compatible | Dev server and bundler |
| **Motion** | `motion` | **MIT** | ✅ Fully Compatible | High-performance fluid animations |
| **Tailwind CSS** | `tailwindcss` / `@tailwindcss/vite` | **MIT** | ✅ Fully Compatible | Responsive utility-first style framework |
| **Lucide Icons**| `lucide-react` | **ISC** | ✅ Fully Compatible | Sleek modern outline vector iconography |
| **Google GenAI**| `@google/genai` | **Apache-2.0** | ✅ Fully Compatible | Optional client-side LLM connectivity |
| **Dotenv** | `dotenv` | **BSD-2-Clause** | ✅ Fully Compatible | Environment variables parsing (Dev) |
| **Express** | `express` | **MIT** | ✅ Fully Compatible | Local web routing (Dev) |

### Licensing Compliance Requirements:
*   The **MIT License** permits commercial use, modification, distribution, and private use.
*   The **ISC** (Lucide) and **BSD-2-Clause** (Dotenv) licenses are fully compatible with and can be embedded within projects carrying an MIT license, as long as original copyright notices are preserved in the source distributions.
*   The **Apache 2.0** (`@google/genai`) license allows sublicensing of compiled binaries and client scripts under MIT, provided that any modified Apache-licensed source files carry clear notice of modifications and original copyrights.

---

## 📦 GitHub Pages Deployment Guide

This application is built as a fully-decoupled **Single Page Application (SPA)**, meaning it executes entirely in the user's browser without requiring a backend server. This makes it perfect for hosting for free on **GitHub Pages**.

### Step 1: Install `gh-pages` helper (Optional but Recommended)
To deploy automatically via a command-line script, install the `gh-pages` package:
```bash
npm install -D gh-pages
```

### Step 2: Configure `vite.config.ts`
Open `vite.config.ts` and add the `base` property matching your GitHub repository name:
```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: "/maxwells-demon/", // Name of your GitHub Repository
});
```

### Step 3: Add scripts to `package.json`
Add deploy and pre-deploy hooks under the `"scripts"` field of your `package.json`:
```json
"scripts": {
  "dev": "vite --host 0.0.0.0 --port 3000",
  "build": "vite build",
  "preview": "vite preview --host 0.0.0.0 --port 3000",
  "predeploy": "npm run build",
  "deploy": "gh-pages -d dist"
}
```

### Step 4: Run Deploy
Exectute the deployment script in your terminal:
```bash
npm run deploy
```
This compiles the application and pushes the compiled assets directly to the `gh-pages` branch on GitHub, hosting your interactive physics simulator live!

---

## 🛠️ Local Development Setup

To run the simulator locally:

1.  **Clone the repository**:
    ```bash
    git clone https://github.com/<username>/maxwells-demon.git
    cd maxwells-demon
    ```
2.  **Install dependencies**:
    ```bash
    npm install
    ```
3.  **Boot dev server**:
    ```bash
    npm run dev
    ```
    Access the application live at `http://localhost:3000`.
