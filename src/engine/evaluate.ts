import { autonomyBlockers } from "./blockers";
import { MODEL_LABEL, MODEL_VERSION } from "@/domain/model";
import type { AssessmentInputs, EconomicAssumptions, EvaluationResult } from "@/domain/types";
import { fieldPosition, recommendAutonomy, autonomyLabel } from "./autonomy";
import { classifyPortfolio, writeVerdict } from "./compare";
import { controlPostureCopy, recommendControls } from "./controls";
import { normalizeInputs } from "./design";
import { calculateCapacity } from "./economics";
import { explainRecommendation, pathToNextAutonomy } from "./explanation";
import { generateRiskRegister, recommendEvalMetrics, recommendExperiment, recommendPilot } from "./experiment";
import { buildFmea, summarizeDesign } from "./fmea";
import { buildGoNoGo } from "./gates";
import { completeness } from "./normalize";
import { classifyConfidence, classifyReadiness } from "./readiness";
import { architectureFor, recommendPattern } from "./recommendation";
import { conventionalAffinity, scoreFit } from "./score";

export function evaluate(
  inputs: AssessmentInputs,
  assumptions?: Partial<EconomicAssumptions>,
): EvaluationResult {
  const live = normalizeInputs(inputs);
  const breakdown = scoreFit(live);
  const autonomy = recommendAutonomy(live);
  const pattern = recommendPattern(live, autonomy);
  const controls = recommendControls(live, autonomy);
  const readiness = classifyReadiness(live, autonomy);
  const confidence = classifyConfidence(live);
  const capacity = calculateCapacity(live, autonomy, assumptions);
  const risks = generateRiskRegister(live);
  const fmea = buildFmea(live, risks);
  const design = summarizeDesign(live);

  const draft: EvaluationResult = {
    modelVersion: MODEL_VERSION,
    modelLabel: MODEL_LABEL,
    score: breakdown.total,
    breakdown,
    autonomy,
    autonomyLabel: autonomyLabel(autonomy),
    pattern,
    controlPosture: controlPostureCopy(live, autonomy),
    controlsRequired: controls.required,
    controlsBeforeAutonomyIncrease: controls.beforeIncrease,
    readiness: readiness.readiness,
    readinessNote: readiness.note,
    confidence: confidence.confidence,
    confidenceReasons: confidence.reasons,
    capacity,
    explanation: explainRecommendation(live, breakdown, autonomy, pattern),
    pathToNextAutonomy: pathToNextAutonomy(live, autonomy),
    experiment: recommendExperiment(live, autonomy, pattern),
    pilot: recommendPilot(live, autonomy, pattern),
    evaluationPlan: recommendEvalMetrics(live, autonomy),
    risks,
    fmea,
    goNoGo: [],
    design,
    architecture: architectureFor(pattern),
    conventionalAffinity: Math.round(conventionalAffinity(live) * 100) / 100,
    blockers: autonomyBlockers(live, autonomy),
    portfolioClass: "Low Priority",
    completeness: Math.round(completeness(live) * 100) / 100,
    verdict: "",
    field: fieldPosition(live),
  };
  const portfolioClass = classifyPortfolio(draft);
  const withClass = {
    ...draft,
    portfolioClass,
    verdict: writeVerdict({ ...draft, portfolioClass }),
  };
  return {
    ...withClass,
    goNoGo: buildGoNoGo(live, withClass),
  };
}

export function diffEvaluations(current: EvaluationResult, next: EvaluationResult) {
  return {
    score: { from: current.score, to: next.score },
    autonomy: { from: current.autonomyLabel, to: next.autonomyLabel },
    capacity: {
      from: current.capacity.netCapacityReturned,
      to: next.capacity.netCapacityReturned,
    },
    readiness: { from: current.readiness, to: next.readiness },
    pattern: { from: current.pattern, to: next.pattern },
    klass: { from: current.portfolioClass, to: next.portfolioClass },
    verdict: { from: current.verdict, to: next.verdict },
  };
}
