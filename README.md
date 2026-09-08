# AgentFit

**When should a workflow get an agent?**

Scores economics, reversibility, system access, and autonomy before anyone writes an
orchestration graph.

AgentFit is a local-first decision instrument. You describe a workflow across twenty
published dimensions; it returns an Agent Fit score, a recommended autonomy level, a
system pattern, a control posture, a readiness state, a capacity estimate, an
implementation cost and payback, a risk register, and a concrete next experiment — all
deterministically, with the arithmetic shown.

---

## Product thesis

Teams routinely start from model capability rather than workflow suitability. They see a
task an LLM could plausibly touch and jump straight to "let's build an agent," skipping
the questions that decide whether the thing should exist.

AgentFit encodes one claim:

> **Autonomy is earned by workflow characteristics and controls. It is not granted by
> model capability.**

And one distinction the product refuses to collapse:

> **Agent Fit ≠ Autonomy.**

A workflow can score 78 for fit and still warrant nothing beyond human-approved
execution. The shipped payment-exception example does exactly that: strong economics,
excellent system access, and irreversible actions that move money — high fit, supervised
autonomy, mandatory approval. Raising verification and observability moves the *score*
without moving the *recommendation*, because a gate still holds. That behaviour is the
point, not a rough edge.

The model will also decline to recommend an agent. Two of the six shipped examples do:
month-end reconciliation returns **deterministic automation** (specified well enough that
a model adds nothing), and regulatory sign-off returns **human-led** (the judgment is the
deliverable).

---

## Core concepts

| Concept | Question it answers | Range |
| --- | --- | --- |
| **Agent Fit** | Is this workflow a compelling candidate at all? | 0–100, with a band |
| **Autonomy** | How independently should the system act? | 6-rung ladder, 0–5 |
| **Readiness** | Is the environment prepared to build and run it? | 4 states |
| **Capacity** | What human time could it return, under stated assumptions? | hours/week |
| **Investment** | What does building it cost, and does that repay? | engineer-weeks, months |

These are computed by separate functions. Fit never determines autonomy; autonomy
determines the pattern, the controls, the capacity assumptions, and the pilot design; and
the investment estimate can overrule an otherwise attractive workflow, because a
recommendation to build is not a recommendation until it names a price.

### The autonomy ladder

| Level | Name | The system may |
| --- | --- | --- |
| 0 | Conventional / human-led | Nothing generative — ordinary software, or people |
| 1 | Assist | Read, draft, reason. No system access |
| 2 | Assistive agent | Gather context, call read-only tools, prepare work |
| 3 | Supervised agent | Execute through typed tools, stopping for approval |
| 4 | Bounded agent | Execute independently inside an explicit envelope |
| 5 | Autonomous | Pursue the objective with aggregate oversight only |

Level 5 requires ten separate gates to clear simultaneously. None of the sixteen shipped
archetypes reach it — a test asserts this. A tool that rarely recommends full autonomy is
more trustworthy than one that frequently does.

---

## Scoring methodology

The full methodology is published inside the app (**Method**), including all 27 gates and
their exact thresholds. In brief:

### Agent Fit — 100 points

| Component | Weight | Driven by |
| --- | --- | --- |
| Economic opportunity | 20 | Annual manual hours, repetition, variability |
| Workflow structure | 15 | Rule clarity, input structure, exception rate |
| Technical readiness | 20 | System access, tooling, observability, context coverage |
| Controllability | 20 | Reversibility, verification, feedback, escalation |
| Risk suitability | 15 | Consequence, blast radius, regulation, permissions, data |
| Judgment suitability | 10 | Inverted-U on human judgment × AI necessity |

Three normalisation decisions worth knowing about:

- **Bounded log ramps.** Annual hours map through a log ramp from 40 → 6,000 and case
  counts from 40 → 20,000, both saturating. A hundred thousand cases a week cannot buy
  more than the twenty points the category is worth.
- **Repetition counts separately from hours.** A thousand three-minute cases and ten
  five-hour cases consume the same time; only the first amortises a build.
- **Judgment is an inverted U.** Mechanical work scores *below* the peak, because it
  rarely needs a model at all. Structured professional judgment scores highest. Where
  expert judgment is the deliverable, the component collapses.

### Autonomy — gates, not a weighted average

Each gate names a condition under which independent action is not yet defensible and the
level it permits until met. The recommendation is the **minimum** of every active cap and
a readiness-derived ceiling. One unmet gate holds autonomy down regardless of how strong
everything else is; that asymmetry is deliberate.

### Investment — what building it costs

Effort is estimated from the recommended pattern plus the gaps the assessment already
measured, since the same gaps that hold autonomy down are the ones that cost engineering
weeks to close. Three properties are worth knowing:

- **Always a range**, skewed right. A point estimate would imply precision the model
  cannot have.
- **It prices the recommendation, not a fixed target.** A workflow with no system access
  is *cheaper*, because what the model recommends building is far smaller — the
  integration debt is still itemised so the smaller number does not read as free.
- **Only returned hours are priced.** Latency, consistency, auditability and coverage the
  current process cannot reach are all real reasons to build, and none of them appear
  here. Where upkeep alone outruns the value returned, the answer is "never repaid" rather
  than a large number — those are different findings, and the model distinguishes them
  from "we cannot tell".

Payback is used where an engineering cost is supplied; a currency-free ratio (annual hours
returned per engineer-week invested) is the fallback, and never overrules a figure the
user entered.

### Capability and constraint

Twenty dimensions describe a workflow, but they are not the same kind of thing.
**Capabilities** are things an organisation can decide to build: reachable
context, typed tools, a per-case trace, a correctness check, a rollback path, an
escalation rota, written rules. **Constraints** are properties of the work and
the world: how much judgment a decision genuinely needs, what a mistake costs,
whether a regulator requires a signature.

Only capabilities are ever offered as improvements. Constraints are reported
separately, as explanation for a ceiling rather than as advice — because
"reduce regulatory sensitivity" is not advice, and printing it beside a real
recommendation devalues both. Where every remaining requirement is a constraint,
the product says **there is no path by investment** and names what would have to
change about the workflow instead.

Across the reference workflows, most autonomy ceilings turn out to be structural
rather than investment problems. That is a more useful finding than a list of
improvements nobody can make.

### Grounding — what the result rests on

A blank assessment still produces a complete recommendation, because every
dimension ships with a defensible preset. That is deliberate: the instrument
should respond from the first moment. But presenting an unreviewed result in the
same voice as a reviewed one would be a claim the product cannot support —
"Pilot ready: instrumentation and an exception path exist" is a statement about
someone's organisation, and at zero reviewed values it is a statement about
nothing.

So rather than gate on an arbitrary count, AgentFit identifies the values the
current recommendation genuinely depends on: the economics that drive capacity,
the dimensions named by the gates setting the ceiling and the one above it, the
five values the readiness state reads, and anything whose plausible range would
flip the answer. It then reports how many of those a person has actually looked
at — **provisional**, **partly grounded**, or **grounded** — and offers them as
a ranked list to jump to.

This is a provenance measure, not a confidence one: a preset can be right and
still be unconfirmed. Until it is, the recommendation is rendered without the
accent colour, the readiness claim is qualified, and the decision brief, the
assessment library and portfolio comparison all say so.

### Guided review

Grounding names the values a recommendation rests on. Focus mode hides
everything else. Neither of them helps with the part that is actually hard:
answering twenty questions honestly.

A guided review walks the load-bearing values one at a time, in grounding's own
order — what could flip the answer first, then what sets the ceiling. Each one
is presented as what it is: five published descriptions of a real situation,
exactly one of which is yours. They are radio buttons rather than a slider
position, because "which of these is you" is a different question from "how
much, from one to five".

**The consequence of an answer is shown after it is given, never before.** That
ordering is the whole point. A menu that said *picking 4 gets you a supervised
agent* would turn an honest self-assessment into a shopping list, and this
instrument exists to resist exactly that. Afterwards, the same information
teaches where the model is sensitive without inviting anyone to reverse-engineer
a preferred answer — *"That moved the recommendation up to supervised agent.
Binding constraint: actions are not typed."* Someone who genuinely wants to ask
"what if verification were better" has the Scenario Lab, which is labelled
hypothetical for the same reason.

Three further decisions carry it:

- **"Not sure yet" is always available.** Forcing a guess would corrupt the one
  thing the entire product rests on. Skipping leaves the value at its preset and
  unreviewed, which is exactly what the grounding notice goes on saying.
- **The queue is fixed when the pass starts.** Answering one value genuinely
  changes which others are load-bearing, but re-sorting the queue underneath
  someone makes progress meaningless. The change is reported at the end instead,
  where it reads as something learned rather than as the ground moving.
- **With nothing outstanding, Review becomes a second pass** over the same
  values. "Show me what this rests on" is a reasonable thing to ask of an
  assessment somebody else built.

### Focus mode

Twenty dimensions is the right amount of detail for the model and more than most
assessments need from a reader. Because grounding already knows which values the
current recommendation rests on, the assessment column can show only those —
typically six sliders instead of twenty.

The rule is the union of what is load-bearing and what the user has already
touched, so a slider can never vanish from under the cursor because reviewing it
changed which values matter. Groups with nothing to show collapse to a single
line that still holds its place in the sequence, and any group can be expanded
in place. Nothing is unreachable; the default is simply narrower.

### Addresses and share links

Every state the product can be in has a URL. `#/a/<id>/risk` is one assessment's
risk register; `#/compare/<id>,<id>` is a comparison; `#/assessments` is the
library. Back, forward, reload and bookmarking all work, and the address is
written by state rather than the other way round, so the two can never disagree.

A **share link** (`#/s/<token>`) carries the assessment *itself*, compressed into
the fragment. That is the part of a URL browsers never transmit, so an assessment
can travel to a colleague with no server, no account and no third party holding a
copy — which is the only way sharing could exist in a product with this privacy
posture. A blank assessment costs about 110 characters; a fully worked one with
notes, a recorded decision and a pilot plan stays under 800.

The wire format is deliberately not the storage format: twenty ordinals become a
twenty-character string, `touched` becomes a bitmask, trailing empties are
dropped, and the field order is pinned in `link.ts` rather than borrowed from the
dimension registry, so reordering the UI can never change the meaning of links
already in circulation. A link opens on whichever panel the sender was reading.

The honest limit is stated in the product, not only here: **the link is the
data**. Anyone holding it can read the assessment, it cannot be revoked, and
every place it is pasted keeps a copy. On arrival the recipient sees a banner
saying where it came from, when it was last worked on, and — the part that
actually matters — how many of the values the recommendation rests on the sender
had reviewed.

### The decision record

AgentFit produces a recommendation. It does not make the decision, and a real
team frequently lands somewhere else. The **Decision** tab records what was
chosen, by whom, and why — so the assessment becomes a record rather than a
calculation.

Where a team proceeds at higher autonomy than the model permits, the unmet gates
are named explicitly, so the divergence sits on the record as an accepted risk
rather than an oversight. The model distinguishes *why* it diverges: the gates
genuinely capping lower is a different situation from a level-0 recommendation
that came from the work not needing a model at all — in the second case the
gates may permit far more, and claiming otherwise would be false.

A recorded decision travels with the assessment: onto the printed brief, into
the library, and alongside the recommendation whenever the workflow is compared
against others. It never feeds back into the model — choosing bounded execution
does not make a workflow safer, and the gates keep saying so.

### Where the answer changes

Every assessment sits some distance from a different recommendation. Walking each
dimension away from its current value finds the nearest boundary in every
direction — reported as boundaries rather than goals, since crossing one is
usually something that happens to a workflow rather than something anyone does
on purpose.

This matters most for the workflows the model declines to agentify. "Path to
greater autonomy" is the wrong question for a workflow best served by
deterministic rules, so those get the inverse instead: **what would make this
need a model**, or **what would let this leave a person's hands**. For the
reconciliation example, a single extra exception per twenty cases flips the
answer to a bounded agent — the surrounding systems are already strong enough
that the only reason it is not an agent is that it does not need to be.

### Uncertainty — what the score does not know

Every dimension left at its preset carries about a step of plausible error. Each is moved
one step both ways, the larger fit swing is kept, and the swings are combined in
quadrature — summing them would produce a band so wide it would say nothing.

The more useful output is the second one: whether any unreviewed dimension could change
the *recommendation*. A score that moves four points is noise; a recommendation that flips
between supervised and bounded depending on a value nobody has looked at is a reason to go
and look, and the product says so.

### Capacity — four lines, all shown

```
automated  = covered cases × hours per case × time reduction
review     = covered cases × review rate × review minutes
exceptions = handed-back cases × triage minutes
net        = automated − review − exceptions
```

Defaults are derived from the assessment and the recommended autonomy level; every one is
editable and marked when overridden. The result is **potential capacity returned**, never
"savings" — freed hours become savings only if an organisation removes the cost, which
this tool does not model.

---

## Architecture

Scoring lives entirely outside React, as pure functions over a plain input object.

```
src/
  domain/          types and Zod schemas, the dimension registry, archetypes
  engine/          the decision model — pure, deterministic, independently testable
    normalize.ts     bounded ramps, ordinal normalisation, volume derivation
    fit.ts           Agent Fit score and component breakdown
    autonomy.ts      the ladder, the 27 gates, path-to-next-level
    pattern.ts       system pattern selection
    controls.ts      control posture: required now vs before more autonomy
    readiness.ts     implementation readiness and its blockers
    economics.ts     capacity model and editable assumptions
    explanation.ts   strong signals, limiting factors, "therefore"
    risks.ts         risk register generated from the inputs
    plan.ts          next experiment, pilot design, evaluation metrics
    investment.ts    implementation effort, payback, and whether it repays
    uncertainty.ts   the band the unreviewed dimensions imply
    sensitivity.ts   deterministic perturbation analysis, single and combined
    classify.ts      portfolio classification
    decision.ts      what the team chose, read against what was recommended
    flip.ts          the nearest boundary where the recommendation changes
    review.ts        the guided pass: what to ask, and what an answer did
    portfolio.ts     recommended order of work across several assessments
    program.ts       which capability, built once, moves the most workflows
    assess.ts        the single entry point
  persistence/     Dexie/IndexedDB store, schema migrations, JSON/CSV import-export
  ui/              views and components; no scoring logic
```

Derived results are never persisted as the source of truth. They are recomputed from
stored inputs on every load, so a change to the model is visible immediately and
historical records stay interpretable via their stored `modelVersion`.

### Two versions, deliberately separate

Every assessment carries both a **`modelVersion`** (the scoring methodology that produced
it) and a **`schemaVersion`** (the storage format). They change for different reasons: the
first when the meaning of a score changes, the second when the shape of a record does. A
record can be current on one and historical on the other.

Records are migrated and validated **on read**, never rewritten in place, so a build that
cannot understand a record leaves it intact for a later one rather than destroying it.
Anything unreadable is reported in the interface, not silently dropped. Imports carrying a
foreign model version are accepted and reported rather than rejected.

### Revisions and undo

Every save writes a revision — inputs and notes only, with the model version that was
current at the time; derived figures are recomputed for display. History is capped at 20
entries per assessment. Restoring loads a version into the editor as an unsaved change, so
nothing is overwritten until you save again.

Undo and redo cover the whole editable record and collapse a run of edits to the same
field into one step, so dragging a slider costs one undo rather than twenty.

---

## Local-first and zero-cost

No LLM API, no cloud database, no authentication, no analytics, no network calls at all.
The decision engine is deterministic browser-side logic; assessments live in IndexedDB
and preferences in `localStorage`.

A dependency-free service worker (`public/sw.js`) caches the shell — network-first for
navigations so a new deployment is picked up immediately, cache-first for hashed assets
where a hit can never be stale — so the application runs offline once it has installed.
It is registered only in production builds.

An in-progress assessment is mirrored to `localStorage` continuously, so a refresh never
loses work, while **Save** commits to the library. Editing a shipped example and saving
forks a copy rather than overwriting it.

Sharing follows the same rule. A share link is generated in the browser with
`CompressionStream`, and its payload lives in the URL fragment, which is never sent
to the server hosting the page. There is no upload step and nothing to revoke —
distribution is entirely the sender's, which is stated plainly wherever a link can
be made.

Optional AI enrichment could be layered on later behind an interface, but nothing in v1
requires it.

---

## Running it

```bash
npm install
npm run dev
```

| Command | Does |
| --- | --- |
| `npm run dev` | Vite dev server |
| `npm run build` | Type-check and build to `dist/` |
| `npm run preview` | Serve the production build |
| `npm run typecheck` | `tsc --noEmit`, strict |
| `npm run lint` | oxlint |
| `npm test` | Vitest |
| `npm run check` | typecheck + lint + test |

**Stack:** React 19, TypeScript 7 (strict, `noUncheckedIndexedAccess`), Vite 8,
Tailwind 4, Dexie, Zod 4, Vitest, oxlint. No component library, no charting library, no
animation library — the visualisations are hand-authored SVG and the motion is CSS.

> **Note on linting.** `typescript-eslint` does not yet support TypeScript 7 and refuses to
> load, so linting uses oxlint, which parses TypeScript natively. Type-aware checks are
> handled by `tsc --noEmit`.

### Failure behaviour

- An **error boundary** catches render failures and offers the in-progress draft as a
  download before you reload, plus a "discard the draft and reload" escape for the case
  where a malformed record puts the app into a crash loop.
- Where the browser **refuses local storage** (private mode, blocked storage, quota), the
  instrument still works in full: a banner says so, Save is disabled with an explanation,
  and export remains available.
- The **animated score** only ever overrides the real value transiently. If the frame loop
  never runs — a backgrounded tab, a throttled renderer, reduced motion — the correct
  number is still on screen. A decorative animation must not be able to make a readout
  wrong.

### Deployment

A static build. `vercel.json` is configured for SPA rewrites; any static host works:

```bash
npm run build   # → dist/
```

---

## Testing

262 tests, concentrated on the decision model rather than the UI.

Beyond boundaries and normalisation, the suite asserts the product's actual claims:

- **Fit and autonomy move independently.** Two fixtures differing only in reversibility
  and consequence produce similar fit scores and autonomy levels two rungs apart.
- **A high fit score never forces high autonomy.**
- **Every one of the 27 gates is reachable** — a sweep across all dimension values proves
  none is dead code.
- **The path-to-next-level is sound**: applying the requirements it reports actually
  raises the autonomy level.
- **Monotonicity**: raising failure consequence never raises autonomy; raising
  verification never lowers it.
- **The model declines to recommend agents** for the deterministic and expert-judgment
  fixtures, and marks an economically trivial one low priority.
- **Full autonomy is never recommended** for any shipped archetype.
- **Import validation**: malformed JSON, foreign schemas, out-of-range values, and id
  collisions each behave correctly; CSV export neutralises spreadsheet formula injection.
- **Investment discipline**: the estimate is always a range; a supplied cost figure is
  never overruled by the currency-free ratio; "cannot tell" and "does not repay" stay
  distinct; and a build that is not repaid cannot be classified "build now".
- **Uncertainty**: the band narrows as dimensions are reviewed, stays inside 0–100, and
  flags when an unreviewed dimension sits on a gate boundary.
- **Combined unlock**: where two gates cap at the same level and no single dimension helps,
  the reported combination actually reaches the level it claims.
- **Sequencing**: a cheap deterministic automation can rank ahead of a more ambitious agent
  build, and work whose return does not justify it goes last with the reason stated.
- **Share links round-trip losslessly**: every input, note, decision, risk mitigation
  and pilot edit survives encode → decode, `touched` included; the arrival gets its own
  identity rather than the sender's; a truncated, non-base64url or future-version token
  is refused with a reason rather than read as a plausible wrong answer; and a blank
  assessment stays under 200 characters.
- **Every route round-trips** and every detail panel is addressable; an unknown address
  resolves to the sheet rather than an error; a never-saved assessment refuses to write
  an id nobody could resolve.
- **Guided review**: the queue is exactly what grounding says is outstanding and follows
  its ordering; it shrinks as values are confirmed and empties when they all are; the two
  economics figures are typed as numbers rather than ordinals; an outcome never claims a
  movement that did not happen — swept across five dimensions × five values — and a
  "nothing moved" verdict is only issued when the score and readiness both held.
- **One derivation for one number**: annual manual hours come from the shared
  `deriveVolume`, counting every person who touches a case, so the review card and the
  assessment sheet cannot disagree.
- **Focus mode**: a touched value is never hidden, everything load-bearing is always
  shown, and something is always hidden — a focus mode that hides nothing is a lie.
- **Decision record**: every listed condition is genuinely unmet, a level-0 divergence never
  claims the gates were exceeded, and a decision stays incomplete until someone is
  accountable and the reasoning is written down.
- **Flip points**: every reported boundary changes the recommendation when applied and
  matches the predicted outcome, nothing between the current value and the reported one
  already crosses, and the two leverage lists never name the same dimension twice.
- **Grounding**: a blank assessment is always provisional, the load-bearing set always
  includes the five values the readiness claim reads, and the state agrees whether or not
  uncertainty is supplied.
- **Capability vs constraint**: no constraint is ever ranked as an improvement, a path made
  entirely of constraints is reported as structural rather than as a roadmap, and a level-0
  recommendation is never attributed to whichever gates happen to be active.
- **Portfolio analysis**: every claimed unlock actually happens when applied, one investment
  is reported per dimension rather than one per target value, and every workflow is
  accounted for exactly once between unlocked and unmoved.

---

## Known v1 limitations

- **The archetype defaults are defensible medians, not measurements.** They exist to give
  a starting position; the app marks untouched dimensions as unreviewed and lowers
  confidence accordingly.
- **A guided review is not an interview.** It asks better questions than a form does,
  but nothing checks the answers: the instrument still reports what it was told, and
  says so through grounding and confidence rather than pretending otherwise.
- **Capacity assumptions are assumptions.** The default time-reduction curve by autonomy
  level is a reasonable prior, not evidence. Replace it with your own numbers after a
  pilot — which is what the pilot is for.
- **The Autonomy Field is an orientation device, not the model.** Its bands approximate
  the gate logic on two axes; where the two disagree, the diagram says so and defers to
  the gates.
- **Portfolio classification is a planning recommendation**, not an objective ranking.
- **No collaboration or sync.** Local-first means single-device. An assessment can be
  handed to someone else as a file or a share link, but both are point-in-time copies:
  there is no conflict resolution because there are no concurrent writers, and a link
  made before an edit still describes the older version.
- **A share link cannot be revoked.** It carries the assessment rather than pointing at
  it, so whoever holds the link holds the data and every place it is pasted keeps a copy.
  The product says so wherever a link can be made.
- **Comparisons are addressable but not shareable.** `#/compare/<ids>` names records on
  the sender's device, so the link only resolves for them; a recipient is told which
  assessments are missing rather than shown a silently smaller portfolio.
- **Offline support depends on the service worker installing.** The first visit must
  complete online. There is no install prompt or update toast; a new deployment is picked
  up on the next navigation.
- **Portfolio analysis tests one capability at a time.** It does not search for
  combinations that only pay off together, so two investments that jointly unlock several
  workflows appear as two rows that each unlock none.
- **The capability/constraint split is a documented judgement**, not a derivation. The
  methodology view states the reasoning, including the borderline cases.
- **Sensitivity reports one dimension at a time, plus one exact combination.** Where two
  gates cap at the same level it derives the full set of moves that clears them from the
  gates themselves. It does not search arbitrary combinations beyond that.
- **The effort model is a heuristic, not an estimate of your team.** It is calibrated
  against the reference workflows shown in the Calibration section of the methodology, and
  it prices returned hours only.
- **Not a production authorisation.** The highest readiness state is *production
  candidate*. AgentFit supports workflow discovery and architecture decisions; it does
  not authorise deployment.

---

## Privacy

Your workflow assessments remain on this device unless you explicitly export them. No
account, no telemetry, no third-party requests.
