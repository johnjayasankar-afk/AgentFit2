import type { FitResult } from '../../engine/fit'
import { Bar } from './primitives'

/** The score, taken apart. Every component shows what it earned and why. */
export function FitBreakdown({ fit, delta }: { fit: FitResult; delta?: FitResult }) {
  return (
    <div>
      {fit.components.map((c) => {
        const other = delta?.components.find((d) => d.id === c.id)
        const change = other ? other.earned - c.earned : 0
        return (
          <div key={c.id} className="border-hair border-t py-3">
            <div className="flex items-baseline justify-between gap-4">
              <span className="text-[13px] leading-tight">{c.label}</span>
              <span className="num text-faint shrink-0 text-[12px] tabular-nums">
                {Math.abs(change) >= 0.5 && (
                  <span className="text-signal mr-2">
                    {change > 0 ? '+' : ''}
                    {change.toFixed(1)}
                  </span>
                )}
                <span className="text-[var(--ink)] text-[13.5px] font-medium">
                  {c.earned.toFixed(1)}
                </span>
                <span className="text-faint"> / {c.max}</span>
              </span>
            </div>
            <Bar ratio={c.ratio} className="mt-2" />
            <p className="text-muted mt-1.5 text-[11.5px] leading-[1.5]">{c.driver}</p>
          </div>
        )
      })}
    </div>
  )
}
