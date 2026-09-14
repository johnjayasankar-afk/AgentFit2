# Improvement log

A running record of what each cycle changed and why, so later work builds on
earlier work instead of relitigating it. Newest first.

---

## Cycle 10 — Labs family: the same instrument, in the family's design language

**Why.** AgentFit sits beside RideLens, RailDrop and Daylight on
labs.johnjayasankar.com, and each of those now shares one design language with
johnjayasankar.com. AgentFit was already closest in spirit (porcelain, graphite,
an editorial sans and a technical mono), so this cycle is a restyle rather than a
redesign. Nothing about the model, the copy, the routes or the interaction changed.

### What shipped

- **Type.** Inter for language and IBM Plex Mono for system labels, self-hosted
  from `src/assets/fonts` so the product still makes no third-party requests.
- **Palette.** Porcelain and forest ink in light, the family's forest night in
  dark. The signal colour moves from rust to the family's sky and stays the
  single accent: the current-state marker, the active rung, nothing decorative.
- **Shape.** Structure still comes from rules, grids and space. Surfaces that
  float (panels, dialogs, the toast) take rounded corners and a soft shadow;
  buttons, tags and segmented controls take pill shapes; the primary action is
  the family's forest gradient, mint in dark.
- **Around the edges.** A faint dot grid behind the page; a family tile for the
  favicon and the header mark; a link-preview card (`public/og.png`, excluded
  from the SPA rewrite in `vercel.json` so it is served as an image); and a
  credit to John Jayasankar and Labs in the footer and on the opening screen.

### Bug the restyle introduced, and the fix

`body` set `font-variant-numeric: tabular-nums` for the whole product. With the
system font that only touched digits. Inter's tabular set also widens the
hyphen, so every hyphenated word read "month - end". Tabular figures now apply
where numbers line up (readouts, numeric fields, tables and the `tabular-nums`
utility) rather than globally.

### Verified

- **The grey ladder was re-solved against the new grounds**, so every step
  still clears 4.5:1 on the worst ground it can land on. Light: 15.7 / 8.9 /
  6.3 / 5.0. Dark: 14.5 / 10.3 / 6.7 / 4.9. The signal is 7.3 in light and 8.3
  in dark at worst, and above 6 on its own soft tint.
- **Measured on the rendered page in both themes.** The library, methodology
  and brief have no text under 4.5:1: lowest 5.34 in light, 4.93 in dark. On the
  assessment sheet the only readings under 4.5 are the six that were there
  before, all deliberately dimmed: the disabled Undo and Redo, and the autonomy
  rungs beyond the recommendation.
- Every selector and layout rule of the previous stylesheet is still present.
- 262 tests pass. Clean typecheck, clean lint, clean production build.
- Screenshots of every view before and after, in light and dark and at 390px:
  no page overflow and no console errors.

---

## Cycle 9 — Guided review: the instrument asks the questions

**The imbalance found.** Eight cycles went into what AgentFit *says*: gates,
grounding, uncertainty, sensitivity, flip points, a pilot plan, a decision
record, a portfolio analysis, share links. Almost none went into the part a user
actually has to do — answer twenty questions honestly. And every single one of
those outputs is worth exactly as much as those answers are.

The product already knew which of the twenty a given recommendation rests on;
that is what grounding has computed since cycle 4. Its entire answer to "help me
review them" was to scroll the relevant slider into view. That is a bookmark,
not help.

The log's top item was portfolio sharing — the natural extension of cycle 8.
Reassessed against the actual product, extending an output for a narrow moment
came second to the input side that eight cycles had neglected.

### What shipped

**A guided review.** The load-bearing values, one at a time, in grounding's own
order — what could flip the answer first, then what sets the ceiling. Each is
presented as five published descriptions of a real situation, exactly one of
which is yours. The assessment column becomes the card; the recommendation panel
stays where it is, so the score and the autonomy level move on the right as you
answer on the left.

The design decision the whole feature turns on: **the consequence of an answer
is shown after it is given, never before.** A menu reading *picking 4 gets you a
supervised agent* would turn an honest self-assessment into a shopping list, and
this instrument exists to resist exactly that. Afterwards the same information
teaches where the model is sensitive without inviting anyone to reverse-engineer
a preferred answer — *"That moved the recommendation up to supervised agent.
Binding constraint: actions are not typed."* The Scenario Lab already exists for
deliberate what-ifs and is labelled hypothetical for the same reason.

Four decisions carry the rest:

- **"Not sure yet" is always available.** Forcing a guess would corrupt the one
  thing the product rests on. Skipping leaves the value at its preset and
  unreviewed, which is exactly what the grounding notice goes on saying.
- **The queue is fixed when the pass starts.** Answering one value genuinely
  changes which others are load-bearing; re-sorting underneath someone makes
  progress meaningless. The change is reported at the end — *"8 more values now
  carry this recommendation"* — where it reads as something learned.
- **Native radios, not styled buttons.** A screen reader announces "3 of 5" and
  the arrow keys move within the group, with no ARIA to keep in sync. The digit
  keys 1–5 answer directly; the arrows are ceded to the group when focus is
  inside it, and page between questions everywhere else.
- **With nothing outstanding, Review becomes a second pass** over the same
  values, headed "Second pass". "Show me what this rests on" is a reasonable
  thing to ask of an assessment somebody else built.

The closing card reports what the pass did — fit before and after, the
recommendation before and after — and its single primary action follows what is
actually left: more values to confirm, or a record not yet written down.

### Second-pass critique, and what it changed

**A real defect, found by reading my own code back.** The review card computed
annual manual hours inline and left `peopleInvolved` out of the sum. A workflow
touched by three people would have reported a third of the hours the assessment
sheet prints from the same inputs — two surfaces disagreeing about one number,
which is worse than either being wrong. It now calls the engine's `deriveVolume`
like every other surface, and a regression test pins the head-count behaviour.

**A product-wide accessibility failure, found by measuring rather than looking.**
The grey ladder was `--muted` 4.29:1 and `--muted-soft` 2.84:1 against paper —
both below WCAG AA, and the quietest tone carries real content across the whole
product: dimension rationales, gate reasons, figure captions, the review card's
own "why". Both tokens were re-solved so that **every step clears 4.5:1 on the
worst ground it can land on** — paper, sunk *or* raised, in both themes — rather
than only on paper. Measured worst case is now 4.55 in each theme, and the
four-step hierarchy survives: 14.8 / 8.6 / 6.1 / 4.6.

Smaller: the load-bearing entry point is withdrawn while a pass is running,
because an invitation to "review 13 values" beside a card reading 01/08 reads as
a contradiction rather than as the model responding; the hint line now matches
the kind of question being asked; the counter stopped wrapping on mobile; and
`fullReviewQueue` stopped being dead code.

### Verified

- **262 tests pass** (up from 246), including 16 new ones: the queue matches
  grounding exactly and follows its ordering, shrinks as values are confirmed
  and empties when they all are; the economics figures are typed as numbers; an
  outcome never claims a movement that did not happen, swept across five
  dimensions × five values; and annual hours scale with head count.
- Clean typecheck, clean lint, clean production build.
- Exercised against the running app: a full eight-value pass driven from the
  keyboard, every outcome kind appearing (recommendation moved, readiness moved,
  score moved); the closing card reading *"Supervised agent, after 8 answers —
  fit 60 → 79"*; continuing into the six values the answers had promoted;
  "Not sure yet" advancing **without** marking the value reviewed, confirmed
  against stored state; Escape leaving the pass with answers kept; the second
  pass labelling itself; arrows inside the anchor group not paging between
  questions; the economics card and the assessment sheet both reporting 15,600
  hours for the same inputs; mobile at 375px with zero overflow; light and dark.
- Contrast measured directly from the rendered tokens against all three grounds
  in both themes.

### Limitations and dependencies

- **A guided review is not an interview.** It asks better questions than a form
  does, but nothing checks the answers; the instrument still reports what it was
  told, and says so through grounding and confidence.
- **Native arrow-key movement inside the radio group is unverified here.** The
  test browser dispatches key events that fire listeners but do not trigger
  user-agent defaults, so what was verified is that the product does not *block*
  it — arrows inside the group no longer page between questions. The selection
  behaviour itself is standard browser behaviour obtained by using real inputs.
- **A review is not addressable.** Like the Scenario Lab it is working state,
  not a place, and it does not survive navigating away. The answers do.
- Console still shows service-worker registration failures, an artefact of the
  test browser pane blocking the worker script.

### Highest-value opportunities next

1. **Share a portfolio, not just an assessment** — still the natural completion
   of cycle 8, and still requiring a notion of *transient* assessments so
   Compare can render records that arrived in a link. Sketch: prefix `C`, an
   array of tuples, `store.transient` unioned into the Compare lookup, and a
   library row offering "add to this device".
2. **A guided review across a portfolio**: walk the values that are load-bearing
   in more than one workflow at once, since those are exactly the ones a
   programme decision turns on.
3. **Decisions across the portfolio**, still unstarted.
4. **Playwright coverage**, which would close the clipboard and native-keyboard
   gaps the test pane creates.

---

## Cycle 8 — Portable: an assessment you can address, and hand to someone

**The problem found.** Two defects showed up within a minute of using the built
product, and they turned out to be the same defect.

The first: the application had exactly one URL. Reloading always landed on the
assessment sheet, the browser's back button left the product entirely, and there
was no way to say "look at the risk register on this one" other than describing
the clicks. This was not theoretical — the dev server dropped its socket during
testing, the page reloaded, and the view I was inspecting was simply gone.

The second: for a product whose whole output is a *shared artefact* — a
recommendation a team is meant to argue with — there was exactly one way to get
an assessment to a colleague. Export a JSON file, send it, ask them to import
it. The log's own next-priority items were more portfolio analysis; a seventh
analysis was plainly not what the product was missing.

Both are the same missing idea: **an assessment had no address.**

### What shipped

**Addresses.** Every state now has a URL, in the fragment: `#/a/<id>/risk`,
`#/compare/<id>,<id>`, `#/assessments`, `#/method`, `#/brief`. Back, forward,
reload and bookmarking all work. The routing rule is one-directional — state is
the source of truth and the address follows it, with back and forward feeding
the address back into state — so the two can never fight. Detail panels moved
into the store on the way, which also put them in the command palette.

Three details carry it:

- **The writer is unconditional.** Keying it to the derived route was the
  obvious implementation and the wrong one: an address that *cannot* be honoured
  changes no state, so the failed address would sit in the bar, reloadable and
  wrong. It now reconciles after every render — a string comparison that writes
  nothing in the common case.
- **Failures are reported and corrected.** A bookmark to a deleted assessment, a
  comparison naming records that are gone, a link truncated in transit: each
  says what happened and the address is replaced in place rather than pushed, so
  no phantom history entry appears.
- **Leaving the opening screen replaces rather than pushes**, because a back
  button that returns to a splash the user already dismissed looks like it did
  nothing at all.

**Share links.** `#/s/<token>` carries the assessment *itself*, compressed into
the fragment — the part of a URL browsers never transmit. Sharing therefore
needs no server, no account, and no third party who gets to read the contents,
which is the only shape sharing could take in a product with this privacy
posture. Measured: a blank assessment is 104 characters of token, a worked one
with notes, a recorded decision, risk mitigations and a pilot plan is 778.

- **The wire form is not the storage form.** Twenty ordinals become a
  twenty-character string, `touched` becomes a bitmask, trailing empties are
  dropped. The field order is pinned in `link.ts` rather than borrowed from the
  dimension registry — that list is ordered for presentation, and reordering it
  later would silently change the meaning of every link in circulation.
- **It refuses what it cannot read.** Truncated, non-base64url, unknown prefix,
  out-of-range ratings, and a future wire version each return a reason instead of
  a plausible wrong answer. A link mangled by a chat client is a normal event and
  deserves a sentence, not a stack trace.
- **A link opens on the panel the sender was reading.** Someone who navigates to
  the risk register before hitting Share has already said what they mean;
  asking again with a second control would be asking twice.

**The arrival.** A recipient gets a banner saying this came from a link, when it
was last worked on, and — the part that matters — how much of it the sender had
actually reviewed: *"at that point none of the 8 values this recommendation
rests on had been reviewed."* A recommendation assembled from presets and one
reviewed by a team who know the workflow are indistinguishable once they are in
a URL, and grounding is the product's own answer to exactly that question. The
banner retires itself the moment the recipient edits or saves, because at that
point it is their assessment, not a delivery.

### Second-pass critique, and what it changed

**The privacy copy had become false.** The library said "Nothing leaves the
device unless you export it" — true before this cycle, not after. Both places
that made the claim now name links as well, and state the limit rather than
burying it: nothing is uploaded, *and* whoever holds the link holds the
assessment. The methodology page gained a "Where the data lives" section saying
the same thing at length. Shipping a sharing feature while leaving a privacy
claim that no longer holds would have been the worst outcome of the cycle.

**The toolbar overflowed on mobile.** Adding Share pushed the button row to
424px inside a 375px viewport — measured, not guessed. It now scrolls
horizontally like the other dense rows in the product, rather than wrapping,
because the separators group the buttons into three kinds of action and wrapping
breaks the grouping wherever the line happens to end.

**The share link was unreadable on a phone.** At 375px the field shrank to a
keyhole showing `http://localhost:5274/#/`. It now has a minimum width and wraps
the copy button onto its own line instead.

Smaller: the sheet's copy confirmation moved from state to a comparison against
the current URL, so it retires itself instead of needing an effect; the
announcement moved off the button into its own live region; `Escape` closes the
sheet; and the sheet's link builder stopped depending on the whole store, which
had it recompressing on every unrelated update.

### Bug fixed

Decoding a corrupt token produced an **unhandled promise rejection**. The stream
writer and the reader both reject when the payload is bad; only the reader was
awaited. Caught by the test suite reporting an error alongside a passing run —
the tests passed, which is exactly how this would have reached production.

### Verified

- **246 tests pass** (up from 220), including 25 new ones: lossless round-trip of
  every input, note, decision, risk edit and pilot edit; `touched` survival; the
  arrival getting its own identity; foreign-model detection; size ceilings; and
  five separate refusal paths. Clean typecheck, clean lint, clean production build.
- Exercised against the production build: back and forward across four views,
  restoring both the address and the view each time; a deep link to one
  assessment's risk register surviving a full page load; a share link produced,
  opened, and reproducing fit 78, "Supervised agent" and 20/20 reviewed; "Save a
  copy" turning a `#/s/…` address into `#/a/<new-id>`; a truncated link, an
  unknown assessment id, and a comparison naming a missing record each reporting
  and correcting the address; a first-time visitor arriving on a share link
  going straight to the assessment rather than the splash; mobile at 375px with
  zero page overflow; light and dark themes.
- Measured: encode 0.17ms, decode 0.23ms, a route round-trip 0.3µs.

### Limitations and dependencies

- **The clipboard write itself could not be verified here.** The test browser
  refuses `navigator.clipboard` outright, so what was exercised was the failure
  path — which correctly selects the field, tells the user to press ⌘C, and does
  not claim to have copied. The success path is unverified in this environment.
- **A share link cannot be revoked**, and a link made before an edit still
  describes the older version. Both are inherent to carrying the data rather
  than pointing at it; the product states them rather than hiding them.
- **Comparisons are addressable but not shareable.** `#/compare/<ids>` names
  records on the sender's device. A recipient is told which are missing rather
  than shown a silently smaller portfolio.
- Console still shows service-worker registration failures, an artefact of the
  test browser pane blocking the worker script.

### Highest-value opportunities next

1. **Share a portfolio, not just an assessment.** The natural completion of this
   cycle, and the place a decision instrument is most often read by people who
   did not build it. The wire format extends easily; the real work is a notion
   of *transient* assessments in the store so Compare can render records that
   arrived in a link and are not on the device. Sketch: prefix `C`, an array of
   tuples, `store.transient` unioned into the Compare lookup, and a library row
   offering "add to this device".
2. **Decisions across the portfolio**, still unstarted: a team systematically
   overruling the model is a pattern no per-assessment view can see.
3. **Combination search** in portfolio analysis and flip points.
4. **Playwright coverage**, which would close both the clipboard gap above and
   the command-palette gap the test pane creates.

---

## Cycle 7 — Focus: making the assessment shorter than the model is deep

**The problem found.** Six cycles of engine work had grown the surface: six deep
tabs, sections numbered 00 to 20, and an assessment column 4,184px tall
containing twenty sliders — 1,373 words on the first screen alone. The log's
next-priority item was another portfolio analysis, but adding a seventh analysis
to a product already this deep is the wrong instinct. The brief asks whether
*simplifying* would produce a better result, and here it plainly would.

Cycle 4 built the machinery to answer this without guessing: grounding already
knows which values the current recommendation actually rests on. It was being
used to *point at* them one jump at a time. It should be able to show only them.

### What shipped

**Focus mode.** A toggle in the assessment toolbar filters the twenty sliders to
the ones carrying the recommendation. On a blank assessment that is twenty
sliders down to six, and 5,861px down to 4,070 — but the real figure is the
number of judgements asked for, which drops from twenty to six.

Three details carry the quality:

- **The rule is a pure union** of what is load-bearing and what the user has
  already touched. That second half is the safety property: a slider must never
  vanish from under the cursor because reviewing it changed which values matter.
  Extracted as `focusKeysFor` and unit-tested, including that it always hides
  *something* — a focus mode that hides nothing is a lie.
- **Groups with nothing to show collapse to a single line** rather than a
  heading, a blurb and a link. `02 STRUCTURE ——— 5 values, none carrying this
  recommendation · + show` holds its place in the numbered sequence, says why it
  is absent, and offers the way back in.
- **Every group can be expanded in place**, per assessment, so nothing is
  unreachable. The preference persists; the expansion does not, and is keyed to
  the assessment id so one workflow's expansions never leak into the next.

### Second-pass critique, and what it changed

The first version left empty groups rendering a full header, blurb and expand
link — about 90px of chrome each for zero content, which undercut the entire
point of the mode. Collapsing them to one line took the focused form from
4,239px to 4,070 and, more importantly, made the skipped sections read as
deliberate rather than as gaps.

The toggle first read "Focused 8", taken from the load-bearing count. But two of
those eight are economics fields rather than sliders, so a reader counting six
sliders would have found the number wrong. It now reports what it hides —
"Focused · 14 hidden" — which is unambiguous and matches what is on screen.

### Bug fixed

The first implementation accumulated revealed keys in a ref read and written
during render — impure, and wrong under StrictMode's double render. The linter
caught it. The accumulation turned out to be unnecessary: `touched` already
covers the case it existed to protect, so the state was deleted rather than
fixed. Group expansion likewise moved from a reset-in-effect to state keyed by
assessment id, removing an effect that existed only to undo itself.

### Verified

- **220 tests pass** (up from 216), including four covering the focus rule:
  touched values are never hidden, everything load-bearing is always shown,
  something is always hidden, and a fully reviewed assessment shows everything.
- Clean typecheck, clean lint, clean production build.
- Exercised against the production build: toggling focus on a blank assessment
  (20 sliders → 6, measured); expanding a collapsed group (6 → 11) and
  collapsing it again (→ 6); a reviewed value staying visible; the preference
  surviving a reload; mobile at 375px with no page overflow.

### Limitations and dependencies

- **Focus filters the twenty 1–5 sliders only.** The definition fields and the
  economics inputs always show. They are few, quick, and two of them are
  load-bearing in every assessment — hiding inputs people expect to find would
  cost more than the space it saved.
- **The mode is off by default.** A first-time user still meets the full
  instrument, which is the right first impression; focus is for the second and
  every subsequent assessment. Whether it should default on after the first
  completed assessment is worth testing rather than assuming.
- **Scroll position is not preserved across the toggle**, so switching modes
  mid-form can move the reader. Acceptable for a deliberate action, but not
  invisible.
- Console still shows service-worker registration failures, an artefact of the
  test browser pane blocking service workers.

### Highest-value opportunities next

1. **Decisions across the portfolio.** With decisions recorded in cycle 6,
   Compare could surface a team systematically overruling the model — a pattern
   no per-assessment view can see.
2. **Combination search**, still unstarted, still wanted in both the portfolio
   view and flip analysis.
3. **Grounding in the portfolio analysis**, which still weights provisional and
   reviewed assessments equally in "what to build once".
4. **Playwright coverage**, which would also close the command-palette
   verification gap the test pane creates.

---

## Cycle 6 — Decide: recording what the team actually chose

**The gap found.** Three cycles of engine depth had left one thing untouched:
AgentFit says what *it* thinks and never lets the team say what they **chose**.
The original brief names five layers — Define, Diagnose, Recommend, Stress Test,
**Decide** — and the fifth had no home in the product. A recommendation nobody
acted on and a recommendation a team deliberately overruled looked identical in
the library, in comparison, and in the exported brief.

That matters most in the case the product exists to serve: a team proceeding at
higher autonomy than the model permits. Without a record, the divergence is
indistinguishable from never having read the assessment.

### What shipped

**1. A decision record (`src/engine/decision.ts`, schema v3 + migration).**
Status (not decided / proceeding / deferred / declined), the autonomy level
actually chosen, an accountable owner, the date, the reasoning, and when to
revisit. A sixth deep tab — **Decision** — completes the brief's stated five
layers.

**2. Divergence is read, not judged.** Where a team proceeds above the
recommendation, the model names precisely which gates are unmet at the chosen
level, so the divergence lands on the record as an *accepted risk* rather than
an oversight. For payment exception at bounded execution that is three
conditions, each with the specific value behind it.

Crucially it distinguishes *why* it diverges, which is not always the gates:

- **gated** — the gates genuinely cap lower; the unmet conditions are listed.
- **unnecessary** — a level-0 recommendation from the work not needing a model.
  The gates may permit far more, so claiming the team exceeded what the model
  permits would be false. What they are accepting is the cost of a system the
  work may not need.
- **judgment** — the work was meant to stay with people.
- **conservative** — below the recommendation, which the model does not object
  to, since the gates set a ceiling rather than a target.

**3. Propagated to every surface**, on the same principle as cycle 4: the brief
(under the headline figures, before the recommendation, with the accepted
conditions and in the copyable text), the library (status marker), and Compare
(a Decision row showing decided against recommended).

**4. Auto-sizing textareas (`AutoTextarea`).** The generated pilot fields ran
longer than their two rows and sat clipped behind scrollbars a few pixels tall —
content the product wrote itself, which had to be scrolled to be read. Now
applied to the pilot fields, risk mitigations, notes and the decision rationale.
Verified: 7 fields on the Plan tab, 0 clipped, where objective and scope were
previously cut off.

### Bugs found and fixed

- **The decision never persisted.** `fingerprint()` — which decides whether a
  record is dirty — did not include `decision`, so editing one left the button
  reading "Saved" and the work was silently lost on the next navigation.
  Confirmed against IndexedDB: six records, all `undecided`, no fork created.
  Now included, and re-verified: the fork is written with the decision at schema
  v3.
- **Undo could not restore a decision.** The history snapshot captured input and
  notes only, while `setDecision` called `remember`. Snapshots now carry the
  decision, and undo/redo restore it.
- **"22/20 reviewed"** in the toolbar — a bug I introduced in cycle 4 by adding
  the two economics keys to `touched` while the counter compared against a
  hardcoded 20. Now counts dimension keys against `ALL_DIMENSION_KEYS.length`.

### Second-pass critique, and what it changed

Two gates in the payment exception example both rest on reversibility, so the
accepted-conditions list showed *Reversibility 2 → 3* twice — three problems
where there is one. Requirements are now named once across the list while each
gate keeps its own distinct reason. In the brief this left a dangling em-dash on
a condition whose requirement had been deduped away; the separator is now
conditional.

### Verified

- **216 tests pass** (up from 200), including 16 new decision tests: every
  listed condition is genuinely unmet, each divergence kind gets a note that
  fits it, a level-0 "unnecessary" divergence never claims the gates were
  exceeded, requirements are named once across the list, and the record is
  incomplete until someone is accountable and the reasoning is written down.
- Clean typecheck, clean lint, clean production build.
- Exercised against the production build: recording a decision above the
  recommendation and reading the accepted conditions; **persistence confirmed by
  querying IndexedDB directly** rather than trusting the UI; the decision
  appearing in the brief, library and Compare; auto-sized fields measured as
  unclipped; mobile at 375px with no page overflow.

### Limitations and dependencies

- **Revisions do not capture the decision.** History snapshots inputs and notes,
  so restoring an old revision leaves the current decision in place. Defensible —
  the decision is metadata about the record rather than an input to the model —
  but it means the timeline does not show how a decision changed.
- **The decision does not feed the model, by design.** It is recorded alongside
  the recommendation, not fed back into it: a team choosing bounded execution
  does not make the workflow safer, and the gates should keep saying so.
- **The command palette could not be visually confirmed.** ⌘K demonstrably opens
  it (the handler's `preventDefault` fires and the markup mounts), but it is
  built on a native `<dialog>` with `showModal()` and the test browser pane
  closes it between tool calls. Its structure was reviewed in source.
- Console still shows service-worker registration failures, an artefact of the
  test pane blocking service workers.

### Highest-value opportunities next

1. **Decisions across the portfolio.** With decisions recorded, Compare could
   show where a team is systematically overruling the model — several workflows
   proceeding above recommendation is a pattern worth surfacing, and none of the
   per-assessment views can see it.
2. **Combination search**, still unstarted and still wanted in two places: the
   portfolio view and flip analysis.
3. **Grounding in the portfolio analysis**, which still weights provisional and
   reviewed assessments equally in "what to build once".
4. **Playwright coverage**, which would also close the command-palette
   verification gap the test pane creates.

---

## Cycle 5 — Serving the "don't build an agent" answer properly

**The problem found.** I exercised the Scenario Lab end to end for the first
time — the original brief called it the most differentiated feature and I had
only ever seen its empty state. The scenario mechanics turned out to be sound.
What was not sound was the rest of the Stress panel for a workflow the model has
just told you *not* to agentify.

Opening month-end reconciliation, whose recommendation is deterministic
automation, the panel offered:

> **Path to greater autonomy — To reach assist.** No gate is holding this
> workflow back.

Framing "reaching assist" as the goal inverts the product's own thesis. The
whole point of that recommendation is that a model is unnecessary. And below it,
Sensitivity listed seven rows that each said "moves the score without changing
the recommendation" — a ranking of nothing.

The product handles "this should get an agent" well. It degraded exactly where
the brief says it matters most: *sometimes the correct recommendation is do not
agentify this, and that is essential.*

### What shipped

**1. Flip-point analysis (`src/engine/flip.ts`).** For any assessment, the
nearest boundary in every direction: walk each dimension away from where it sits
and find the first value at which the recommendation is no longer the same one.
Reported as boundaries rather than goals — crossing one is usually something
that happens to a workflow, not something anyone does on purpose.

**2. The Stress panel now asks the right question of a level-0 workflow.**
Where the recommendation is deterministic automation or human-led, "Path to
greater autonomy" is replaced by **"Where the answer changes"** — titled *What
would make this need a model* or *What would let this leave a person's hands*.
For reconciliation it reports that a single extra exception per twenty cases,
or one step of judgment, flips the answer to a bounded agent: the surrounding
systems are already strong enough that the only reason it is not an agent is
that it does not need to be. That is a genuinely useful finding, and the panel
previously had no way to say it.

**3. A nearest-boundary line for laddered recommendations.** Levels 1–5 keep the
path view and gain one line naming how close the recommendation sits to
changing. A supervised recommendation that becomes assistive if system access
slips one step is fragile, and nothing said so before.

**4. Sensitivity now admits when it has nothing to say.** Where no listed
capability unlocks a level, clears a gate, or returns meaningful capacity, the
list is replaced by a sentence saying so. Seven rows that each say "moves the
score without changing the recommendation" is worse than one honest paragraph.

### Bug fixed

**The leverage lists overlapped.** `highest` took the first four investable
dimensions and `lowest` the last three — so with fewer than seven, the same
dimension appeared in both. Reconciliation showed *Reversibility* under both
"highest leverage" and "lower leverage", which reads as a rendering fault and
undermines the ranking it exists to explain. Now disjoint by construction, with
tests covering the sparse case.

### Second-pass critique, and what it changed

Reviewing the new section, all five boundaries for reconciliation reported the
same outcome — five identical "BOUNDED AGENT" labels down the right column.
Saying it once above the list and dropping the column reads better and makes the
list itself legible; where boundaries lead to different answers, per-row labels
return. Verified in both modes.

The scenario Effect table also showed five rows of `69→69` before anything had
been changed. First attempt added an explanatory line *above* the noise, which
was worse — a message and the thing it was meant to replace. The table is now
hidden until something differs.

### Verified

- **200 tests pass** (up from 189), including 9 new flip-point tests: every
  reported boundary changes the recommendation when applied and matches the
  predicted outcome, nothing between the current value and the reported one
  already crosses, ordering is nearest-first, and each dimension is named once.
  Plus 2 tests pinning the leverage lists disjoint, including when almost
  nothing is investable.
- Clean typecheck, clean lint, clean production build.
- Exercised against the production build: the Scenario Lab end to end — starting
  a scenario, changing exception rate 2→4 and watching reconciliation flip from
  *Conventional automation* to *Supervised agent* with controls going 2→9; the
  new boundary section in both single-outcome (reconciliation) and multi-outcome
  (regulatory sign-off) modes; the laddered path plus nearest-boundary line on
  support triage; all five deep tabs at 375px with no page overflow.
- **Engine performance measured**, since flip analysis adds ~160 evaluations per
  input change: assess 0.09 ms, uncertainty 1.03 ms, sensitivity 0.57 ms, flip
  1.11 ms, all together 2.10 ms. Comfortably inside a frame budget, and the
  Stress computations only run when that tab is mounted.

### Limitations and dependencies

- **Flip analysis moves one dimension at a time.** Two changes that only cross a
  boundary together are invisible to it — the same limitation the portfolio
  analysis has, and for the same reason.
- **The boundary list is capped at six entries.** For assessments sitting near
  many edges the tail is not shown; the summary sentence names how many steps
  the nearest is, but not how many boundaries exist in total.
- **"Where the answer changes" replaces the path only at level 0.** Levels 1–5
  get the one-line summary. That is a deliberate split — the gate-based path
  carries reasons the flip view does not — but it does mean two different
  framings of a related idea live in the same panel.
- Console still shows service-worker registration failures, an artefact of the
  test browser pane blocking service workers.

### Highest-value opportunities next

1. **Combination search**, now wanted in two places: the portfolio view (which
   capabilities only pay off together) and flip analysis (which pairs of changes
   cross a boundary together). One implementation could serve both.
2. **Grounding in the portfolio analysis itself.** Compare warns that inputs are
   provisional but still weights every workflow equally in "what to build once".
3. **Effort estimates for portfolio capabilities**, turning "lift: 5 steps" into
   the engineer-weeks the per-assessment investment model already produces.
4. **Playwright coverage.** Browser verification remains manual, and the test
   pane's throttling makes scroll events, transitions and pseudo-element styles
   unobservable.

---

## Cycle 4 — Grounding: saying what the result rests on

**The problem found.** Walking the cold-start path — "Start assessment", nothing
entered, 0 of 20 dimensions reviewed — the panel confidently asserted:

> Agent fit **60**. Recommended autonomy: **Assistive agent**. Control posture:
> read-only execution, **6 controls required now**. Readiness: **Pilot ready —
> instrumentation and an exception path exist.**

The last one is a statement about the user's organisation, made on the basis of
nothing. Cycle 3 removed the model's habit of recommending things nobody can do;
this was the same overreach one layer up — asserting things it could not know.
The existing hedges (a ± band, "Low" confidence) were small print beside a very
large number.

### What shipped

**1. A grounding measure (`src/engine/grounding.ts`).** Rather than gate on an
arbitrary review count, it identifies the values the *current* recommendation
actually depends on:

- the economics that drive capacity (volume, time per case),
- every dimension named by a gate binding now or at the next rung,
- the five values the readiness state reads,
- anything whose plausible range would flip the answer.

It then reports how many of those a person has confirmed — **provisional**,
**partly grounded**, or **grounded**. That is a *provenance* measure, not a
confidence one: a preset can be right and still be unconfirmed. The set runs 8
to 16 values depending on the workflow, so "grounded" cannot be claimed by
touching two sliders.

**2. The accent is now earned.** A provisional recommendation renders in muted
ink rather than the signal colour, the readiness claim is explicitly qualified as
asserted from presets, and a notice sits *above* the score — a reader who takes
the number and leaves has passed it first. Once grounded it collapses to a single
quiet line.

**3. "Start here" — a ranked, clickable path into the assessment.** The notice
lists the unreviewed load-bearing values, volatile ones first, each with the
reason it matters *to this assessment*. Clicking scrolls to the value, focuses
the control, and marks it briefly. This turns the cold start from "here is a
confident answer to a question you have not asked" into "here is what I would
need to know, in priority order".

**4. Documented in the methodology view**, alongside the other measures, because
the product's claim about its own epistemics belongs on its transparency surface
rather than only in a README.

**5. Propagated to every surface that presents a result.** A provisional brief
exported into a strategy document, or a provisional assessment silently included
in a portfolio comparison, carries exactly the same overreach. So:

- the **decision brief** shows the state under the title, before any figures,
  and includes it in the copyable text;
- the **library** marks provisional rows;
- **compare** names which selected assessments are provisional and what that
  means for the ordering, the matrix and the programme recommendation.

Finishing the idea across surfaces was chosen over starting the portfolio
combination search that this log previously ranked first — a half-applied
honesty measure is worse than none.

### Second-pass critique, and what it changed

Reviewing my own work, the "Start here" list was not genuinely ranked — it
preserved insertion order, so a forward-looking gate that would only bind one
level up could appear above a value setting the ceiling right now. A list with
that heading has to be ordered, so load-bearing values now carry an explicit
priority: values that could flip the answer, then those binding now, then the
economics, then readiness inputs, then the next rung. A value filling several
roles reports the most urgent one. Two tests pin the ordering.

The list also said "and 4 more below", which was spatially wrong — the values
are in the form to the left, not below.

### Also fixed

- Economics edits (volume, time per case) are now tracked as reviewed at all;
  previously nothing recorded whether the numbers driving every capacity figure
  had been touched.
- The section strip counted Economics as "0 of 1", ignoring volume and duration.
  Now "0 of 3", consistent with what grounding tracks.
- The decision brief rendered a "Limiting factors" heading with nothing under it
  whenever the list was empty — a rendering failure on a document meant to be
  shared. Empty lists now omit their heading.
- The lazy-view loading fallback collapsed page height, jumping the footer to
  the top of the window on every view change. It now holds roughly a screen.
- Shipped examples seed as reviewed on the economics values too, so they no
  longer read as partly grounded.

### Verified

- **189 tests pass** (up from 168), including 21 new grounding tests: blank is
  always provisional, the readiness inputs are always in the set, gates one rung
  up are included and distant ones are not, the set never repeats a value, and
  the cheap list-context variant agrees with the full one on provisional and
  grounded.
- Clean typecheck, clean lint, clean production build.
- Exercised against the production build in a browser: cold start on a genuinely
  empty database, naming and saving a new assessment, the reveal interaction
  (verified focus lands on the correct slider by its `aria-valuetext`, and the
  highlight renders — confirmed by screenshot after an earlier `getComputedStyle`
  read proved unreliable in the non-compositing pane), the state resolving from
  provisional to partly grounded on first edit, the library marker, the compare
  warning, the brief notice, light and dark themes, and mobile at 375px with no
  page overflow.

### Limitations and dependencies

- **The load-bearing set is a model of what matters, not a proof.** It is derived
  from the gates, the readiness inputs and the uncertainty analysis; a value
  outside it can still change the answer once other values move, because the
  dependency set itself shifts as the assessment changes.
- **"Grounded" does not mean correct.** It means every value the result leans on
  has been looked at. The copy is careful about this, but it is a distinction a
  hurried reader could still miss.
- **On mobile the notice sits below the form**, since the layout stacks inputs
  first. A user filling the form top-down reaches it having already reviewed
  things, so the ordering is defensible, but it is not the desktop reading order.
- **Console shows service-worker registration failures** in the test browser
  pane, which blocks service workers; and a `beforeunload` notice, which is
  Chrome declining the unsaved-changes dialog for automated navigation without a
  user gesture. Neither reproduces in ordinary use.

### Highest-value opportunities next

1. **Combination search in the portfolio view.** Still the biggest gap in the
   programme analysis, and still unstarted: two capabilities that only pay off
   together currently show as two rows that each unlock nothing.
2. **Grounding in the portfolio analysis itself.** Compare now warns that inputs
   are provisional, but "what to build once" still weights every workflow
   equally. Weighting or excluding provisional assessments would make the
   programme recommendation as careful as the warning above it.
3. **Effort estimates for portfolio capabilities**, turning "lift: 5 steps" into
   the engineer-weeks the per-assessment investment model already knows how to
   produce.
4. **Playwright coverage of the primary journey.** Browser verification remains
   manual, and the pane's timer/scroll/compositing throttling makes several
   things unobservable — scroll events are never dispatched, and pseudo-element
   styles read stale.

---

## Cycle 3 — Capability vs constraint, and the portfolio question

**The problem found.** Before this cycle, the single highest-leverage
"improvement" AgentFit offered for the access-provisioning workflow was
**"Regulatory sensitivity 4 → 3"**. For regulatory sign-off it was **"Human
judgment 5 → 4"** and **"Failure consequence 5 → 3"**.

Nobody can decide to make a regulated decision less regulated, or make expert
judgment less necessary. A tool built entirely on the claim that *autonomy is
earned by workflow characteristics and controls* was recommending that users
change the characteristics — which is the one thing they cannot do. This was the
worst thing in the product, because it undermined the credibility everything
else rests on.

### What shipped

**1. Every dimension is now classified as capability or constraint.**
A `nature` field on the dimension registry (12 capability, 8 constraint).
Capabilities are things an organisation can decide to build — reachable context,
typed tools, a per-case trace, a correctness check, a rollback path, an
escalation rota, written rules. Constraints are properties of the work and the
world — how much judgment a decision needs, what a mistake costs, whether a
regulator requires a signature.

The distinction now runs through four places that previously conflated them:

- **Sensitivity** ranks only capabilities as improvements. Constraints appear in
  a separate "load-bearing constraints — not improvements" list, as explanation
  for the ceiling rather than as advice.
- **Path to greater autonomy** tags each requirement, renders constraints as
  `fixed`, and when *every* remaining requirement is a constraint the heading
  becomes **"There is no path by investment"** rather than presenting an
  impossible list as a roadmap.
- **Combined unlock** only composes capability moves, and reports
  `reachable: false` with a named `blockedBy` when constraints hold the level
  down regardless of investment.
- **Decision brief** marks fixed blockers in both the rendered and copyable
  output.

The most valuable consequence: across the reference set, most autonomy ceilings
turn out to be **structural, not investment problems**. Only scheduling can be
unlocked by building things. That is a far more useful finding than the old
"improve reversibility and regulatory sensitivity".

**2. Portfolio capability analysis — "What to build once".**
A new engine module (`src/engine/program.ts`) and a section in Compare. A single
assessment answers what would have to change for one workflow; across a
portfolio the more valuable question is the inverse — which one capability,
built once, moves the most workflows at the same time.

It reports, for a four-workflow portfolio, a sentence like:

> **Verification** is the highest-leverage investment across these 4 workflows.
> Raising it to 4 would move 2 of 4 to a higher autonomy level and return about
> 18 more hours a week. *Regulatory sensitivity caps 2 of them regardless, and
> is not something to build.*

Alongside it: capabilities that add throughput but change no recommendation
(separated, so they do not dilute the headline), **shared constraints** capping
more than one workflow, and workflows **not moved by any single investment** —
split into *sequencing* (needs several capabilities together) and *structural*
(held by the nature of the work), because those imply completely different
responses.

**3. Assessment navigation.** The assessment column runs to roughly 4,100px with
no way to answer "where am I" or "what have I not looked at". Added a sticky
section strip with per-group review ticks and jump links. The active-section
decision is a pure function (`activeSection`) so it is unit-tested rather than
eyeballed.

### Verified

- **168 tests pass** (up from 152), including new suites for the
  capability/constraint split, portfolio analysis, path honesty, and the
  navigation strip's active-section logic.
- Clean typecheck (`tsc --noEmit`), clean lint (oxlint), clean production build.
- Exercised in a browser against the production build: the program view with a
  four-workflow portfolio, the corrected sensitivity and path views on access
  provisioning, light and dark themes, and mobile at 375px (no page overflow;
  the comparison table scrolls inside its own container).
- Console clean apart from service-worker registration failures, which are an
  artefact of the test browser pane blocking service workers.

### Limitations and dependencies

- **The capability/constraint assignment is a judgement call**, not a derivation.
  It is documented in the methodology view including the reasoning for the
  borderline cases: exception rate and review cost sit on the capability side
  because both are reducible by work; blast radius sits on the constraint side
  because narrowing it means re-scoping the workflow, which produces a different
  assessment rather than a better one.
- **The portfolio analysis tests one capability at a time.** It does not search
  for combinations that only pay off together, so a pair of investments that
  jointly unlock several workflows will show as two rows that each unlock none.
  The per-assessment combined unlock does handle this for a single workflow.
- **Effort is proxied by ordinal steps**, not estimated. "Lift" is the total
  ordinal distance across workflows needing it — deliberately not presented as
  engineer-weeks, because summing per-workflow build estimates would imply a
  shared programme that may not exist.
- **The sticky strip's active-section highlight was not observed end to end.**
  The test browser pane dispatches no scroll events for programmatic scrolling
  (verified: a probe listener saw zero). The decision logic is unit-tested and
  the sticky positioning was verified by measurement.

### Highest-value opportunities next

1. **Combination search in the portfolio view.** The single biggest gap left in
   the new analysis. Searching pairs of capabilities would find programmes that
   only pay off together — likely common, since most ceilings need several gates
   cleared at once.
2. **Sequencing the programme.** The view says what to build; it does not say in
   what order, or what becomes possible after each step. A dependency-aware
   ordering ("build verification, then three workflows become bounded-eligible,
   at which point rollback unlocks two more") would be the natural next layer.
3. **Effort estimates for capabilities.** The per-assessment investment model
   already prices integration, tooling, instrumentation and verification in
   engineer-weeks. Extending that to portfolio capabilities would turn "lift: 5
   steps" into something a budget conversation could use.
4. **Playwright coverage of the primary journey.** All browser verification is
   currently manual, and the pane's timer/scroll throttling makes some
   interactions unobservable. A real headless browser would close that gap.

---

## Cycles 1–2 — Foundation (recorded retrospectively)

Cycle 1 rebuilt the product from a vanilla static page into a React/TypeScript
decision instrument: the domain model, the deterministic scoring engine (fit,
autonomy gates, pattern, controls, readiness, capacity), the assessment
workspace, library, comparison, methodology and printable decision brief.

Cycle 2 added the investment model (what building costs, and whether capacity
repays it), score uncertainty from unreviewed dimensions, exact combined unlock,
portfolio sequencing, undo/redo, revision history, schema migrations, an error
boundary that preserves the in-progress draft, and degraded-storage handling.

Both are documented in `README.md`, which remains the reference for the
methodology and architecture.
