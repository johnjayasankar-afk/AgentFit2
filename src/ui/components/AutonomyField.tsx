import { useId } from 'react'
import type { AssessmentInput } from '../../domain/types'
import { clamp01, inv, norm } from '../../engine/normalize'
import type { AutonomyLevel } from '../../engine/autonomy'

/**
 * Risk exposure, 0–1. Combines what a failure costs, how far it travels, how
 * hard it is to undo, and whether policy constrains the decision.
 */
export function exposureOf(i: AssessmentInput): number {
  return clamp01(
    0.34 * norm(i.risk.failureConsequence) +
      0.26 * norm(i.risk.blastRadius) +
      0.26 * inv(i.risk.reversibility) +
      0.14 * norm(i.risk.regulatorySensitivity),
  )
}

/**
 * Control readiness, 0–1. Whether the workflow can be executed through
 * interfaces, checked, reconstructed, and escalated out of.
 */
export function controlOf(i: AssessmentInput): number {
  return clamp01(
    0.28 * norm(i.systems.verification) +
      0.24 * norm(i.systems.observability) +
      0.22 * norm(i.systems.toolingReadiness) +
      0.14 * norm(i.oversight.escalationAvailability) +
      0.12 * norm(i.oversight.feedbackAvailability),
  )
}

/** Band boundaries, expressed as control minus exposure. */
const BOUNDED_EDGE = 0.34
const SUPERVISED_EDGE = -0.05

export function fieldBand(i: AssessmentInput): 'assist' | 'supervised' | 'bounded' {
  const d = controlOf(i) - exposureOf(i)
  if (d > BOUNDED_EDGE) return 'bounded'
  if (d > SUPERVISED_EDGE) return 'supervised'
  return 'assist'
}

const W = 320
const H = 260
const PAD = { l: 34, r: 16, t: 16, b: 34 }
const PLOT_W = W - PAD.l - PAD.r
const PLOT_H = H - PAD.t - PAD.b

const px = (x: number) => PAD.l + x * PLOT_W
const py = (y: number) => PAD.t + (1 - y) * PLOT_H

/** Points where the line control − exposure = k crosses the unit square. */
function bandLine(k: number): string {
  // y = x + k, clipped to [0,1] in both axes.
  const x0 = Math.max(0, -k)
  const x1 = Math.min(1, 1 - k)
  if (x1 <= x0) return ''
  return `M ${px(x0)} ${py(x0 + k)} L ${px(x1)} ${py(x1 + k)}`
}

export function AutonomyField({
  input,
  level,
  zeroVariant,
  scenario,
  scenarioLevel,
}: {
  input: AssessmentInput
  level: AutonomyLevel
  /** Set when the ladder bottoms out for a reason the field cannot show. */
  zeroVariant?: 'conventional' | 'human-led' | null
  scenario?: AssessmentInput | null
  scenarioLevel?: AutonomyLevel
}) {
  const titleId = useId()
  const x = exposureOf(input)
  const y = controlOf(input)
  const band = fieldBand(input)

  const sx = scenario ? exposureOf(scenario) : null
  const sy = scenario ? controlOf(scenario) : null

  // The field is an orientation device; the gates are the model. When they
  // disagree, that gap is worth naming rather than hiding.
  const bandLevel = band === 'bounded' ? 4 : band === 'supervised' ? 3 : 2
  const heldBack = level < bandLevel && !zeroVariant

  return (
    <figure className="m-0">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-labelledby={titleId}
        preserveAspectRatio="xMidYMid meet"
      >
        <title id={titleId}>
          Autonomy field. Risk exposure {(x * 100).toFixed(0)} of 100, control readiness{' '}
          {(y * 100).toFixed(0)} of 100, placing this workflow in the {band} band.
        </title>

        {/* plot frame */}
        <rect
          x={PAD.l}
          y={PAD.t}
          width={PLOT_W}
          height={PLOT_H}
          fill="none"
          stroke="var(--hair)"
          strokeWidth="1"
        />

        {/* quiet interior grid */}
        {[0.25, 0.5, 0.75].map((t) => (
          <g key={t} stroke="var(--hair-faint)" strokeWidth="1">
            <line x1={px(t)} y1={PAD.t} x2={px(t)} y2={PAD.t + PLOT_H} />
            <line x1={PAD.l} y1={py(t)} x2={PAD.l + PLOT_W} y2={py(t)} />
          </g>
        ))}

        {/* band boundaries */}
        <path d={bandLine(BOUNDED_EDGE)} stroke="var(--hair-strong)" strokeWidth="1" fill="none" />
        <path d={bandLine(SUPERVISED_EDGE)} stroke="var(--hair-strong)" strokeWidth="1" fill="none" />

        {/* band labels, set along the diagonal */}
        <text x={px(0.06)} y={py(0.93)} className="af-band" fill="var(--muted)">
          BOUNDED
        </text>
        <text x={px(0.44)} y={py(0.62)} className="af-band" fill="var(--muted)">
          SUPERVISED
        </text>
        <text x={px(0.62)} y={py(0.16)} className="af-band" fill="var(--muted)">
          ASSIST
        </text>

        {/* scenario ghost */}
        {sx !== null && sy !== null && (
          <g>
            <line
              x1={px(x)}
              y1={py(y)}
              x2={px(sx)}
              y2={py(sy)}
              stroke="var(--hair-strong)"
              strokeWidth="1"
              strokeDasharray="2 3"
            />
            <circle
              cx={px(sx)}
              cy={py(sy)}
              r="4.5"
              fill="var(--paper)"
              stroke="var(--ink)"
              strokeWidth="1"
              strokeDasharray="2 2"
            />
            <text
              x={px(sx) + 9}
              y={py(sy) + 3}
              className="af-point-label"
              fill="var(--muted)"
            >
              SCENARIO{scenarioLevel !== undefined ? ` · L${scenarioLevel}` : ''}
            </text>
          </g>
        )}

        {/* current position — crosshair, not a dot */}
        <g>
          <line
            x1={px(x) - 7}
            y1={py(y)}
            x2={px(x) + 7}
            y2={py(y)}
            stroke="var(--signal)"
            strokeWidth="1"
          />
          <line
            x1={px(x)}
            y1={py(y) - 7}
            x2={px(x)}
            y2={py(y) + 7}
            stroke="var(--signal)"
            strokeWidth="1"
          />
          <circle cx={px(x)} cy={py(y)} r="3" fill="var(--signal)" />
        </g>

        {/* axes */}
        <text x={PAD.l} y={H - 8} className="af-axis" fill="var(--muted)">
          RISK EXPOSURE →
        </text>
        <text
          x={-(PAD.t + PLOT_H)}
          y={11}
          transform="rotate(-90)"
          className="af-axis"
          fill="var(--muted)"
        >
          CONTROL READINESS →
        </text>

        <style>{`
          .af-band { font-family: var(--font-mono); font-size: 7.5px; letter-spacing: 0.14em; }
          .af-axis { font-family: var(--font-mono); font-size: 7px; letter-spacing: 0.14em; }
          .af-point-label { font-family: var(--font-mono); font-size: 7px; letter-spacing: 0.12em; }
        `}</style>
      </svg>

      <figcaption className="text-faint mt-3 text-[11.5px] leading-[1.55]">
        {zeroVariant ? (
          <>
            The field places this workflow in the <b className="text-soft font-medium">{band}</b>{' '}
            band on risk and control alone. The recommendation sits below it for a reason the field
            cannot show:{' '}
            {zeroVariant === 'conventional'
              ? 'the work is specified well enough that a model adds nothing.'
              : 'the judgment is the deliverable.'}
          </>
        ) : heldBack ? (
          <>
            The field places this workflow in the <b className="text-soft font-medium">{band}</b> band.
            The recommendation sits below it because a gate is unmet — the field is an orientation
            device, the gates are the model.
          </>
        ) : (
          <>
            Position is set by risk exposure against control readiness. Bands are indicative; the
            recommendation itself comes from the gates.
          </>
        )}
      </figcaption>
    </figure>
  )
}
