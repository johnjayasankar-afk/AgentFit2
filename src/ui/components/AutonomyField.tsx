import type { EvaluationResult } from "@/domain/types";

export function AutonomyField({
  result,
  scenario,
}: {
  result: EvaluationResult;
  scenario?: EvaluationResult | null;
}) {
  const x = 88 + result.field.x * 624;
  const y = 112 + (1 - result.field.y) * 120;
  const ghostX = scenario ? 88 + scenario.field.x * 624 : x;
  const ghostY = scenario ? 112 + (1 - scenario.field.y) * 120 : y;
  const zone = result.field.zone;

  return (
    <div
      className="machine"
      role="img"
      aria-label={
        scenario
          ? `Autonomy field. Current zone ${zone}. Scenario ghost shown.`
          : `Autonomy field. Current zone ${zone}.`
      }
    >
      <svg viewBox="0 0 800 320" preserveAspectRatio="xMidYMin meet">
        <text className="m-title" x="28" y="24">
          Autonomy field
        </text>
        <text className="m-k" x="28" y="44">
          {`Current  ·  ${result.autonomyLabel}`}
        </text>
        {scenario ? (
          <text className="m-k" x="28" y="62">
            {`Scenario  ·  ${scenario.autonomyLabel}`}
          </text>
        ) : null}
        <text className="m-num" x="772" y="38" textAnchor="end" fontSize="28">
          {result.score}
        </text>
        <text className="m-k" x="772" y="60" textAnchor="end">
          fit / 100
        </text>
        <text className="m-k" x="176" y="86" textAnchor="middle">
          Assist
        </text>
        <text className="m-k" x="400" y="86" textAnchor="middle">
          Supervised
        </text>
        <text className="m-k" x="628" y="86" textAnchor="middle">
          Bounded
        </text>
        <rect className="m-fill" x="88" y="96" width="176" height="156" opacity={zone === "assist" ? 0.1 : 0.035} />
        <rect className="m-box" x="88" y="96" width="176" height="156" />
        <rect className="m-fill" x="264" y="96" width="248" height="156" opacity={zone === "supervised" ? 0.14 : 0.05} />
        <rect className="m-box" x="264" y="96" width="248" height="156" />
        <rect className="m-fill" x="512" y="96" width="200" height="156" opacity={zone === "bounded" ? 0.1 : 0.035} />
        <rect className="m-box" x="512" y="96" width="200" height="156" />
        <line className="m-line" x1="88" y1="272" x2="712" y2="272" />
        <text className="m-k" x="88" y="294">
          Reversibility
        </text>
        <text className="m-k" x="712" y="294" textAnchor="end">
          Consequence
        </text>
        {scenario ? (
          <>
            <circle className="m-ghost" cx={ghostX} cy={ghostY} r="7" />
            <line className="m-line" x1={ghostX} y1="96" x2={ghostX} y2="252" opacity="0.25" />
          </>
        ) : null}
        <line className="m-cursor" x1={x} y1="96" x2={x} y2="252" />
        <circle className="m-marker" cx={x} cy={y} r="6" />
      </svg>
    </div>
  );
}
