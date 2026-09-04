# AgentFit

**When should a workflow get an agent?**

AgentFit scores economics, reversibility, system access, and autonomy before anyone writes an orchestration graph.

It exists because teams routinely jump from “an LLM could probably help here” to “we should build an agent” without doing the product work required to decide whether agentic software is actually appropriate.

## Product thesis

**Autonomy is a product decision, not a model-size decision.**

A more capable model does not automatically justify more autonomy. Autonomy should increase only when the workflow’s economics, system access, reversibility, verification, failure consequence, and operating controls support it.

Agent Fit is opportunity. Autonomy is a separate control decision. A high-volume payment exception process can score highly and still require supervised execution.

## What it produces

Every assessment returns:

1. **Agent Fit Score** (0–100) — opportunity and suitability for an agentic implementation
2. **Autonomy recommendation** — Conventional Software → Copilot → Assistive → Supervised → Bounded → Autonomous
3. **What caps autonomy** — up to four ordered constraints (consequence, access, verification, policy, conventional automation, and others)
4. **Portfolio class** — Build Now / De-risk First / Assist Don't Agentify / Automate Conventionally / Low Priority
5. **Verdict** — one-line decision that refuses to collapse fit into autonomy
6. **Control posture** — what must exist before the recommended autonomy is credible
7. **System pattern** — from deterministic automation to supervised tool agent
8. **Economic / capacity hypothesis** — potential hours returned under stated assumptions
9. **Risk profile** — generated from the scored dimensions
10. **Readiness** — Not Ready / Discovery / Pilot / Production Candidate
11. **Recommended next experiment** — including success criteria and a concise pilot design

AgentFit will sometimes recommend **conventional software** or **human-led work**. That is a feature.

It supports discovery and system design. **It does not authorize production deployment.**

## Core concepts

| Measure | Meaning |
| --- | --- |
| Agent Fit | How promising the workflow is for agentic implementation |
| Autonomy | How independently a system should act |
| Blockers | Why independence is capped *here*, independent of score |
| Class | Roadmap priority — not a second Agent Fit score |
| Verdict | The one-line decision the rest of the instrument exists to support |
| Readiness | Whether the implementation environment could support a prototype or limited pilot |
| Capacity | Potential human time returned, given coverage and review assumptions |

Capacity is **potential time returned**, not savings, unless the user explicitly models realized savings.

Portfolio classes (library / compare) are a separate prioritization lens: Build Now, De-risk First, Assist Don't Agentify, Automate Conventionally, Low Priority.

## Architecture

Five conceptual layers, one instrument:

1. **Define** — workflow, economics, archetype
2. **Diagnose** — structure, systems, risk, human-in-the-loop
3. **Recommend** — fit, autonomy, blockers, pattern, controls, readiness
4. **Stress test** — Scenario Lab and sensitivity
5. **Decide** — decision brief, pilot design, export

```
src/
  domain/        types, model version, weights
  engine/        score, autonomy, blockers, economics, readiness, controls
  data/          presets and dimension copy
  persistence/   Dexie / IndexedDB, import/export
  state/         preferences, hash routes, session scratch
  ui/            instrument interface
```

The decision engine is deterministic, explainable, and independent of the UI. Calculations are pure functions. Scoring model version `1.0` is stored on every assessment so later methodology changes remain interpretable. The product shell is v4.1.

## Scoring methodology (Model 1.0)

Weights before conventional-automation penalty:

| Category | Points |
| --- | --- |
| Economic opportunity | 20 |
| Workflow structure | 15 |
| Technical readiness | 20 |
| Controllability | 20 |
| Risk suitability | 15 |
| Human judgment suitability | 10 |

Risk suitability awards more points when consequence, blast radius, and regulatory pressure are lower. High exception rate and irreducible expert judgment reduce autonomous readiness.

A conventional-automation penalty applies when rules are extremely clear, inputs are structured, and generative interpretation is unnecessary.

Autonomy uses a **separate** decision function with a conservative ceiling. Full autonomy is rare by design. Most enterprise workflows should land at Copilot, Assistive, or Supervised.

Open **Method** in the app for dimension definitions and the autonomy ladder.

## Local-first persistence

- Assessments live in IndexedDB (`agentfit`) via Dexie
- Theme, first-run, and last-opened id live in `localStorage` (`agentfit.prefs.v1`)
- Unsaved work is snapshotted to `sessionStorage` (`agentfit.scratch.v1`) so a refresh does not discard the tab
- Hash routes: `#assess` `#assess/brief` `#library` `#compare` `#matrix` `#method` `#data`. Print / PDF from Brief isolates the decision brief.
- No account, no telemetry, no cloud backend
- Export JSON / CSV; import never silently overwrites — colliding IDs are copied
- Data → Delete all assessments clears this browser’s IndexedDB and scratch

Your workflow assessments remain on this device unless you explicitly export them.

## Stack

React 19, TypeScript, Vite, Tailwind CSS v4, Dexie, Zod, Vitest, vite-plugin-pwa.

No LLM API. No hosted database. No authentication provider.

## How to run

```bash
cd agentfit
npm install
npm run dev
```

Open the printed local URL (typically `http://localhost:5173`).

## How to build

```bash
npm run build
npm run preview
```

The production build is a static PWA. Deploy the `dist/` folder to any static host. Configure SPA fallback to `index.html`.

## Testing

```bash
npm test
npm run typecheck
npm run lint
```

Engine tests cover score vs autonomy separation, conventional automation, human-led compliance work, capacity without loaded cost, autonomy blockers, portfolio classification and verdicts, import robustness, and the canonical presets.

## Keyboard

| Shortcut | Action |
| --- | --- |
| `⌘K` / `Ctrl+K` | Command palette |
| `⌘S` / `Ctrl+S` | Save assessment |
| `⌘N` / `Ctrl+N` | New assessment (ignored while typing) |
| `⌘L` / `Ctrl+L` | Library |
| `⌘E` / `Ctrl+E` | Export current JSON |
| `1`–`8` | Recommend / Design / Scenario / Sensitivity / Pilot / Risks / Gates / Brief |
| `?` | Method |
| `Esc` | Close palette / dialog |

Themes cycle from the header, Data, or palette: split (porcelain / carbon) → carbon → porcelain. Fonts are self-hosted for offline / local-first use.

## Known limitations

- Local-first only. There is no multi-device sync or hosted sharing.
- Coverage, time reduction, and review minutes are editable hypotheses, not measured outcomes.
- Production Candidate means the *model* of the environment looks prepared. It is not a go-live decision.
- Scoring weights may change in later model versions; historical records keep `modelVersion` and are re-evaluated on read against the current engine.
- Optional future AI enrichment is architected out of the core path and is not required.

## License

Private — all rights reserved.
