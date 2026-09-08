import clsx from 'clsx'
import { AUTONOMY_LADDER, type AutonomyLevel } from '../../engine/autonomy'

/**
 * The ladder shows the recommended rung against everything the model declined
 * to recommend, and where the ceiling sits. Rungs above the ceiling are drawn
 * as unavailable rather than hidden — the point is that they were considered.
 */
export function AutonomyLadder({
  level,
  activeName,
  ceiling,
  scenarioLevel,
  compact,
}: {
  level: AutonomyLevel
  /** Overrides the rung name for the recommended level, where level 0 splits. */
  activeName?: string
  /** Highest rung reachable given current gates, if higher than `level`. */
  ceiling?: AutonomyLevel
  scenarioLevel?: AutonomyLevel
  compact?: boolean
}) {
  return (
    <ol className="m-0 list-none p-0" aria-label="Autonomy ladder">
      {AUTONOMY_LADDER.map((rung) => {
        const active = rung.level === level
        const scenario = scenarioLevel !== undefined && rung.level === scenarioLevel && !active
        const beyond = ceiling !== undefined && rung.level > ceiling
        return (
          <li
            key={rung.level}
            aria-current={active ? 'true' : undefined}
            className={clsx(
              'border-hair grid items-baseline gap-x-4 border-t py-2.5 transition-colors',
              compact ? 'grid-cols-[22px_1fr]' : 'grid-cols-[22px_1fr_auto]',
              beyond && !active && 'opacity-40',
            )}
          >
            <span
              className={clsx(
                'mono-sm tabular-nums',
                active ? 'text-signal' : 'text-faint',
              )}
            >
              {active ? '▸' : ''}
              {rung.level}
            </span>
            <span className="min-w-0">
              <span
                className={clsx(
                  'block truncate text-[13px] leading-tight',
                  active ? 'text-signal font-medium' : 'text-soft',
                )}
              >
                {active && activeName ? activeName : rung.name}
              </span>
              {active && !compact && (
                <span className="text-muted mt-1 block text-[12px] leading-[1.5]">
                  {rung.definition}
                </span>
              )}
            </span>
            {!compact && (
              <span className="mono-sm text-faint shrink-0 text-right">
                {active ? 'RECOMMENDED' : scenario ? 'SCENARIO' : beyond ? 'GATED' : ''}
              </span>
            )}
          </li>
        )
      })}
    </ol>
  )
}
