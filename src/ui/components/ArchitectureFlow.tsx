import clsx from 'clsx'
import type { ArchNode } from '../../engine/architecture'

const KIND_LABEL: Record<ArchNode['kind'], string> = {
  source: 'IN',
  process: 'RUN',
  control: 'CTL',
  commit: 'WR',
  human: 'HUM',
}

/**
 * A linear technical drawing of the recommended pattern. Human steps are drawn
 * with a solid rule and control steps with a marked one, so the position of the
 * boundary reads without a legend.
 */
export function ArchitectureFlow({ nodes }: { nodes: ArchNode[] }) {
  return (
    <ol
      className="m-0 grid list-none gap-0 p-0 sm:grid-cols-2 lg:grid-cols-3"
      aria-label="Recommended architecture"
    >
      {nodes.map((n, i) => (
        <li
          key={`${n.label}-${i}`}
          className={clsx(
            'border-hair relative border-t px-0 py-3.5 sm:pr-6',
            n.kind === 'human' && 'border-t-[var(--signal)]',
            n.kind === 'control' && 'border-t-[var(--hair-strong)]',
          )}
        >
          <div className="flex items-baseline gap-3">
            <span className="mono-sm text-faint w-[26px] shrink-0 tabular-nums">
              {String(i + 1).padStart(2, '0')}
            </span>
            <div className="min-w-0">
              <div className="flex items-baseline gap-2">
                <span
                  className={clsx(
                    'text-[13px] leading-tight font-medium',
                    n.kind === 'human' && 'text-signal',
                  )}
                >
                  {n.label}
                </span>
                <span className="mono-sm text-faint">{KIND_LABEL[n.kind]}</span>
              </div>
              <div className="text-muted mt-1 text-[11.5px] leading-[1.5]">{n.detail}</div>
            </div>
          </div>
        </li>
      ))}
    </ol>
  )
}
